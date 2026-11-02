package com.math10.programs;

import com.math10.programs.dto.ProgramCourseImportDtos.Issue;
import com.math10.programs.RawRow.InferredBy;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Validator duy nhất cho mọi định dạng (XLSX, DOCX, paste, PDF).
 * Chạy trên {@link RawTable}, không phụ thuộc nguồn gốc file.
 *
 * <p>Thích ứng với:
 * <ul>
 *   <li>Kiểu đánh số GLOBAL (1..105 xuyên suốt) hoặc PER_STRAND (1..N theo mạch)</li>
 *   <li>Chương đan xen song song (ví dụ: Hình học và Thống kê học xen kẽ các buổi)</li>
 *   <li>Thứ tự chương trong học kỳ không nhất thiết tăng tuần tự (HKII có thể học Chương VII trước Chương VI)</li>
 *   <li>Quy chuẩn nhịp bài học: Bài tập cuối chương thường 1 tiết, kiểm tra 2 tiết, ôn tập 1-2 tiết</li>
 * </ul>
 */
public final class RawTableValidator {

    private static final Set<String> VALID_KINDS = Set.of("LESSON", "REVIEW", "EXAM", "PRACTICE");
    private static final Pattern RANGE = Pattern.compile("(\\d+)\\s*[-\u2013\u2014]\\s*(\\d+)");
    private static final Pattern MULTI = Pattern.compile("\\d+(?:\\s*[+,]\\s*\\d+)+");

    private RawTableValidator() {}

    public record ValidationResult(List<Issue> errors, List<Issue> warnings) {
        public boolean hasErrors() { return !errors.isEmpty(); }
    }

    public static ValidationResult validate(RawTable table, Integer totalPeriods, Integer totalWeeks) {
        List<Issue> errors = new ArrayList<>();
        List<Issue> warnings = new ArrayList<>();
        List<RawRow> rows = table.rows();

        if (rows.isEmpty()) {
            errors.add(err(0, "Dữ liệu", "EMPTY", "Không có dòng dữ liệu"));
            return new ValidationResult(errors, warnings);
        }

        // --- 1. Học kỳ, Loại, Tuần cơ bản ---
        for (RawRow r : rows) {
            int sem = parseInt(r.semester(), -1);
            if (sem != 1 && sem != 2) {
                errors.add(err(r.sourceRow(), "HỌC KỲ", "INVALID_SEMESTER",
                        "Học kỳ phải là 1 hoặc 2, tìm thấy: '" + r.semester() + "'"));
            }

            String kind = normalizeKind(r.kind());
            if (!VALID_KINDS.contains(kind)) {
                errors.add(err(r.sourceRow(), "LOẠI", "INVALID_KIND",
                        "Loại '" + r.kind() + "' không hợp lệ; chỉ nhận LESSON, REVIEW, EXAM, PRACTICE"));
            }

            if (totalWeeks != null) {
                int weekStart = parseWeekStart(r.weekRange());
                if (weekStart > 0 && weekStart > totalWeeks) {
                    errors.add(err(r.sourceRow(), "TUẦN", "WEEK_OUT_OF_RANGE",
                            "Tuần " + weekStart + " vượt tổng " + totalWeeks + " tuần"));
                }
            }
        }

        // --- 2. Tổng số tiết (nếu có khai báo) ---
        // DOCX/PDF thường gộp nhiều tiết trong một dòng (ví dụ "7-10").
        // Vì vậy phải cộng độ dài dải tiết, không được dùng số dòng thô.
        int detectedPeriods = rows.stream()
                .mapToInt(r -> Math.max(1, countPeriods(r.periodRange())))
                .sum();
        if (totalPeriods != null && totalPeriods != detectedPeriods) {
            errors.add(err(0, "TỔNG TIẾT", "TOTAL_MISMATCH",
                    "Khai báo " + totalPeriods + " tiết nhưng dữ liệu có " + detectedPeriods + " tiết"));
        }

        // --- 3. Một bài không thuộc hai chương khác nhau ---
        Map<String, String> lessonChapter = new LinkedHashMap<>();
        for (RawRow r : rows) {
            String ln = r.normalizedLessonName();
            String ch = normalizeChapter(r.chapterNumeral(), r.chapterName());
            if (ln.isBlank() || isTransitional(r.lessonName())) continue;
            String existing = lessonChapter.putIfAbsent(ln, ch);
            if (existing != null && !existing.equals(ch)) {
                errors.add(err(r.sourceRow(), "BÀI HỌC", "LESSON_IN_MULTIPLE_CHAPTERS",
                        "Bài '" + r.lessonName() + "' xuất hiện ở hai chương khác nhau ('" + existing + "' và '" + ch + "')"));
            }
        }

        // --- 4. Một chương không thuộc hai mạch khác nhau ---
        Map<String, String> chapterStrand = new LinkedHashMap<>();
        for (RawRow r : rows) {
            if (r.strandCode() == null || r.strandCode().isBlank()) continue;
            String ch = normalizeChapter(r.chapterNumeral(), r.chapterName());
            if (ch.isBlank()) continue;
            String existing = chapterStrand.putIfAbsent(ch, r.strandCode());
            if (existing != null && !existing.equals(r.strandCode())) {
                errors.add(err(r.sourceRow(), "CHƯƠNG", "CHAPTER_IN_MULTIPLE_STRANDS",
                        "Chương '" + ch + "' thuộc cả mạch " + existing + " và " + r.strandCode()));
            }
        }

        // --- 5. Kiểm tra tính liên tục của tiết & tuần theo Style và Namespace ---
        Map<String, List<RawRow>> groups = groupForPeriodCheck(rows, table.style());
        for (Map.Entry<String, List<RawRow>> entry : groups.entrySet()) {
            List<RawRow> group = entry.getValue().stream()
                    .sorted(Comparator.comparingInt(r -> parseSinglePeriod(r.periodRange())))
                    .toList();
            validatePeriodSequence(group, table.style(), errors);
        }

        // --- 6. Cảnh báo thông minh theo phân tích KHDH thực tế ---
        for (RawRow r : rows) {
            String kind = normalizeKind(r.kind());
            int periodCount = countPeriods(r.periodRange());

            // a. EXAM có gắn chương
            if ("EXAM".equals(kind) && !r.chapterNumeral().isBlank()) {
                warnings.add(warn(r.sourceRow(), "CHƯƠNG", "EXAM_HAS_CHAPTER",
                        "Bài kiểm tra thường không thuộc chương"));
            }

            // b. Bài tập cuối chương chuẩn là 1 tiết
            if ("REVIEW".equals(kind) && r.lessonName().toLowerCase(Locale.ROOT).contains("cuối chương") && periodCount > 1) {
                warnings.add(warn(r.sourceRow(), "TIẾT", "REVIEW_PERIOD_COUNT",
                        "Bài tập cuối chương thường bố trí 1 tiết, hiện đang là " + periodCount + " tiết"));
            }

            // c. Bài kiểm tra chuẩn là 2 tiết (giữa kỳ/cuối kỳ)
            if ("EXAM".equals(kind) && periodCount != 2 && periodCount > 0) {
                warnings.add(warn(r.sourceRow(), "TIẾT", "EXAM_PERIOD_COUNT",
                        "Bài kiểm tra thường là 2 tiết, hiện ghi " + periodCount + " tiết"));
            }

            // d. Chương suy đoán / Thiếu chương
            if (r.chapterInferredBy() == InferredBy.INHERITED) {
                warnings.add(warn(r.sourceRow(), "CHƯƠNG", "CHAPTER_INFERRED",
                        "Bài '" + r.lessonName() + "' không ghi chương — ĐÃ ĐOÁN bằng bài liền trước: " +
                        r.chapterNumeral() + " " + r.chapterName() + " — bắt buộc admin xác nhận"));
            } else if (r.chapterInferredBy() == InferredBy.MISSING && !isTransitional(r.lessonName())) {
                warnings.add(warn(r.sourceRow(), "CHƯƠNG", "CHAPTER_MISSING",
                        "Bài '" + r.lessonName() + "' không có tiền tố chương"));
            }

            // e. Phát hiện thiếu số hiệu bài (ví dụ như "Hàm số" ở dòng 28 KNTT thiếu "Bài 15.")
            if (!isTransitional(r.lessonName()) && !r.lessonName().matches("(?i)^(bài\\s*\\d+|chuyên đề\\s*\\d+).*")) {
                warnings.add(warn(r.sourceRow(), "BÀI HỌC", "LESSON_NUMBER_MISSING",
                        "Tên bài '" + r.lessonName() + "' dường như thiếu số hiệu bài học (ví dụ: 'Bài X.')"));
            }
        }

        // --- 7. Cảnh báo mạch quá ít tiết ---
        Map<String, Long> strandCount = rows.stream()
                .filter(r -> r.strandCode() != null && !r.strandCode().isBlank())
                .collect(Collectors.groupingBy(RawRow::strandCode, Collectors.counting()));
        strandCount.forEach((code, count) -> {
            if (count < 3) {
                warnings.add(warn(0, "MẠCH", "STRAND_TOO_FEW_PERIODS",
                        "Mạch '" + code + "' chỉ có " + count + " tiết — có thể là lỗi gán mạch"));
            }
        });

        return new ValidationResult(List.copyOf(errors), List.copyOf(warnings));
    }

    // ==================== Logic kiểm tra chuỗi tiết ====================

    private static Map<String, List<RawRow>> groupForPeriodCheck(
            List<RawRow> rows, RawTable.PeriodNumberingStyle style) {
        return rows.stream().collect(Collectors.groupingBy(r -> {
            String strand = style == RawTable.PeriodNumberingStyle.PER_STRAND
                    ? coalesce(r.strandCode(), "UNKNOWN")
                    : "ALL";
            return r.namespace() + "|" + strand + "|" + r.semester();
        }, LinkedHashMap::new, Collectors.toList()));
    }

    private static void validatePeriodSequence(
            List<RawRow> sorted, RawTable.PeriodNumberingStyle style, List<Issue> errors) {
        int lastPeriodEnd = 0;
        int lastWeek = 0;

        for (RawRow r : sorted) {
            int pStart = parseSinglePeriod(r.periodRange());
            int pEnd = parsePeriodEnd(r.periodRange());
            if (pStart < 0) continue;

            if (style == RawTable.PeriodNumberingStyle.PER_STRAND) {
                if (lastPeriodEnd > 0 && pStart != lastPeriodEnd + 1) {
                    errors.add(err(r.sourceRow(), "TIẾT", "PERIOD_NOT_CONTIGUOUS",
                            "Tiết trong mỗi mạch/học kỳ phải liên tục: mong đợi tiết " + (lastPeriodEnd + 1) + " nhưng gặp " + pStart));
                }
            } else {
                // GLOBAL style: tiết phải tăng đơn điệu
                if (lastPeriodEnd > 0 && pStart < lastPeriodEnd) {
                    errors.add(err(r.sourceRow(), "TIẾT", "PERIOD_DECREASES",
                            "Số tiết giảm: tiết trước kết thúc ở " + lastPeriodEnd + ", tiết sau bắt đầu từ " + pStart));
                }
            }
            lastPeriodEnd = Math.max(lastPeriodEnd, pEnd > 0 ? pEnd : pStart);

            int w = parseWeekStart(r.weekRange());
            if (w > 0 && w < lastWeek) {
                errors.add(err(r.sourceRow(), "TUẦN", "WEEK_DECREASES",
                        "Tuần không được giảm khi tiết tăng (từ tuần " + lastWeek + " về tuần " + w + ")"));
            }
            if (w > 0) lastWeek = Math.max(lastWeek, w);
        }
    }

    // ==================== Parsing & Helpers ====================

    private static int parseSinglePeriod(String raw) {
        if (raw == null || raw.isBlank()) return -1;
        Matcher m = RANGE.matcher(raw.trim());
        if (m.find()) return Integer.parseInt(m.group(1));
        try { return Integer.parseInt(raw.trim().replaceAll("[^0-9]", "")); }
        catch (NumberFormatException e) { return -1; }
    }

    private static int parsePeriodEnd(String raw) {
        if (raw == null || raw.isBlank()) return -1;
        Matcher m = RANGE.matcher(raw.trim());
        if (m.find()) return Integer.parseInt(m.group(2));
        try { return Integer.parseInt(raw.trim().replaceAll("[^0-9]", "")); }
        catch (NumberFormatException e) { return -1; }
    }

    private static int countPeriods(String raw) {
        if (raw == null || raw.isBlank()) return 0;
        Matcher m = RANGE.matcher(raw.trim());
        if (m.find()) {
            int start = Integer.parseInt(m.group(1));
            int end = Integer.parseInt(m.group(2));
            return end >= start ? (end - start + 1) : 0;
        }
        return parseSinglePeriod(raw) > 0 ? 1 : 0;
    }

    private static int parseWeekStart(String raw) {
        if (raw == null || raw.isBlank()) return -1;
        Matcher m = MULTI.matcher(raw.trim());
        if (m.matches()) {
            String[] nums = raw.trim().replaceAll("[^0-9 ]", " ").trim().split("\\s+");
            try { return Integer.parseInt(nums[0]); } catch (Exception e) { return -1; }
        }
        try { return Integer.parseInt(raw.trim().replaceAll("[^0-9]", "")); }
        catch (NumberFormatException e) { return -1; }
    }

    private static int parseInt(String s, int def) {
        if (s == null || s.isBlank()) return def;
        try { return Integer.parseInt(s.trim()); } catch (NumberFormatException e) { return def; }
    }

    private static String normalizeKind(String raw) {
        if (raw == null) return "";
        return switch (raw.trim().toUpperCase(Locale.ROOT)) {
            case "BAI_MOI", "LESSON" -> "LESSON";
            case "ON_TAP", "REVIEW" -> "REVIEW";
            case "KIEM_TRA", "EXAM" -> "EXAM";
            case "THUC_HANH", "PRACTICE" -> "PRACTICE";
            default -> raw.trim().toUpperCase(Locale.ROOT);
        };
    }

    private static String normalizeChapter(String numeral, String name) {
        return ((numeral == null ? "" : numeral.trim()) + " " +
                (name == null ? "" : name.trim())).trim().toLowerCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
    }

    private static boolean isTransitional(String lessonName) {
        if (lessonName == null) return false;
        String up = lessonName.toUpperCase(Locale.ROOT);
        return up.contains("ÔN TẬP") || up.contains("ON TAP") ||
               up.contains("KIỂM TRA") || up.contains("KIEM TRA") ||
               up.contains("HĐTHTN") || up.contains("HDTHTN") ||
               up.contains("HOẠT ĐỘNG TRẢI NGHIỆM");
    }

    private static String coalesce(String s, String fallback) {
        return (s == null || s.isBlank()) ? fallback : s;
    }

    private static Issue err(int row, String col, String code, String msg) {
        return new Issue(row, col, code, msg);
    }
    private static Issue warn(int row, String col, String code, String msg) {
        return new Issue(row, col, "[WARN] " + code, msg);
    }
}
