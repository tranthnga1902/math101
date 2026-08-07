package com.math10.users.service;

import com.math10.common.exception.BusinessException;
import com.math10.common.storage.R2StorageServiceImpl;
import com.math10.users.dto.UserImportPreviewResponse;
import com.math10.users.dto.UserImportPresignResponse;
import com.math10.users.dto.UserImportResult;
import com.math10.users.dto.UserImportRow;
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
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class UserImportService {
    private static final int MAX_ROWS = 1_000;
    private static final Set<String> ROLES = Set.of("ADMIN", "TEACHER", "STUDENT");
    private static final String XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    private final R2StorageServiceImpl storage;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    public UserImportPresignResponse presign(String fileName, String requestedContentType) {
        String safeName = fileName.replaceAll("[^A-Za-z0-9._-]", "_");
        String objectKey = "admin/user-imports/" + UUID.randomUUID() + "-" + safeName;
        Duration duration = Duration.ofMinutes(10);
        String contentType = requestedContentType == null || requestedContentType.isBlank()
                ? XLSX_CONTENT_TYPE : requestedContentType;
        return new UserImportPresignResponse(
                storage.presignPut(objectKey, contentType, duration),
                objectKey,
                OffsetDateTime.now().plus(duration)
        );
    }

    public UserImportPreviewResponse preview(String objectKey) {
        List<UserImportRow> rows = parse(storage.readObject(objectKey));
        int valid = (int) rows.stream().filter(UserImportRow::valid).count();
        return new UserImportPreviewResponse(objectKey, rows.size(), valid, rows.size() - valid, rows);
    }

    public byte[] template() {
        try (var workbook = new XSSFWorkbook(); var output = new java.io.ByteArrayOutputStream()) {
            var sheet = workbook.createSheet("accounts");
            var header = sheet.createRow(0);
            String[] names = {"username", "email", "fullName", "phone", "roleCode", "status", "password"};
            for (int index = 0; index < names.length; index++) header.createCell(index).setCellValue(names[index]);
            var example = sheet.createRow(1);
            String[] values = {"student.demo", "student.demo@example.edu.vn", "Học sinh Demo", "", "STUDENT", "ACTIVE", "change-me-123"};
            for (int index = 0; index < values.length; index++) example.createCell(index).setCellValue(values[index]);
            for (int index = 0; index < names.length; index++) sheet.autoSizeColumn(index);
            workbook.write(output);
            return output.toByteArray();
        } catch (Exception exception) {
            throw new BusinessException("Không thể tạo file mẫu");
        }
    }

    @Transactional
    public UserImportResult confirm(String objectKey) {
        List<UserImportRow> rows = parse(storage.readObject(objectKey));
        List<String> errors = new ArrayList<>();
        int created = 0;
        int skipped = 0;
        for (UserImportRow row : rows) {
            if (!row.valid()) {
                skipped++;
                errors.add("Dòng " + row.rowNumber() + ": " + String.join(", ", row.errors()));
                continue;
            }
            if (users.existsByUsernameIgnoreCase(row.username()) || users.existsByEmail(row.email())) {
                skipped++;
                errors.add("Dòng " + row.rowNumber() + ": username hoặc email đã tồn tại");
                continue;
            }
            var user = new com.math10.users.entity.User();
            user.setUsername(row.username().trim().toLowerCase(Locale.ROOT));
            user.setEmail(row.email().trim().toLowerCase(Locale.ROOT));
            user.setFullName(row.fullName().trim());
            user.setPhone(blankToNull(row.phone()));
            user.setRoleCode(row.roleCode());
            user.setStatus(row.status());
            user.setPasswordHash(passwordEncoder.encode(row.password()));
            users.save(user);
            created++;
        }
        return new UserImportResult(created, skipped, errors);
    }

    private List<UserImportRow> parse(byte[] bytes) {
        try (var workbook = new XSSFWorkbook(new ByteArrayInputStream(bytes))) {
            if (workbook.getNumberOfSheets() == 0) throw new BusinessException("File Excel không có worksheet");
            Sheet sheet = workbook.getSheetAt(0);
            Row header = sheet.getRow(sheet.getFirstRowNum());
            if (header == null) throw new BusinessException("File Excel thiếu hàng tiêu đề");
            DataFormatter formatter = new DataFormatter(Locale.ROOT);
            Map<String, Integer> columns = columns(header, formatter);
            for (String required : List.of("username", "email", "fullname", "rolecode", "password")) {
                if (!columns.containsKey(required)) throw new BusinessException("Thiếu cột bắt buộc: " + required);
            }
            List<UserImportRow> result = new ArrayList<>();
            for (int index = header.getRowNum() + 1; index <= sheet.getLastRowNum(); index++) {
                Row source = sheet.getRow(index);
                if (source == null || rowBlank(source, formatter)) continue;
                if (result.size() >= MAX_ROWS) throw new BusinessException("File import tối đa " + MAX_ROWS + " dòng");
                result.add(toImportRow(source, columns, formatter));
            }
            return result;
        } catch (BusinessException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new BusinessException("Không thể đọc file Excel: " + exception.getMessage());
        }
    }

    private UserImportRow toImportRow(Row row, Map<String, Integer> columns, DataFormatter formatter) {
        String username = value(row, columns, "username", formatter);
        String email = value(row, columns, "email", formatter);
        String fullName = value(row, columns, "fullname", formatter);
        String phone = value(row, columns, "phone", formatter);
        String role = value(row, columns, "rolecode", formatter).toUpperCase(Locale.ROOT);
        String rawStatus = value(row, columns, "status", formatter).toUpperCase(Locale.ROOT);
        String password = value(row, columns, "password", formatter);
        List<String> errors = new ArrayList<>();
        if (!username.matches("^[a-zA-Z0-9._-]{1,80}$")) errors.add("username không hợp lệ");
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) errors.add("email không hợp lệ");
        if (fullName.isBlank() || fullName.length() > 120) errors.add("họ tên không hợp lệ");
        if (!ROLES.contains(role)) errors.add("roleCode không hợp lệ");
        if (password.length() < 8) errors.add("mật khẩu phải có ít nhất 8 ký tự");
        UserStatus status = UserStatus.ACTIVE;
        if (!rawStatus.isBlank()) {
            try { status = UserStatus.valueOf(rawStatus); }
            catch (IllegalArgumentException ignored) { errors.add("trạng thái không hợp lệ"); }
        }
        return new UserImportRow(row.getRowNum() + 1, username, email, fullName, phone, role, status, password, List.copyOf(errors));
    }

    private Map<String, Integer> columns(Row header, DataFormatter formatter) {
        Map<String, Integer> result = new HashMap<>();
        header.forEach(cell -> result.put(normalize(formatter.formatCellValue(cell)), cell.getColumnIndex()));
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

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
