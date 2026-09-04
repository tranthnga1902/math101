package com.math10.programs;

import com.math10.common.exception.BusinessException;

import java.util.*;

/**
 * Adapter clipboard paste → {@link RawTable}.
 *
 * <p>Admin copy bảng từ Excel/Word rồi dán vào {@code textarea}.
 * Định dạng TSV: cột tách bằng tab, dòng tách bằng LF/CRLF.
 *
 * <h3>Xử lý ba trường hợp đặc biệt</h3>
 * <ol>
 *   <li><b>Ô có nhiều dòng</b>: Excel bọc ô có newline trong dấu nháy kép.
 *       Parser theo RFC-4180 xử lý đúng.</li>
 *   <li><b>Tab trong ô</b>: Cũng bọc trong dấu nháy kép, được xử lý.</li>
 *   <li><b>Dòng đầu là tiêu đề</b>: Checkbox {@code hasHeader} cho admin chọn.
 *       Nếu {@code true}, dòng đầu được dùng để gán cột; nếu {@code false},
 *       hệ dùng {@code mapping} mặc định theo vị trí.</li>
 * </ol>
 *
 * <h3>Thứ tự cột mặc định (khi không có header)</h3>
 * {@code namespace, strandCode, strandName, semester, periodRange, weekRange,
 * chapterNumeral, chapterName, lessonName, kind}
 */
public final class PasteAdapter {

    private static final int MAX_ROWS = 5000;

    /** Tên trường hợp lệ cho gán cột thủ công. */
    public static final List<String> FIELD_NAMES = List.of(
            "namespace", "strandCode", "strandName", "semester",
            "periodRange", "weekRange", "chapterNumeral", "chapterName",
            "lessonName", "kind"
    );

    private PasteAdapter() {}

    /**
     * Parse văn bản TSV.
     *
     * @param tsv       văn bản dán từ clipboard
     * @param hasHeader {@code true} nếu dòng đầu là tiêu đề cột
     * @param mapping   ánh xạ vị trí cột → tên trường; null = dùng mặc định theo thứ tự
     * @return RawTable đã phát hiện style
     */
    public static RawTable parse(String tsv, boolean hasHeader, Map<Integer, String> mapping) {
        if (tsv == null || tsv.isBlank()) throw new BusinessException("Nội dung dán vào rỗng");

        List<List<String>> cells = parseTsv(tsv);
        if (cells.isEmpty()) throw new BusinessException("Không tách được dòng nào từ nội dung đã dán");

        // Gán cột
        Map<Integer, String> colMap = resolveMapping(cells, hasHeader, mapping);

        // Bỏ dòng header nếu có
        int dataStart = hasHeader ? 1 : 0;

        List<RawRow> rows = new ArrayList<>();
        for (int i = dataStart; i < cells.size() && rows.size() < MAX_ROWS; i++) {
            List<String> row = cells.get(i);
            if (isBlankRow(row)) continue;

            String lessonName = get(row, colMap, "lessonName");
            if (lessonName.isBlank()) continue; // bỏ dòng không có bài học

            String namespace = get(row, colMap, "namespace");
            if (namespace.isBlank()) namespace = "MAIN";

            rows.add(RawRow.of(
                    i + 1,
                    namespace,
                    get(row, colMap, "strandCode"),
                    get(row, colMap, "strandName"),
                    get(row, colMap, "semester"),
                    get(row, colMap, "periodRange"),
                    get(row, colMap, "weekRange"),
                    get(row, colMap, "chapterNumeral"),
                    get(row, colMap, "chapterName"),
                    lessonName,
                    get(row, colMap, "kind")
            ));
        }

        if (rows.isEmpty()) throw new BusinessException("Không có dòng dữ liệu hợp lệ sau khi lọc dòng trống");

        RawTable.PeriodNumberingStyle style = RawTable.detectStyle(rows);
        return new RawTable(rows, style, null);
    }

    /** Overload không có mapping — dùng thứ tự cột mặc định. */
    public static RawTable parse(String tsv, boolean hasHeader) {
        return parse(tsv, hasHeader, null);
    }

    // ==================== TSV Parser (RFC-4180 style) ====================

    /**
     * Tách TSV theo RFC-4180:
     * - Dấu tab phân tách cột
     * - LF/CRLF phân tách dòng
     * - Ô bọc nháy kép: {@code "nội dung"}, nháy kép trong ô: {@code ""}
     */
    static List<List<String>> parseTsv(String text) {
        List<List<String>> result = new ArrayList<>();
        List<String> currentRow = new ArrayList<>();
        StringBuilder field = new StringBuilder();
        boolean inQuotes = false;
        char[] chars = text.toCharArray();

        for (int i = 0; i < chars.length; i++) {
            char c = chars[i];

            if (inQuotes) {
                if (c == '"') {
                    // Có thể là nháy kép thoát ("") hoặc kết thúc ô
                    if (i + 1 < chars.length && chars[i + 1] == '"') {
                        field.append('"');
                        i++; // bỏ qua nháy thứ hai
                    } else {
                        inQuotes = false;
                    }
                } else {
                    field.append(c);
                }
            } else {
                switch (c) {
                    case '"' -> inQuotes = true;
                    case '\t' -> {
                        currentRow.add(field.toString());
                        field.setLength(0);
                    }
                    case '\r' -> { /* bỏ qua CR của CRLF */ }
                    case '\n' -> {
                        currentRow.add(field.toString());
                        field.setLength(0);
                        result.add(currentRow);
                        currentRow = new ArrayList<>();
                    }
                    default -> field.append(c);
                }
            }
        }
        // Dòng cuối không có newline
        if (field.length() > 0 || !currentRow.isEmpty()) {
            currentRow.add(field.toString());
            result.add(currentRow);
        }

        // Bỏ dòng cuối nếu chỉ có một ô rỗng (thường do paste trailing newline)
        if (!result.isEmpty()) {
            List<String> last = result.get(result.size() - 1);
            if (last.size() == 1 && last.get(0).isBlank()) result.remove(result.size() - 1);
        }

        return result;
    }

    // ==================== Column mapping ====================

    /**
     * Xây dựng ánh xạ cột → tên trường.
     * Ưu tiên: mapping tường minh > header row (fuzzy match) > thứ tự mặc định.
     */
    private static Map<Integer, String> resolveMapping(
            List<List<String>> cells, boolean hasHeader, Map<Integer, String> explicit) {
        if (explicit != null && !explicit.isEmpty()) return explicit;

        if (hasHeader && !cells.isEmpty()) {
            return ColumnMatcher.matchHeaders(cells.get(0), null);
        }

        // Thứ tự mặc định theo FIELD_NAMES
        Map<Integer, String> defaultMap = new LinkedHashMap<>();
        for (int i = 0; i < FIELD_NAMES.size(); i++) {
            defaultMap.put(i, FIELD_NAMES.get(i));
        }
        return defaultMap;
    }

    private static String get(List<String> row, Map<Integer, String> colMap, String field) {
        for (Map.Entry<Integer, String> e : colMap.entrySet()) {
            if (e.getValue().equals(field)) {
                int idx = e.getKey();
                return idx < row.size() ? row.get(idx).trim() : "";
            }
        }
        return "";
    }

    private static boolean isBlankRow(List<String> row) {
        return row.stream().allMatch(String::isBlank);
    }
}
