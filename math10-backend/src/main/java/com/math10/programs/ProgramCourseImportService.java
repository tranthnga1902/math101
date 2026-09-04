package com.math10.programs;

import com.math10.audit.service.AuditService;
import com.math10.common.exception.BusinessException;
import com.math10.programs.dto.ProgramCourseImportDtos.*;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.ss.util.CellRangeAddressList;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.text.Normalizer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ProgramCourseImportService {
    private static final int MAX_BYTES = 10 * 1024 * 1024;
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final PpctConfigLoader configLoader;
    private final StrandInferenceEngine strandInferenceEngine;
    private final BookSeriesService bookSeriesService;

    private final Map<String, CachedPreview> previews = new ConcurrentHashMap<>();
    private final Map<String, CachedRawTable> rawCache = new ConcurrentHashMap<>();

    private record CachedPreview(Preview preview, Instant expiresAt) {}
    private record CachedRawTable(RawTable table, String filename, Long sourceCourseId, Instant expiresAt) {}

    public byte[] template() {
        try (var wb = new XSSFWorkbook(); var out = new ByteArrayOutputStream()) {
            var guide = wb.createSheet("Hướng dẫn");
            guide.createRow(0).createCell(0).setCellValue("Mỗi dòng trong tab Dữ liệu là một tiết. Không gộp ô, không suy luận từ màu nền.");
            guide.createRow(2).createCell(0).setCellValue("Các cột bắt buộc: MẠCH, HỌC KỲ, TIẾT, TUẦN, CHƯƠNG, TÊN CHƯƠNG, BÀI HỌC, LOẠI.");
            var info = wb.createSheet("Thông tin");
            String[][] values = {{"MÃ CHƯƠNG TRÌNH", "TOAN10"}, {"TÊN CHƯƠNG TRÌNH", "Toán 10"}, {"MÔN", "Toán"}, {"KHỐI", "10"}, {"TỔNG TIẾT", "105"}, {"TỔNG TUẦN", "35"}, {"PHIÊN BẢN", "1"}};
            for (int i = 0; i < values.length; i++) {
                var row = info.createRow(i);
                row.createCell(0).setCellValue(values[i][0]);
                row.createCell(1).setCellValue(values[i][1]);
            }
            createDataSheet(wb, "Dữ liệu", false);
            createDataSheet(wb, "Toán 10 (mẫu)", true);
            wb.write(out);
            return out.toByteArray();
        } catch (Exception e) {
            throw new BusinessException("Không tạo được file mẫu PPCT");
        }
    }

    private void createDataSheet(XSSFWorkbook wb, String name, boolean example) {
        var s = wb.createSheet(name);
        String[] h = {"MẠCH", "TÊN MẠCH", "HỌC KỲ", "TIẾT", "TUẦN", "CHƯƠNG", "TÊN CHƯƠNG", "BÀI HỌC", "LOẠI"};
        var hr = s.createRow(0);
        for (int i = 0; i < h.length; i++) {
            hr.createCell(i).setCellValue(h[i]);
            s.setColumnWidth(i, i == 7 ? 9000 : 4500);
        }
        if (example) {
            String[][] rows = {
                    {"DS", "Đại số và Giải tích", "1", "1", "1", "I", "Mệnh đề và tập hợp", "Bài 1. Mệnh đề", "LESSON"},
                    {"HH", "Hình học và Đo lường", "1", "1", "1", "IV", "Hệ thức lượng trong tam giác", "Bài 1. Giá trị lượng giác", "LESSON"},
                    {"HH", "Hình học và Đo lường", "1", "2", "1", "IV", "Hệ thức lượng trong tam giác", "Bài 1. Giá trị lượng giác", "LESSON"}
            };
            for (int r = 0; r < rows.length; r++) {
                var x = s.createRow(r + 1);
                for (int c = 0; c < rows[r].length; c++) x.createCell(c).setCellValue(rows[r][c]);
            }
        }
        var helper = s.getDataValidationHelper();
        var semester = helper.createValidation(helper.createExplicitListConstraint(new String[]{"1", "2"}), new CellRangeAddressList(1, 5000, 2, 2));
        s.addValidationData(semester);
        var kind = helper.createValidation(helper.createExplicitListConstraint(new String[]{"LESSON", "REVIEW", "EXAM", "PRACTICE"}), new CellRangeAddressList(1, 5000, 8, 8));
        s.addValidationData(kind);
        s.createFreezePane(0, 1);
    }

    // ==================== I7: Parse and column sampling ====================

    public ParseResult parse(MultipartFile file, String pasted) {
        RawTable table;
        String format;
        if (pasted != null && !pasted.isBlank()) {
            table = PasteAdapter.parse(pasted, true);
            format = "PASTE";
        } else {
            if (file == null || file.isEmpty()) throw new BusinessException("Không có tệp tải lên hoặc dữ liệu dán");
            String fn = Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase(Locale.ROOT);
            try {
                if (fn.endsWith(".docx")) {
                    table = DocxAdapter.read(file.getBytes());
                    format = "DOCX";
                } else if (fn.endsWith(".xlsx") || fn.endsWith(".xls")) {
                    table = XlsxAdapter.read(file.getInputStream());
                    format = "XLSX";
                } else {
                    throw new BusinessException("Định dạng không hỗ trợ cho parse cột. Vui lòng dùng .docx, .xlsx hoặc dán trực tiếp");
                }
            } catch (BusinessException e) {
                throw e;
            } catch (Exception e) {
                throw new BusinessException("Lỗi đọc tệp: " + e.getMessage());
            }
        }

        String token = UUID.randomUUID().toString();
        rawCache.put(token, new CachedRawTable(table, file != null ? file.getOriginalFilename() : "pasted", null, Instant.now().plus(30, ChronoUnit.MINUTES)));

        // Trích mẫu cột từ dòng đầu tiên
        List<ColumnSample> cols = new ArrayList<>();
        Map<Integer, String> suggested = new LinkedHashMap<>();
        if (!table.rows().isEmpty()) {
            List<String> fields = PasteAdapter.FIELD_NAMES;
            for (int i = 0; i < fields.size(); i++) {
                String fName = fields.get(i);
                List<String> samples = new ArrayList<>();
                for (int r = 0; r < Math.min(5, table.rows().size()); r++) {
                    RawRow row = table.rows().get(r);
                    samples.add(extractField(row, fName));
                }
                cols.add(new ColumnSample(i, fName, samples, fName));
                suggested.put(i, fName);
            }
        }

        return new ParseResult(token, format, cols, suggested, table.rows().size());
    }

    private String extractField(RawRow r, String field) {
        return switch (field) {
            case "namespace" -> r.namespace();
            case "strandCode" -> r.strandCode();
            case "strandName" -> r.strandName();
            case "semester" -> r.semester();
            case "periodRange" -> r.periodRange();
            case "weekRange" -> r.weekRange();
            case "chapterNumeral" -> r.chapterNumeral();
            case "chapterName" -> r.chapterName();
            case "lessonName" -> r.lessonName();
            case "kind" -> r.kind();
            default -> "";
        };
    }

    // ==================== Preview ====================

    public Preview preview(MultipartFile file) {
        return preview(file, null);
    }

    public Preview preview(MultipartFile file, Long sourceCourseId) {
        if (file == null || file.isEmpty()) throw new BusinessException("File PPCT không được rỗng");
        if (file.getSize() > MAX_BYTES) throw new BusinessException("File PPCT vượt quá 10 MB");

        String filename = Optional.ofNullable(file.getOriginalFilename()).orElse("").toLowerCase(Locale.ROOT);
        RawTable rawTable;
        Info declaredInfo = null;

        try {
            if (filename.endsWith(".docx")) {
                rawTable = DocxAdapter.read(file.getBytes());
            } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
                // Kiểm tra xem có tab Thông tin không
                try (Workbook wb = WorkbookFactory.create(file.getInputStream())) {
                    Sheet infoSheet = wb.getSheet("Thông tin");
                    if (infoSheet != null) declaredInfo = readInfo(infoSheet);
                } catch (Exception ignored) {}
                rawTable = XlsxAdapter.read(file.getInputStream());
            } else if (filename.endsWith(".pdf")) {
                return previewPdf(file, sourceCourseId);
            } else {
                throw new BusinessException("Chỉ hỗ trợ file PPCT PDF, .docx, .xlsx hoặc .xls");
            }
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Lỗi phân tích file: " + e.getMessage());
        }

        // Suy luận mạch thông minh từ cấu hình DB
        int grade = gradeFrom(file.getOriginalFilename());
        RawTable enrichedTable = strandInferenceEngine.infer(rawTable, grade, "Toán");

        // Chuyển RawTable sang danh sách Row phẳng cho bước Validate & Derive
        List<Row> rows = convertRawToRows(enrichedTable);

        Info info = declaredInfo != null ? declaredInfo : generateInfo(file.getOriginalFilename(), sourceCourseId, rows);

        // Chạy unified validator
        RawTableValidator.ValidationResult val = RawTableValidator.validate(
                enrichedTable, info.totalPeriods(), info.totalWeeks());

        List<Issue> errors = new ArrayList<>(val.errors());
        List<Issue> warnings = new ArrayList<>(val.warnings());

        return cache(info, rows, errors, warnings);
    }

    List<Row> convertRawToRows(RawTable table) {
        List<Row> out = new ArrayList<>();
        Map<String, Integer> periodCounters = new HashMap<>();

        for (RawRow r : table.rows()) {
            int sem = parseInt(r.semester(), 1);
            List<Integer> periods = expandPeriodRange(r.periodRange());
            List<Integer> weeks = expandNumberList(r.weekRange());
            String strand = r.strandCode().isBlank() ? "DAI_SO" : r.strandCode();
            String strandName = r.strandName().isBlank() ? StrandInferenceEngine.nameOfStrand(strand) : r.strandName();
            String kind = normalizeKind(r.kind());

            if (periods.isEmpty()) {
                String counterKey = strand + "#" + sem + "#" + r.namespace();
                int periodNo = periodCounters.merge(counterKey, 1, Integer::sum);
                periods = List.of(periodNo);
            }

            for (int periodIndex = 0; periodIndex < periods.size(); periodIndex++) {
                int p = periods.get(periodIndex);
                // Một dòng "tuần 2+3, tiết 7-10" nghĩa là bốn tiết trải trên hai tuần,
                // không phải bốn tiết cùng rơi vào tuần 2 và cũng không nhân chéo thành tám tiết.
                int week = weeks.isEmpty() ? 1
                        : weeks.get(Math.min(weeks.size() - 1, periodIndex * weeks.size() / periods.size()));
                out.add(new Row(
                        out.size() + 1,
                        r.namespace(),
                        strand,
                        strandName,
                        sem,
                        p,
                        week,
                        r.chapterNumeral(),
                        r.chapterName(),
                        r.lessonName(),
                        kind,
                        r.chapterInferredBy().name()
                ));
            }
        }
        return out;
    }

    private static List<Integer> expandPeriodRange(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        Matcher m = Pattern.compile("(\\d+)\\s*[-\u2013\u2014]\\s*(\\d+)").matcher(raw.trim());
        if (m.find()) {
            int start = Integer.parseInt(m.group(1));
            int end = Integer.parseInt(m.group(2));
            if (end >= start && end - start <= 50) {
                List<Integer> list = new ArrayList<>();
                for (int i = start; i <= end; i++) list.add(i);
                return list;
            }
        }
        try {
            int single = Integer.parseInt(raw.trim().replaceAll("[^0-9]", ""));
            return List.of(single);
        } catch (NumberFormatException e) {
            return List.of();
        }
    }

    private static List<Integer> expandNumberList(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        Matcher matcher = Pattern.compile("\\d+").matcher(raw);
        List<Integer> values = new ArrayList<>();
        while (matcher.find()) values.add(Integer.parseInt(matcher.group()));
        return values;
    }

    private static int parseInt(String s, int def) {
        if (s == null || s.isBlank()) return def;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return def; }
    }

    private static String normalizeKind(String raw) {
        if (raw == null) return "LESSON";
        return switch (raw.trim().toUpperCase(Locale.ROOT)) {
            case "BAI_MOI", "LESSON" -> "LESSON";
            case "ON_TAP", "REVIEW" -> "REVIEW";
            case "KIEM_TRA", "EXAM" -> "EXAM";
            case "THUC_HANH", "PRACTICE" -> "PRACTICE";
            default -> "LESSON";
        };
    }

    private Preview previewPdf(MultipartFile file, Long sourceCourseId) {
        try {
            List<PpctExtractor.HangTho> raw = PpctExtractor.tach(file.getBytes());
            if (raw.isEmpty()) throw new BusinessException("PDF không rút được bảng PPCT. Hãy dùng PDF gốc có thể chọn chữ; PDF scan cần OCR trước.");
            List<PpctSuyMach.TuKhoa> keywords = sourceCourseId == null ? List.of() : configLoader.tuKhoa(sourceCourseId).stream().map(x -> new PpctSuyMach.TuKhoa(x.maMach(), x.tuKhoa())).toList();
            List<PpctSuyMach.TietDoan> detected = PpctSuyMach.suy(raw, keywords);

            List<RawRow> rawRows = new ArrayList<>();
            for (int i = 0; i < detected.size(); i++) {
                var d = detected.get(i);
                rawRows.add(RawRow.of(
                        i + 1, "MAIN", d.maMach(), PpctSuyMach.tenMach(d.maMach()),
                        String.valueOf(d.hocKy()), String.valueOf(d.soTiet()), String.valueOf(d.tuan()),
                        "", "", d.tieuDe(), d.phanLoai()
                ));
            }

            RawTable rawTable = new RawTable(rawRows, RawTable.detectStyle(rawRows), null);
            RawTable enriched = strandInferenceEngine.infer(rawTable, gradeFrom(file.getOriginalFilename()), "Toán");
            List<Row> rows = convertRawToRows(enriched);
            Info info = generateInfo(file.getOriginalFilename(), sourceCourseId, rows);

            List<Issue> errors = new ArrayList<>(), warnings = new ArrayList<>();
            for (int i = 0; i < detected.size(); i++) {
                for (String w : detected.get(i).canhBao()) warnings.add(new Issue(i + 1, "MẠCH", "AUTO_DETECTION", w));
            }
            if (rows.isEmpty()) errors.add(new Issue(0, "Dữ liệu", "EMPTY", "Không có dòng tiết nào"));
            warnings.add(new Issue(0, "PDF", "REVIEW_REQUIRED", "Dữ liệu PDF được tự nhận diện; hãy kiểm tra kỹ mạch, chương và bài học."));

            return cache(info, rows, errors, warnings);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Không đọc được file PDF PPCT: " + e.getMessage());
        }
    }

    private Preview cache(Info info, List<Row> rows, List<Issue> errors, List<Issue> warnings) {
        Derived derived = derive(rows);
        String token = UUID.randomUUID().toString();
        Preview result = new Preview(token, info, derived, List.copyOf(errors), List.copyOf(warnings));
        previews.entrySet().removeIf(e -> e.getValue().expiresAt().isBefore(Instant.now()));
        previews.put(token, new CachedPreview(result, Instant.now().plus(30, ChronoUnit.MINUTES)));
        return result;
    }

    private Info generateInfo(String filename, Long sourceCourseId, List<Row> rows) {
        int detectedWeeks = rows.stream().mapToInt(Row::weekNo).max().orElse(35);
        if (sourceCourseId != null) {
            List<Map<String, Object>> found = jdbc.queryForList("select code,name,subject,grade_number,total_weeks,version from courses where id=? and deleted_at is null", sourceCourseId);
            if (!found.isEmpty()) {
                Map<String, Object> c = found.get(0);
                String subject = c.get("subject") instanceof String value && !value.isBlank() ? value : "Toán";
                int gradeNumber = numberOr(c.get("grade_number"), gradeFrom(filename));
                int totalWeeks = numberOr(c.get("total_weeks"), detectedWeeks);
                int nextVersion = numberOr(c.get("version"), 1) + 1;
                return new Info(String.valueOf(c.get("code")) + "_IMPORT_" + System.currentTimeMillis(), String.valueOf(c.get("name")) + " (nhập PPCT)", subject, gradeNumber, rows.size(), totalWeeks, nextVersion);
            }
        }
        String base = Optional.ofNullable(filename).orElse("PPCT").replaceFirst("(?i)\\.[a-z0-9]+$", "");
        return new Info("PPCT_" + System.currentTimeMillis(), base, "Toán", gradeFrom(filename), rows.size(), detectedWeeks, 1);
    }

    private int gradeFrom(String filename) {
        Matcher grade = Pattern.compile("(?<!\\d)(1[0-2]|[1-9])(?!\\d)").matcher(Optional.ofNullable(filename).orElse(""));
        return grade.find() ? Integer.parseInt(grade.group(1)) : 10;
    }

    private int numberOr(Object value, int fallback) {
        return value instanceof Number number ? number.intValue() : fallback;
    }

    private Derived derive(List<Row> rows) {
        List<Strand> strands = new ArrayList<>();
        var byS = rows.stream().collect(java.util.stream.Collectors.groupingBy(Row::strandCode, LinkedHashMap::new, java.util.stream.Collectors.toList()));
        for (var se : byS.entrySet()) {
            List<Chapter> chapters = new ArrayList<>();
            var byC = se.getValue().stream().collect(java.util.stream.Collectors.groupingBy(r -> r.chapterNumeral() + "\0" + r.chapterName(), LinkedHashMap::new, java.util.stream.Collectors.toList()));
            for (var ce : byC.entrySet()) {
                List<Lesson> lessons = new ArrayList<>();
                var byL = ce.getValue().stream().collect(java.util.stream.Collectors.groupingBy(r -> normalize(r.lessonName()), LinkedHashMap::new, java.util.stream.Collectors.toList()));
                for (var le : byL.entrySet()) {
                    var ps = le.getValue();
                    String inf = ps.get(0).inferredBy() != null ? ps.get(0).inferredBy() : "DATA";
                    lessons.add(new Lesson(ps.get(0).lessonName(), le.getKey(), ps.get(0).kind(), ps.size(),
                            ps.stream().mapToInt(Row::weekNo).min().orElse(0),
                            ps.stream().mapToInt(Row::weekNo).max().orElse(0), ps, inf));
                }
                String[] c = ce.getKey().split("\0", -1);
                chapters.add(new Chapter(c[0], c[1], ce.getValue().size(), lessons));
            }
            String name = se.getValue().get(0).strandName();
            strands.add(new Strand(se.getKey(), name, se.getValue().size(), chapters));
        }
        return new Derived(strands, strands.stream().mapToInt(s -> s.chapters().size()).sum(), strands.stream().flatMap(s -> s.chapters().stream()).mapToInt(c -> c.lessons().size()).sum(), rows.size());
    }

    @Transactional
    public ConfirmResult confirm(String token) {
        CachedPreview cached = previews.remove(token);
        if (cached == null || cached.expiresAt().isBefore(Instant.now())) {
            throw new BusinessException("Bản xem trước đã hết hạn; hãy tải file lên lại");
        }
        Preview p = cached.preview();
        if (!p.errors().isEmpty()) throw new BusinessException("Không thể xác nhận khi file còn lỗi");
        Info i = p.info();

        long course = jdbc.queryForObject(
                "insert into courses(code,name,subject,grade_number,total_periods,total_weeks,version,status,created_at,updated_at) values(?,?,?,?,?,?,?,'DRAFT',now(),now()) returning id",
                Long.class, i.code(), i.name(), i.subject(), i.grade(), p.derived().periodCount(), i.totalWeeks(), Optional.ofNullable(i.version()).orElse(1));

        int so = 0, ch = 0, le = 0, pe = 0;
        for (Strand s : p.derived().strands()) {
            long sid = jdbc.queryForObject(
                    "insert into program_strands(program_id,code,name,order_index,total_periods,created_at,updated_at) values(?,?,?,?,?,now(),now()) returning id",
                    Long.class, course, s.code(), s.name(), ++so, s.totalPeriods());

            for (Chapter c : s.chapters()) {
                Long cid = null;
                if (!c.numeral().isBlank() || !c.name().isBlank()) {
                    cid = jdbc.queryForObject(
                            "insert into chapters(course_id,strand_id,numeral,title,order_index,status,created_at,updated_at) values(?,?,?,?,?,'DRAFT',now(),now()) returning id",
                            Long.class, course, sid, c.numeral(), c.name(), ++ch);
                }
                for (Lesson l : c.lessons()) {
                    String inf = l.inferredBy() != null ? l.inferredBy() : "DATA";
                    String ns = l.periods().isEmpty() ? "MAIN" : l.periods().get(0).namespace();

                    Long lid = jdbc.queryForObject(
                            "insert into lessons(course_id,chapter_id,title,name_normalized,lesson_kind,total_periods,order_index,status,namespace,chapter_inferred_by,created_at,updated_at) values(?,?,?,?,?,?,?,'DRAFT',?,?,now(),now()) returning id",
                            Long.class, course, cid, l.name(), l.normalizedName(), l.kind(), l.totalPeriods(), ++le, ns, inf);

                    for (Row r : l.periods()) {
                        jdbc.update(
                                "insert into program_periods(strand_id,period_no,week_no,term,lesson_id,title,period_kind,namespace,source,created_at,updated_at) values(?,?,?,?,?,?,?,?,'MANUAL',now(),now())",
                                sid, r.periodNo(), r.weekNo(), r.semester(), lid, r.lessonName(), toOldKind(r.kind()), r.namespace());
                        pe++;
                    }
                }
            }
        }
        audit.record("IMPORT_PROGRAM_COURSE", "COURSES", course, null, "strands=" + so + " chapters=" + ch + " lessons=" + le + " periods=" + pe);
        return new ConfirmResult(course, Map.of("strands", so, "chapters", ch, "lessons", le, "periods", pe));
    }

    public Derived tree(long courseId) {
        List<Row> rows = jdbc.query("""
            select p.id, coalesce(p.namespace, 'MAIN') namespace, p.term, p.period_no, p.week_no, s.code strand_code, s.name strand_name,
                   coalesce(c.numeral,'') chapter_numeral, coalesce(c.title,'') chapter_name,
                   l.title lesson_name, l.lesson_kind, coalesce(l.chapter_inferred_by, 'DATA') chapter_inferred_by
            from program_periods p join program_strands s on s.id=p.strand_id
            join lessons l on l.id=p.lesson_id left join chapters c on c.id=l.chapter_id
            where s.program_id=? and s.deleted_at is null and p.deleted_at is null and l.deleted_at is null
            order by s.order_index, c.order_index, l.order_index, p.term, p.period_no
            """, (rs, n) -> new Row(
                rs.getInt("id"),
                rs.getString("namespace"),
                rs.getString("strand_code"),
                rs.getString("strand_name"),
                rs.getInt("term"),
                rs.getInt("period_no"),
                rs.getInt("week_no"),
                rs.getString("chapter_numeral"),
                rs.getString("chapter_name"),
                rs.getString("lesson_name"),
                rs.getString("lesson_kind"),
                rs.getString("chapter_inferred_by")
        ), courseId);
        return derive(rows);
    }

    private String toOldKind(String kind) {
        return switch (kind) {
            case "EXAM" -> "KIEM_TRA";
            case "REVIEW" -> "ON_TAP";
            case "PRACTICE" -> "THUC_HANH";
            default -> "BAI_MOI";
        };
    }

    private Info readInfo(Sheet s) {
        if (s == null) throw new BusinessException("Thiếu tab Thông tin");
        Map<String, String> m = new HashMap<>();
        DataFormatter f = new DataFormatter();
        for (org.apache.poi.ss.usermodel.Row r : s) {
            m.put(f.formatCellValue(r.getCell(0)).trim().toUpperCase(Locale.ROOT), f.formatCellValue(r.getCell(1)).trim());
        }
        return new Info(required(m, "MÃ CHƯƠNG TRÌNH"), required(m, "TÊN CHƯƠNG TRÌNH"), required(m, "MÔN"), integer(m, "KHỐI"), integer(m, "TỔNG TIẾT"), integer(m, "TỔNG TUẦN"), integer(m, "PHIÊN BẢN"));
    }

    private String required(Map<String, String> m, String k) {
        String v = m.get(k);
        if (v == null || v.isBlank()) throw new BusinessException("Thiếu thông tin " + k);
        return v;
    }

    private Integer integer(Map<String, String> m, String k) {
        try {
            return Integer.valueOf(required(m, k));
        } catch (NumberFormatException e) {
            throw new BusinessException(k + " phải là số nguyên");
        }
    }

    public static String normalize(String value) {
        return Normalizer.normalize(value == null ? "" : value, Normalizer.Form.NFC).trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT);
    }
}
