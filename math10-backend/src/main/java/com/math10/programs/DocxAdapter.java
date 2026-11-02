package com.math10.programs;

import com.math10.common.exception.BusinessException;
import org.apache.poi.xwpf.usermodel.*;

import java.io.ByteArrayInputStream;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Adapter DOCX → {@link RawTable}.
 *
 * <p>Được thiết kế dựa trên phân tích file KHDH thực tế của các trường (ví dụ KNTT 10):
 * <ul>
 *   <li><b>Tự tìm bảng KHDH</b>: Tìm bảng có ≥3 cột và có header chứa "TIẾT" và "BÀI"/"CHỦ ĐỀ".</li>
 *   <li><b>Nhiều bảng song song</b>: Bảng chính khóa (MAIN, 105 tiết) và Bảng chuyên đề (CĐ, 35 tiết).</li>
 *   <li><b>Chống trùng ô gộp dọc</b>: POI trả lặp lại nội dung ô gộp cho mọi dòng nó bao;
 *       dùng khóa {@code (tên bài, dải tiết, học kỳ)} để loại bỏ dòng rác do vMerge.</li>
 *   <li><b>Nhận diện dòng phân cách học kỳ</b>: Tự động đổi học kỳ khi gặp "HỌC KỲ I/II".</li>
 *   <li><b>Bóc tách chương từ tiêu đề</b>: Nhận diện cả "Chương I. Bài 1", "ChươngV. Bài 14",...</li>
 *   <li><b>Theo dõi nguồn gốc chương</b>: Đánh dấu {@link RawRow.InferredBy#DATA},
 *       {@link RawRow.InferredBy#INHERITED}, hoặc {@link RawRow.InferredBy#MISSING}.</li>
 * </ul>
 */
public final class DocxAdapter {

    private static final int MAX_ROWS = 5000;

    private static final Pattern HOC_KY_2 = Pattern.compile(
            "(?i)(h[oọ]c\\s*k[yỳ]\\s*(II|2)\\b|\\bHKII\\b|semester\\s*2|term\\s*2|k[yỳ]\\s*2)");
    private static final Pattern HOC_KY_1 = Pattern.compile(
            "(?i)(h[oọ]c\\s*k[yỳ]\\s*(I|1)\\b|\\bHKI\\b|semester\\s*1|term\\s*1|k[yỳ]\\s*1)");

    private static final Pattern CHUONG_PATTERN = Pattern.compile(
            "(?iu)^\\s*ch[uư][oơ]ng\\s*([IVXLCDM0-9]+)\\s*[.:\\-]?\\s*(.*?)$");
    private static final Pattern CHUYEN_DE_PATTERN = Pattern.compile(
            "(?iu)^\\s*chuy[eê]n\\s*đ[eề]\\s*(\\d+)\\s*[.:\\-]?\\s*(.*?)$");
    private static final Pattern CUOI_CHUONG_PATTERN = Pattern.compile(
            "(?iu).*(?:b[aà]i\\s*t[aậ]p|[oô]n\\s*t[aậ]p)\\s*cu[oố]i\\s*ch[uư][oơ]ng\\s*([IVXLCDM0-9]+).*");

    private DocxAdapter() {}

    public static RawTable read(byte[] bytes) {
        try (XWPFDocument docx = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            List<RawRow> allRows = new ArrayList<>();
            int currentSemester = 1;
            String detectedSeries = null;

            // Đọc cả đoạn văn lẫn phần đầu các bảng: nhiều file đặt tên bộ sách trong một bảng bìa.
            for (XWPFParagraph p : docx.getParagraphs()) {
                detectedSeries = detectSeries(p.getText(), detectedSeries);
            }
            for (XWPFTable table : docx.getTables()) {
                for (int r = 0; r < Math.min(3, table.getNumberOfRows()); r++) {
                    detectedSeries = detectSeries(rowText(table.getRow(r).getTableCells()), detectedSeries);
                }
            }

            for (XWPFTable table : docx.getTables()) {
                if (table.getNumberOfRows() < 2) continue;

                // Nhận diện cột từ header
                ColIndices cols = findHeader(table);
                if (cols == null) continue;

                // Xác định namespace từ ngữ cảnh bảng (nếu có chữ "Chuyên đề" -> namespace CĐ)
                String namespace = guessNamespace(table);

                String lastChapterNumeral = "";
                String lastChapterName = "";
                String lastWeek = "";
                Set<String> seenRows = new HashSet<>();

                for (int r = cols.headerRow + 1; r < table.getNumberOfRows() && allRows.size() < MAX_ROWS; r++) {
                    XWPFTableRow row = table.getRow(r);
                    if (row == null) continue;
                    List<XWPFTableCell> cells = row.getTableCells();
                    String fullText = rowText(cells);

                    // Kiểm tra dòng phân cách học kỳ
                    if (isSemesterRow(fullText)) {
                        String semesterText = ColumnMatcher.normalizeHeader(fullText);
                        if (semesterText.matches(".*(?:hoc ky|hkii|semester|term)\\s*(?:ii|2)(?:\\s|$).*")
                                || HOC_KY_2.matcher(fullText).find()) currentSemester = 2;
                        else if (semesterText.matches(".*(?:hoc ky|hki|semester|term)\\s*(?:i|1)(?:\\s|$).*")
                                || HOC_KY_1.matcher(fullText).find()) currentSemester = 1;
                        continue;
                    }

                    String rawWeek = cellText(cells, cols.cWeek);
                    String rawTitle = cellText(cells, cols.cTitle);
                    String rawPeriod = cellText(cells, cols.cPeriod);

                    if (rawTitle.isBlank() && rawPeriod.isBlank()) continue;

                    // Chuẩn hóa dải tiết và tuần
                    String cleanPeriod = cleanPeriodRange(rawPeriod);
                    String cleanWeek = cleanRange(rawWeek);
                    if (cleanWeek.isBlank()) cleanWeek = lastWeek;
                    else lastWeek = cleanWeek;

                    // Chống trùng lặp do ô gộp (vMerge)
                    String dupKey = cleanPeriod + "|" + currentSemester + "|" + ColumnMatcher.normalizeHeader(rawTitle);
                    if (!seenRows.add(dupKey)) {
                        continue; // Bỏ qua dòng lặp
                    }

                    // Tách chương và bài học từ tiêu đề
                    TitleParseResult t = parseTitle(rawTitle, lastChapterNumeral, lastChapterName);
                    if (!t.chapterNumeral().isBlank()) {
                        lastChapterNumeral = t.chapterNumeral();
                        lastChapterName = t.chapterName();
                    }

                    String kind = inferKind(t.lessonName());

                    allRows.add(new RawRow(
                            allRows.size() + 1,
                            namespace,
                            "", // mã mạch suy luận ở tầng sau
                            "",
                            String.valueOf(currentSemester),
                            cleanPeriod,
                            cleanWeek,
                            t.chapterNumeral(),
                            t.chapterName(),
                            t.lessonName(),
                            kind,
                            t.inferredBy()
                    ));
                }
            }

            if (allRows.isEmpty()) {
                throw new BusinessException("Không tìm thấy bảng kế hoạch dạy học hợp lệ trong file Word");
            }

            RawTable.PeriodNumberingStyle style = RawTable.detectStyle(allRows);
            return new RawTable(allRows, style, detectedSeries);
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Lỗi xử lý file Word .docx: " + e.getMessage());
        }
    }

    private static String guessNamespace(XWPFTable table) {
        for (int r = 0; r < Math.min(12, table.getNumberOfRows()); r++) {
            String text = ColumnMatcher.normalizeHeader(rowText(table.getRow(r).getTableCells()));
            if (text.contains("chuyen de") || text.matches(".*\\bcd\\s*\\d+.*")) return "CĐ";
        }
        return "MAIN";
    }

    private static ColIndices findHeader(XWPFTable table) {
        for (int r = 0; r < Math.min(3, table.getNumberOfRows()); r++) {
            XWPFTableRow row = table.getRow(r);
            List<XWPFTableCell> cells = row.getTableCells();
            int cWeek = -1, cTitle = -1, cPeriod = -1;

            for (int i = 0; i < cells.size(); i++) {
                String h = ColumnMatcher.normalizeHeader(cells.get(i).getText());
                if (cWeek < 0 && (h.contains("tuan") || h.contains("week"))) cWeek = i;
                else if (cPeriod < 0 && (h.contains("tiet") || h.contains("period"))) cPeriod = i;
                else if (cTitle < 0 && (h.contains("bai") || h.contains("chu de") || h.contains("noi dung"))) cTitle = i;
            }

            if (cPeriod >= 0 && (cTitle >= 0 || cells.size() >= 3)) {
                if (cTitle < 0) cTitle = cPeriod == 0 ? 1 : (cPeriod == 1 ? 0 : 1);
                if (cWeek < 0) cWeek = (cPeriod != 0 && cTitle != 0) ? 0 : -1;
                return new ColIndices(r, cWeek, cTitle, cPeriod);
            }
        }
        return null;
    }

    record TitleParseResult(String chapterNumeral, String chapterName, String lessonName, RawRow.InferredBy inferredBy) {}

    private static TitleParseResult parseTitle(String raw, String lastNum, String lastName) {
        String clean = raw.trim();
        Matcher m = CHUONG_PATTERN.matcher(clean);
        if (m.find()) {
            String num = m.group(1).toUpperCase(Locale.ROOT);
            String rest = m.group(2).trim();
            return new TitleParseResult(num, "Chương " + num, rest, RawRow.InferredBy.DATA);
        }

        Matcher special = CHUYEN_DE_PATTERN.matcher(clean);
        if (special.find()) {
            String num = special.group(1);
            String rest = special.group(2).trim();
            return new TitleParseResult("CĐ" + num, "Chuyên đề " + num, rest, RawRow.InferredBy.DATA);
        }

        Matcher review = CUOI_CHUONG_PATTERN.matcher(clean);
        if (review.find()) {
            String num = review.group(1).toUpperCase(Locale.ROOT);
            return new TitleParseResult(num, "Chương " + num, clean, RawRow.InferredBy.DATA);
        }

        String normalized = ColumnMatcher.normalizeHeader(clean);
        if (normalized.contains("hdth") || normalized.contains("hoat dong thuc hanh")
                || normalized.contains("hoat dong trai nghiem")) {
            return new TitleParseResult("HĐTN", "Hoạt động thực hành và trải nghiệm", clean,
                    RawRow.InferredBy.DATA);
        }
        if (normalized.contains("kiem tra") || normalized.contains("on tap giua hoc")
                || normalized.contains("on tap cuoi hoc")) {
            return new TitleParseResult("ĐG", "Kiểm tra và đánh giá", clean, RawRow.InferredBy.DATA);
        }

        // Nếu bài không ghi chương rõ ràng
        if (isTransitionalTitle(clean)) {
            return new TitleParseResult("", "", clean, RawRow.InferredBy.DATA);
        }

        // Thừa hưởng chương từ bài trước nếu có
        if (!lastNum.isBlank()) {
            return new TitleParseResult(lastNum, lastName, clean, RawRow.InferredBy.INHERITED);
        }

        return new TitleParseResult("", "", clean, RawRow.InferredBy.MISSING);
    }

    private static String inferKind(String title) {
        String up = title.toUpperCase(Locale.ROOT);
        if (up.contains("KIỂM TRA") || up.contains("KIEM TRA") || up.startsWith("THI ")) return "EXAM";
        if (up.contains("ÔN TẬP") || up.contains("ON TAP") || up.contains("BÀI TẬP CUỐI CHƯƠNG") || up.contains("LUYỆN TẬP")) return "REVIEW";
        if (up.contains("THỰC HÀNH") || up.contains("THUC HANH") || up.contains("HĐTHTN") || up.contains("HOẠT ĐỘNG TRẢI NGHIỆM")) return "PRACTICE";
        return "LESSON";
    }

    private static boolean isSemesterRow(String text) {
        String normalized = ColumnMatcher.normalizeHeader(text);
        return normalized.contains("hoc ky") || normalized.equals("hki") || normalized.equals("hkii")
                || normalized.startsWith("semester") || normalized.startsWith("term");
    }

    private static boolean isTransitionalTitle(String text) {
        String up = text.toUpperCase(Locale.ROOT);
        return up.contains("ÔN TẬP") || up.contains("KIỂM TRA") || up.contains("HĐTHTN") || up.contains("HOẠT ĐỘNG");
    }

    private static String cleanRange(String raw) {
        if (raw == null) return "";
        return raw.trim().replaceAll("\\s*[-\u2013\u2014]\\s*", "-").replaceAll("\\s*[+,]\\s*", "+");
    }

    /** "CĐ1-CĐ5" và "Tiết 1 – 4" đều được đưa về cùng dạng 1-5 / 1-4. */
    private static String cleanPeriodRange(String raw) {
        String cleaned = cleanRange(raw);
        Matcher range = Pattern.compile("(?iu).*?(\\d+)-(?:[A-ZĐ]+)?\\s*(\\d+).*?").matcher(cleaned);
        if (range.matches()) return range.group(1) + "-" + range.group(2);
        Matcher single = Pattern.compile("(?iu).*?(\\d+).*?").matcher(cleaned);
        return single.matches() ? single.group(1) : cleaned;
    }

    private static String detectSeries(String text, String current) {
        if (text == null || text.isBlank()) return current;
        String normalized = ColumnMatcher.normalizeHeader(text);
        if (normalized.contains("ket noi tri thuc") || normalized.matches(".*\\bkntt\\b.*")) return "KNTT";
        if (normalized.contains("chan troi sang tao") || normalized.matches(".*\\bctst\\b.*")) return "CTST";
        if (normalized.contains("canh dieu")) return "CD";
        return current;
    }

    private static String cellText(List<XWPFTableCell> cells, int idx) {
        if (idx < 0 || idx >= cells.size()) return "";
        return cells.get(idx).getText().trim();
    }

    private static String rowText(List<XWPFTableCell> cells) {
        StringBuilder sb = new StringBuilder();
        for (XWPFTableCell c : cells) sb.append(c.getText()).append(" ");
        return sb.toString().trim();
    }

    private record ColIndices(int headerRow, int cWeek, int cTitle, int cPeriod) {}
}
