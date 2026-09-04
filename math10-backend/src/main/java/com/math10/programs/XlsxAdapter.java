package com.math10.programs;

import com.math10.common.exception.BusinessException;
import org.apache.poi.ss.usermodel.*;

import java.io.InputStream;
import java.util.*;

/**
 * Adapter XLSX/XLS → {@link RawTable}.
 * Đọc tab "Dữ liệu" (hoặc sheet đầu tiên).
 *
 * <p>Cột bắt buộc: MẠCH, HỌC KỲ, TIẾT, TUẦN, BÀI HỌC, LOẠI.
 * Cột tùy chọn: TÊN MẠCH, CHƯƠNG, TÊN CHƯƠNG, NAMESPACE.
 */
public final class XlsxAdapter {

    private static final int MAX_ROWS = 5000;

    private XlsxAdapter() {}

    public static RawTable read(InputStream in) {
        try (Workbook wb = WorkbookFactory.create(in)) {
            Sheet sheet = Optional.ofNullable(wb.getSheet("Dữ liệu")).orElse(wb.getSheetAt(0));
            DataFormatter fmt = new DataFormatter();

            Row headerRow = sheet.getRow(0);
            if (headerRow == null) throw new BusinessException("Sheet không có dòng tiêu đề");
            Map<String, Integer> cols = columns(headerRow, fmt);

            List<RawRow> rows = new ArrayList<>();
            for (int i = 1; i <= sheet.getLastRowNum() && rows.size() < MAX_ROWS; i++) {
                Row r = sheet.getRow(i);
                if (r == null) continue;
                String strandCode = cell(r, cols, "MẠCH", fmt);
                String lessonName = cell(r, cols, "BÀI HỌC", fmt);
                if (strandCode.isBlank() && lessonName.isBlank()) continue; // bỏ dòng rỗng

                String namespace = cell(r, cols, "NAMESPACE", fmt);
                if (namespace.isBlank()) namespace = "MAIN";

                rows.add(RawRow.of(
                        i + 1,
                        namespace,
                        strandCode,
                        cell(r, cols, "TÊN MẠCH", fmt),
                        cell(r, cols, "HỌC KỲ", fmt),
                        cell(r, cols, "TIẾT", fmt),
                        cell(r, cols, "TUẦN", fmt),
                        cell(r, cols, "CHƯƠNG", fmt),
                        cell(r, cols, "TÊN CHƯƠNG", fmt),
                        lessonName,
                        cell(r, cols, "LOẠI", fmt)
                ));
            }

            RawTable.PeriodNumberingStyle style = RawTable.detectStyle(rows);
            return new RawTable(rows, style, null);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Không đọc được file Excel: " + e.getMessage());
        }
    }

    private static Map<String, Integer> columns(Row header, DataFormatter fmt) {
        Map<String, Integer> m = new LinkedHashMap<>();
        for (Cell c : header) {
            String key = normalizeHeader(fmt.formatCellValue(c));
            if (!key.isBlank()) m.put(key, c.getColumnIndex());
        }
        return m;
    }

    private static String cell(Row r, Map<String, Integer> cols, String key, DataFormatter fmt) {
        Integer idx = cols.get(key);
        if (idx == null) return "";
        Cell c = r.getCell(idx);
        return c == null ? "" : fmt.formatCellValue(c).trim();
    }

    private static String normalizeHeader(String raw) {
        if (raw == null) return "";
        return java.text.Normalizer
                .normalize(raw.trim(), java.text.Normalizer.Form.NFC)
                .toUpperCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
    }
}
