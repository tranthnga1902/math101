package com.math10.programs;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Tập hợp các {@link RawRow} cùng metadata phát hiện tự động.
 * Output của mọi adapter (XLSX, DOCX, paste, PDF).
 */
public record RawTable(
        List<RawRow> rows,
        PeriodNumberingStyle style,
        String detectedBookSeries    // "KNTT" | "CTST" | "CD" | null
) {
    /**
     * Kiểu đánh số tiết trong file.
     * <ul>
     *   <li>GLOBAL — một bộ đếm chung xuyên suốt (1→105), phổ biến trong KHDH trường.</li>
     *   <li>PER_STRAND — mỗi mạch đánh lại từ 1; phổ biến trong PPCT chuẩn.</li>
     * </ul>
     */
    public enum PeriodNumberingStyle { GLOBAL, PER_STRAND }

    /**
     * Tự dò {@link PeriodNumberingStyle} từ dữ liệu thô.
     * Heuristic: nếu max periodNo < 0.4 × số dòng có periodNo nguyên → PER_STRAND.
     */
    public static PeriodNumberingStyle detectStyle(List<RawRow> rows) {
        long countWithParseable = rows.stream()
                .filter(r -> parseSingleInt(r.periodRange()) >= 0)
                .count();
        if (countWithParseable == 0) return PeriodNumberingStyle.GLOBAL;

        int maxPeriod = rows.stream()
                .mapToInt(r -> parseSingleInt(r.periodRange()))
                .max().orElse(0);

        // Nếu số tiết max nhỏ hơn 40% số dòng → mỗi mạch đánh lại từ 1
        return maxPeriod < countWithParseable * 0.4
                ? PeriodNumberingStyle.PER_STRAND
                : PeriodNumberingStyle.GLOBAL;
    }

    private static int parseSingleInt(String raw) {
        if (raw == null || raw.isBlank()) return -1;
        String cleaned = raw.trim().replaceAll("[^0-9]", "");
        try { return Integer.parseInt(cleaned); } catch (NumberFormatException e) { return -1; }
    }

    /** Các namespace duy nhất trong bảng. */
    public Set<String> namespaces() {
        return rows.stream().map(RawRow::namespace).collect(Collectors.toSet());
    }
}
