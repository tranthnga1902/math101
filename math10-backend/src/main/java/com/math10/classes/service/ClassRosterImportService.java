package com.math10.classes.service;

import com.math10.classes.dto.RosterImportPreviewResponse;
import com.math10.classes.dto.RosterImportResult;
import com.math10.classes.dto.RosterImportRow;
import com.math10.common.exception.BusinessException;
import com.math10.common.storage.R2StorageServiceImpl;
import com.math10.enrollments.entity.ClassStudent;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.users.entity.User;
import com.math10.users.entity.UserStatus;
import com.math10.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * Nhập danh sách học sinh vào một lớp từ file Excel, theo đúng luồng presign → preview → confirm
 * mà màn import tài khoản của Admin đang dùng, nhưng nhìn từ phía lớp học: dòng nào đã có tài khoản
 * thì chỉ ghi danh, dòng nào chưa có thì tạo tài khoản học sinh rồi ghi danh.
 *
 * <p>Lưu ý về quyền: ở đây giáo viên tạo được tài khoản học sinh — trước nay chỉ Admin làm được.
 * Đây là điều kiện để giáo viên tự lập lớp mà không phải chờ Admin nhập tay từng em; tài khoản tạo
 * ra luôn là STUDENT và luôn được gắn vào đúng lớp của giáo viên đó.
 */
@Service
@RequiredArgsConstructor
public class ClassRosterImportService {

    public static final String STATUS_NEW = "TAO_MOI";
    public static final String STATUS_EXISTING = "CO_SAN";
    public static final String STATUS_ALREADY = "DA_TRONG_LOP";
    public static final String STATUS_INVALID = "LOI";

    private static final int MAX_ROWS = 1_000;
    private static final int MAX_FILE_BYTES = 5 * 1024 * 1024;
    private static final String XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final String USERNAME_PATTERN = "^[a-zA-Z0-9._-]{3,80}$";
    private static final String EMAIL_PATTERN = "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$";

    /** Tiêu đề cột tiếng Việt hay gặp — nhận luôn để giáo viên khỏi phải sửa lại file của trường. */
    private static final Map<String, String> HEADER_ALIASES = Map.ofEntries(
            Map.entry("hoten", "fullname"),
            Map.entry("hovaten", "fullname"),
            Map.entry("tenhocsinh", "fullname"),
            Map.entry("hotenhocsinh", "fullname"),
            Map.entry("tendangnhap", "username"),
            Map.entry("taikhoan", "username"),
            Map.entry("matkhau", "password"),
            Map.entry("sodienthoai", "phone"),
            Map.entry("dienthoai", "phone")
    );

    private final R2StorageServiceImpl storage;
    private final UserRepository users;
    private final ClassStudentRepository classStudents;
    private final PasswordEncoder passwordEncoder;

    public PresignResponse presign(Long classId, String fileName, String requestedContentType) {
        String safeName = (fileName == null || fileName.isBlank() ? "roster.xlsx" : fileName).replaceAll("[^A-Za-z0-9._-]", "_");
        String objectKey = "classes/" + classId + "/roster-imports/" + UUID.randomUUID() + "-" + safeName;
        Duration duration = Duration.ofMinutes(10);
        String contentType = requestedContentType == null || requestedContentType.isBlank()
                ? XLSX_CONTENT_TYPE : requestedContentType;
        return new PresignResponse(storage.presignPut(objectKey, contentType, duration), objectKey,
                OffsetDateTime.now().plus(duration));
    }

    public byte[] template() {
        try (var workbook = new XSSFWorkbook(); var output = new java.io.ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("hoc-sinh");
            var header = sheet.createRow(0);
            String[] names = {"fullName", "username", "email", "phone", "password"};
            for (int index = 0; index < names.length; index++) header.createCell(index).setCellValue(names[index]);
            var note = sheet.createRow(1);
            String[] values = {"Nguyễn Văn A", "nguyenvana", "nguyenvana@example.edu.vn", "", "doi-mat-khau-123"};
            for (int index = 0; index < values.length; index++) note.createCell(index).setCellValue(values[index]);
            var guide = sheet.createRow(3);
            guide.createCell(0).setCellValue("Em nào đã có tài khoản thì chỉ cần username hoặc email, bỏ trống mật khẩu.");
            for (int index = 0; index < names.length; index++) sheet.autoSizeColumn(index);
            workbook.write(output);
            return output.toByteArray();
        } catch (Exception exception) {
            throw new BusinessException("Không thể tạo file mẫu");
        }
    }

    public RosterImportPreviewResponse preview(Long classId, String objectKey) {
        List<RosterImportRow> rows = parse(classId, readImportFile(objectKey));
        return new RosterImportPreviewResponse(objectKey, rows.size(),
                count(rows, STATUS_NEW), count(rows, STATUS_EXISTING),
                count(rows, STATUS_ALREADY), count(rows, STATUS_INVALID),
                rows.stream().map(RosterImportRow::masked).toList());
    }

    @Transactional
    public RosterImportResult confirm(Long classId, String objectKey) {
        List<RosterImportRow> rows = parse(classId, readImportFile(objectKey));
        List<String> errors = new ArrayList<>();
        int created = 0;
        int enrolled = 0;
        int skipped = 0;
        for (RosterImportRow row : rows) {
            if (!row.valid()) {
                skipped++;
                errors.add("Dòng " + row.rowNumber() + ": " + String.join(", ", row.errors()));
                continue;
            }
            if (STATUS_ALREADY.equals(row.status())) {
                skipped++;
                continue;
            }
            Long studentId = row.matchedUserId();
            if (studentId == null) {
                // Đọc file xong tới lúc bấm xác nhận có thể đã có người khác lấy mất username/email.
                if (users.existsByUsernameIgnoreCase(row.username()) || users.existsByEmail(row.email())) {
                    skipped++;
                    errors.add("Dòng " + row.rowNumber() + ": username hoặc email vừa bị tài khoản khác dùng mất");
                    continue;
                }
                studentId = createStudent(row).getId();
                created++;
            }
            if (!classStudents.existsByClassIdAndStudentId(classId, studentId)) {
                ClassStudent enrollment = new ClassStudent();
                enrollment.setClassId(classId);
                enrollment.setStudentId(studentId);
                classStudents.save(enrollment);
                enrolled++;
            }
        }
        return new RosterImportResult(created, enrolled, skipped, errors);
    }

    /** Thêm lẻ một em còn thiếu: đã có tài khoản thì truyền userId, chưa có thì truyền thông tin để tạo. */
    @Transactional
    public Long addSingle(Long classId, Long userId, String fullName, String username, String email, String phone, String password) {
        Long studentId = userId;
        if (studentId == null) {
            RosterImportRow row = evaluate(classId, 0, trim(username), lower(email), trim(fullName), trim(phone), trim(password));
            if (!row.valid()) throw new BusinessException(String.join(", ", row.errors()));
            if (STATUS_ALREADY.equals(row.status())) throw new BusinessException("Học sinh này đã có trong lớp");
            studentId = row.matchedUserId() == null ? createStudent(row).getId() : row.matchedUserId();
        } else {
            User user = users.findById(studentId).orElseThrow(() -> new BusinessException("Không tìm thấy tài khoản"));
            if (!"STUDENT".equals(user.getRoleCode())) throw new BusinessException("Tài khoản này không phải học sinh");
        }
        if (classStudents.existsByClassIdAndStudentId(classId, studentId)) throw new BusinessException("Học sinh này đã có trong lớp");
        ClassStudent enrollment = new ClassStudent();
        enrollment.setClassId(classId);
        enrollment.setStudentId(studentId);
        classStudents.save(enrollment);
        return studentId;
    }

    private User createStudent(RosterImportRow row) {
        User user = new User();
        user.setUsername(row.username().toLowerCase(Locale.ROOT));
        user.setEmail(row.email().toLowerCase(Locale.ROOT));
        user.setFullName(row.fullName());
        user.setPhone(row.phone() == null || row.phone().isBlank() ? null : row.phone());
        user.setRoleCode("STUDENT");
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordHash(passwordEncoder.encode(row.password()));
        return users.save(user);
    }

    /** File danh sách lớp là bảng tính vài trăm dòng, không có lý do để nặng — chặn sớm cho khỏi ngốn RAM. */
    private byte[] readImportFile(String objectKey) {
        byte[] bytes = storage.readObject(objectKey);
        if (bytes.length > MAX_FILE_BYTES) throw new BusinessException("File danh sách vượt quá 5MB");
        return bytes;
    }

    private List<RosterImportRow> parse(Long classId, byte[] bytes) {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            if (workbook.getNumberOfSheets() == 0) throw new BusinessException("File Excel không có worksheet");
            Sheet sheet = workbook.getSheetAt(0);
            Row header = sheet.getRow(sheet.getFirstRowNum());
            if (header == null) throw new BusinessException("File Excel thiếu hàng tiêu đề");
            DataFormatter formatter = new DataFormatter(Locale.ROOT);
            Map<String, Integer> columns = columns(header, formatter);
            if (!columns.containsKey("fullname")) throw new BusinessException("Thiếu cột bắt buộc: fullName (họ tên)");
            if (!columns.containsKey("username") && !columns.containsKey("email"))
                throw new BusinessException("Cần ít nhất một cột username hoặc email để nhận ra từng học sinh");

            List<RosterImportRow> result = new ArrayList<>();
            Set<String> seen = new HashSet<>();
            for (int index = header.getRowNum() + 1; index <= sheet.getLastRowNum(); index++) {
                Row source = sheet.getRow(index);
                if (source == null || rowBlank(source, formatter)) continue;
                if (result.size() >= MAX_ROWS) throw new BusinessException("File danh sách tối đa " + MAX_ROWS + " dòng");
                RosterImportRow row = evaluate(classId, source.getRowNum() + 1,
                        value(source, columns, "username", formatter),
                        value(source, columns, "email", formatter).toLowerCase(Locale.ROOT),
                        value(source, columns, "fullname", formatter),
                        value(source, columns, "phone", formatter),
                        value(source, columns, "password", formatter));
                result.add(dedupe(row, seen));
            }
            return result;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("Không thể đọc file Excel: " + exception.getMessage());
        }
    }

    /** Đối chiếu một dòng với dữ liệu hiện có để biết dòng đó sẽ tạo mới, ghi danh, hay bỏ qua. */
    private RosterImportRow evaluate(Long classId, int rowNumber, String username, String email,
                                     String fullName, String phone, String password) {
        List<String> errors = new ArrayList<>();
        if (username.isBlank() && email.isBlank()) errors.add("phải có username hoặc email");
        if (!username.isBlank() && !username.matches(USERNAME_PATTERN)) errors.add("username không hợp lệ");
        if (!email.isBlank() && !email.matches(EMAIL_PATTERN)) errors.add("email không hợp lệ");
        if (!errors.isEmpty()) return invalid(rowNumber, username, email, fullName, phone, errors);

        Optional<User> matched = username.isBlank() ? Optional.empty() : users.findByUsernameIgnoreCase(username);
        if (matched.isEmpty() && !email.isBlank()) matched = users.findByEmail(email);

        if (matched.isPresent()) {
            User user = matched.get();
            if (!"STUDENT".equals(user.getRoleCode()))
                return invalid(rowNumber, username, email, fullName, phone, List.of("tài khoản này là " + user.getRoleCode() + ", không phải học sinh"));
            String status = classStudents.existsByClassIdAndStudentId(classId, user.getId()) ? STATUS_ALREADY : STATUS_EXISTING;
            return new RosterImportRow(rowNumber, trim(user.getUsername()), trim(user.getEmail()), user.getFullName(),
                    user.getPhone(), null, user.getId(), status, List.of());
        }

        // Chưa có tài khoản: lúc này mới cần đủ thông tin để tạo.
        if (fullName.isBlank() || fullName.length() > 120) errors.add("họ tên không hợp lệ");
        if (username.isBlank()) errors.add("học sinh mới cần có username");
        if (email.isBlank()) errors.add("học sinh mới cần có email");
        if (password.length() < 8) errors.add("học sinh mới cần mật khẩu từ 8 ký tự");
        if (!errors.isEmpty()) return invalid(rowNumber, username, email, fullName, phone, errors);
        return new RosterImportRow(rowNumber, username, email, fullName, phone, password, null, STATUS_NEW, List.of());
    }

    /** Hai dòng cùng một em trong cùng file thì dòng sau bị chặn, khỏi đâm vào ràng buộc duy nhất lúc lưu. */
    private RosterImportRow dedupe(RosterImportRow row, Set<String> seen) {
        if (!row.valid()) return row;
        boolean duplicated = !row.username().isBlank() && !seen.add("u:" + row.username().toLowerCase(Locale.ROOT));
        if (!row.email().isBlank() && !seen.add("e:" + row.email())) duplicated = true;
        if (!duplicated) return row;
        return invalid(row.rowNumber(), row.username(), row.email(), row.fullName(), row.phone(),
                List.of("trùng với một dòng phía trên trong file"));
    }

    private RosterImportRow invalid(int rowNumber, String username, String email, String fullName, String phone, List<String> errors) {
        return new RosterImportRow(rowNumber, username, email, fullName, phone, null, null, STATUS_INVALID, List.copyOf(errors));
    }

    private int count(List<RosterImportRow> rows, String status) {
        return (int) rows.stream().filter(row -> status.equals(row.status())).count();
    }

    private Map<String, Integer> columns(Row header, DataFormatter formatter) {
        Map<String, Integer> result = new HashMap<>();
        header.forEach(cell -> {
            String name = normalize(formatter.formatCellValue(cell));
            result.putIfAbsent(HEADER_ALIASES.getOrDefault(name, name), cell.getColumnIndex());
        });
        return result;
    }

    private String value(Row row, Map<String, Integer> columns, String name, DataFormatter formatter) {
        Integer column = columns.get(name);
        return column == null ? "" : formatter.formatCellValue(row.getCell(column, Row.MissingCellPolicy.CREATE_NULL_AS_BLANK)).trim();
    }

    private boolean rowBlank(Row row, DataFormatter formatter) {
        for (var cell : row) if (!formatter.formatCellValue(cell).isBlank()) return false;
        return true;
    }

    private String normalize(String value) {
        return value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }

    private String trim(String value) {
        return value == null ? "" : value.trim();
    }

    private String lower(String value) {
        return trim(value).toLowerCase(Locale.ROOT);
    }

    public record PresignResponse(URI uploadUrl, String objectKey, OffsetDateTime expiresAt) {}
}
