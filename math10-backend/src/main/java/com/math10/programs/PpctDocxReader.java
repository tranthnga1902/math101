package com.math10.programs;

import com.math10.common.exception.BusinessException;
import com.math10.programs.dto.PpctDtos.Dong;
import org.apache.poi.xwpf.usermodel.*;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTVMerge;

import java.io.ByteArrayInputStream;
import java.util.*;
import java.util.regex.*;

/**
 * Đọc PPCT từ file Word (.docx) về cùng {@code List<Dong>} như đường PDF/Excel.
 *
 * <p><b>Tự tìm bảng PPCT.</b> File .docx có thể chứa nhiều bảng (mục lục, tiêu đề…).
 * Reader quét từng bảng, kiểm header row có chứa cột "TUẦN" và "TIẾT" không; bảng đầu
 * tiên thỏa mãn là bảng PPCT. Nhận diện được cả hai dạng bảng thường gặp:
 * <ul>
 *   <li><b>PPCT bốn tầng</b>: Tuần | Tiết | Phân môn / Mạch | Nội dung. Cột mạch tường
 *       minh — ánh xạ trực tiếp thành {@code maMach}.</li>
 *   <li><b>Phân phối tiết</b>: Tuần | Tiết | Nội dung (không cột mạch). Mã mạch suy từ
 *       nội dung qua {@link PpctSuyMach} sau khi đọc xong.</li>
 * </ul>
 *
 * <p><b>Bung khoảng tiết/tuần.</b>
 * <ul>
 *   <li>Tiết dạng "1-4" hoặc "1–4": sinh 4 dòng số tiết 1, 2, 3, 4.</li>
 *   <li>Tuần dạng "2+3" hoặc "2, 3": mỗi dòng nhân bản cho cả hai tuần.</li>
 * </ul>
 *
 * <p><b>Ô gộp dọc (rowspan).</b> Cột Tuần và Tiết thường gộp ô qua nhiều hàng.
 * Reader theo dõi giá trị ô trước để tái hiện giá trị cho ô bị gộp ({@code vMerge}).
 *
 * <p><b>Học kỳ I / II.</b> Nhận diện từ:
 * <ol>
 *   <li>Đoạn văn ngay trước bảng có chứa "Học kỳ I" / "HKI" / "Semester 1".</li>
 *   <li>Dòng header phụ trong bảng (ô gộp ngang) chứa cùng từ khóa.</li>
 *   <li>Mặc định HK1 nếu không tìm thấy tín hiệu nào.</li>
 * </ol>
 *
 * <p><b>Loại tiết.</b> "Bài tập cuối chương", "Ôn tập chương", "Kiểm tra" được tự động
 * phân loại thành đúng {@code phanLoai}.
 *
 * <p>Thuần, không DB. Output trùng khuôn với {@link PpctExcelReader}.
 */
public final class PpctDocxReader {

    // Số dòng tối đa để tránh file bất thường gây OOM.
    private static final int TOI_DA_DONG = 5000;

    // Pattern nhận diện khoảng tiết: "1-4", "1–4", "1 - 4"
    private static final Pattern KHOANG_TIET = Pattern.compile("(\\d+)\\s*[-\u2013\u2014]\\s*(\\d+)");
    // Pattern nhận diện nhiều tuần: "2+3", "2, 3", "2 và 3"
    private static final Pattern NHIEU_TUAN = Pattern.compile("\\d+(?:\\s*[+,]\\s*\\d+)+");
    // Từ khóa nhận diện học kỳ
    private static final Pattern HOC_KY_2 = Pattern.compile(
            "(?i)(h[oọ]c\\s*k[yỳ]\\s*(II|2)\\b|\\bHKII\\b|semester\\s*2|term\\s*2|k[yỳ]\\s*2)");
    private static final Pattern HOC_KY_1 = Pattern.compile(
            "(?i)(h[oọ]c\\s*k[yỳ]\\s*(I|1)\\b|\\bHKI\\b|semester\\s*1|term\\s*1|k[yỳ]\\s*1)");

    // Header nhận diện bảng PPCT (so sánh sau normalize dấu)
    private static final Set<String> HEADER_TUAN = Set.of("TUAN", "WEEK");
    private static final Set<String> HEADER_TIET = Set.of("TIET", "PERIOD", "TIET HOC");
    private static final Set<String> HEADER_MACH = Set.of("PHAN MON", "MACH", "STRAND", "MON", "PHAN MON / NOI DUNG");
    private static final Set<String> HEADER_NOIDUNG = Set.of(
            "NOI DUNG", "BAI HOC", "CONTENT", "TEN BAI", "CHU DE", "TEN CHU DE", "BAI");

    private PpctDocxReader() {}

    /**
     * Đọc file .docx, tìm bảng PPCT, trả về {@code List<Dong>}.
     *
     * @param bytes nội dung file .docx
     * @return danh sách tiết đã bung khoảng; nếu file không có cột mạch tường minh thì
     *         {@code maMach} = "" — caller nên gọi {@link PpctSuyMach} để suy thêm.
     * @throws BusinessException nếu không tìm được bảng PPCT hoặc file lỗi
     */
    public static List<Dong> doc(byte[] bytes) {
        try (XWPFDocument docx = new XWPFDocument(new ByteArrayInputStream(bytes))) {
            List<IBodyElement> elements = docx.getBodyElements();

            // Gom ngữ cảnh văn bản trước bảng để phát hiện học kỳ
            StringBuilder contextTruocBang = new StringBuilder();

            for (IBodyElement el : elements) {
                if (el instanceof XWPFParagraph para) {
                    String t = para.getText().trim();
                    if (!t.isBlank()) {
                        contextTruocBang.append(t).append(" ");
                    }
                    continue;
                }
                if (!(el instanceof XWPFTable table)) continue;

                // Kiểm tra bảng này có phải bảng PPCT không
                ColMap cols = nhanDienHeader(table);
                if (cols == null) {
                    // Không phải bảng PPCT — reset context để tránh context từ bảng trước
                    contextTruocBang.setLength(0);
                    continue;
                }

                return docBang(table, cols, contextTruocBang.toString());
            }

            throw new BusinessException("Không tìm thấy bảng PPCT trong file. "
                    + "Bảng hợp lệ phải có header chứa cột Tuần và Tiết.");
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Không đọc được file .docx: " + e.getMessage());
        }
    }

    // ==================== Header detection ====================

    /**
     * Quét các hàng đầu bảng (tối đa 3 hàng), trả {@link ColMap} nếu là bảng PPCT.
     */
    private static ColMap nhanDienHeader(XWPFTable table) {
        int numRows = table.getNumberOfRows();
        for (int startRow = 0; startRow < Math.min(3, numRows); startRow++) {
            ColMap cols = nhanDienHeaderRow(table.getRow(startRow), startRow);
            if (cols != null) return cols;
        }
        return null;
    }

    private static ColMap nhanDienHeaderRow(XWPFTableRow row, int startRow) {
        if (row == null) return null;
        List<XWPFTableCell> cells = row.getTableCells();
        int cTuan = -1, cTiet = -1, cMach = -1, cNoiDung = -1;
        boolean coTuanVaTiet = false;

        for (int i = 0; i < cells.size(); i++) {
            String h = norm(cells.get(i).getText());
            if (cTuan < 0 && HEADER_TUAN.stream().anyMatch(k -> h.equals(k) || h.startsWith(k + " "))) {
                cTuan = i;
            } else if (cTiet < 0 && HEADER_TIET.stream().anyMatch(k -> h.equals(k) || h.startsWith(k))) {
                cTiet = i;
            } else if (cMach < 0 && HEADER_MACH.stream().anyMatch(k -> h.contains(k))) {
                cMach = i;
            } else if (cNoiDung < 0 && HEADER_NOIDUNG.stream().anyMatch(k -> h.contains(k))) {
                cNoiDung = i;
            }
        }

        coTuanVaTiet = cTuan >= 0 && cTiet >= 0;
        if (!coTuanVaTiet) return null;

        // Nếu không có cột Nội dung tường minh, dùng cột cuối
        if (cNoiDung < 0 && cells.size() > 0) cNoiDung = cells.size() - 1;
        return new ColMap(startRow, cTuan, cTiet, cMach, cNoiDung, cells.size());
    }

    // ==================== Table reading ====================

    private static List<Dong> docBang(XWPFTable table, ColMap cols, String contextTruocBang) {
        List<Dong> ra = new ArrayList<>();
        int soHocKy = phatHienHocKy(contextTruocBang);
        // Theo dõi giá trị ô cuối để xử lý rowspan
        String lastTuan = "1", lastTiet = "1", lastMach = "";

        int numRows = table.getNumberOfRows();
        for (int ri = cols.headerRow + 1; ri < numRows && ra.size() < TOI_DA_DONG; ri++) {
            XWPFTableRow row = table.getRow(ri);
            if (row == null) continue;
            List<XWPFTableCell> cells = row.getTableCells();

            // Dòng header phụ giữa bảng: "Học kỳ II", "HKI"...
            String fullRowText = rowText(cells);
            if (laHeaderPhu(fullRowText)) {
                soHocKy = phatHienHocKy(fullRowText);
                continue;
            }

            // Lấy giá trị ô, tôn trọng vMerge
            String rawTuan = giaTri(cells, cols.cTuan, lastTuan);
            String rawTiet = giaTri(cells, cols.cTiet, lastTiet);
            String rawMach = cols.cMach >= 0 ? giaTri(cells, cols.cMach, lastMach) : "";
            String noiDung = cols.cNoiDung >= 0 && cols.cNoiDung < cells.size()
                    ? cells.get(cols.cNoiDung).getText().trim() : "";

            // Cập nhật last cho ô tiếp theo có rowspan
            if (!rawTuan.isBlank()) lastTuan = rawTuan;
            if (!rawTiet.isBlank()) lastTiet = rawTiet;
            if (!rawMach.isBlank()) lastMach = rawMach;

            if (noiDung.isBlank() && rawTiet.isBlank()) continue;
            if (noiDung.isBlank()) noiDung = "(tiết " + rawTiet + ")";

            // Bung khoảng tiết và nhiều tuần
            List<Integer> dsTiet = bungTiet(rawTiet.isBlank() ? lastTiet : rawTiet);
            List<Integer> dsTuan = bungTuan(rawTuan.isBlank() ? lastTuan : rawTuan);

            if (dsTiet.isEmpty() || dsTuan.isEmpty()) continue;

            String maMach = chuanHoaMach(rawMach.isBlank() ? lastMach : rawMach);
            String phanLoai = suyPhanLoai(noiDung);
            String doTinCay = maMach.isBlank() ? PpctSuyMach.VUA : PpctSuyMach.CAO;

            for (int tuan : dsTuan) {
                for (int tiet : dsTiet) {
                    ra.add(new Dong(
                            ra.size(), maMach, tenMachCua(maMach),
                            tiet, tuan, soHocKy, phanLoai,
                            noiDung, null, null,
                            doTinCay, List.of()
                    ));
                }
            }
        }

        if (ra.isEmpty()) throw new BusinessException("Bảng PPCT tìm được nhưng không có dòng dữ liệu hợp lệ.");
        return ra;
    }

    // ==================== Cell value with rowspan ====================

    /**
     * Lấy text của ô {@code col}. Nếu ô là vMerge CONTINUE (ô con của rowspan), trả {@code lastValue}.
     */
    private static String giaTri(List<XWPFTableCell> cells, int col, String lastValue) {
        if (col < 0 || col >= cells.size()) return lastValue;
        XWPFTableCell cell = cells.get(col);
        try {
            if (cell.getCTTc() != null
                    && cell.getCTTc().getTcPr() != null
                    && cell.getCTTc().getTcPr().getVMerge() != null) {
                CTVMerge vmerge = cell.getCTTc().getTcPr().getVMerge();
                // Nếu không có val hoặc val != RESTART → ô con của rowspan
                if (vmerge.getVal() == null
                        || !vmerge.getVal().toString().equalsIgnoreCase("RESTART")) {
                    return lastValue;
                }
            }
        } catch (Exception ignored) {
            // Nếu không đọc được CTVMerge, cứ lấy text bình thường
        }
        return cell.getText().trim();
    }

    // ==================== Expand ranges ====================

    /** Bung "1-4" → [1,2,3,4]; "5" → [5]; lỗi định dạng → []. */
    static List<Integer> bungTiet(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        raw = raw.trim();
        Matcher m = KHOANG_TIET.matcher(raw);
        if (m.matches()) {
            int tu = Integer.parseInt(m.group(1));
            int den = Integer.parseInt(m.group(2));
            if (tu > den || den - tu > 50) return List.of(); // bất thường, bỏ
            List<Integer> ds = new ArrayList<>();
            for (int i = tu; i <= den; i++) ds.add(i);
            return ds;
        }
        try {
            String cleaned = raw.replaceAll("[^0-9]", "");
            if (cleaned.isEmpty()) return List.of();
            return List.of(Integer.parseInt(cleaned));
        } catch (NumberFormatException e) { return List.of(); }
    }

    /** Bung "2+3" hoặc "2, 3" → [2,3]; "5" → [5]. */
    static List<Integer> bungTuan(String raw) {
        if (raw == null || raw.isBlank()) return List.of();
        raw = raw.trim();
        if (NHIEU_TUAN.matcher(raw).find()) {
            Matcher all = Pattern.compile("\\d+").matcher(raw);
            List<Integer> ds = new ArrayList<>();
            while (all.find()) ds.add(Integer.parseInt(all.group()));
            return ds;
        }
        try {
            String cleaned = raw.replaceAll("[^0-9]", "");
            if (cleaned.isEmpty()) return List.of();
            return List.of(Integer.parseInt(cleaned));
        } catch (NumberFormatException e) { return List.of(); }
    }

    // ==================== Semester detection ====================

    /** Phát hiện học kỳ từ chuỗi văn bản; trả 1 hoặc 2; mặc định 1. */
    static int phatHienHocKy(String text) {
        if (text == null || text.isBlank()) return 1;
        // Phải kiểm HK2 trước (tránh nhầm "HKI" của "HKII")
        if (HOC_KY_2.matcher(text).find()) return 2;
        if (HOC_KY_1.matcher(text).find()) return 1;
        return 1;
    }

    /** Dòng header phụ trong bảng: chứa "Học kỳ", "HKI", "HKII", "Semester"... */
    private static boolean laHeaderPhu(String fullRowText) {
        if (fullRowText == null || fullRowText.isBlank()) return false;
        String up = fullRowText.trim().toUpperCase(Locale.ROOT);
        return up.contains("HỌC KỲ") || up.contains("HOC KY")
                || up.equals("HKI") || up.equals("HKII")
                || up.startsWith("SEMESTER") || up.startsWith("TERM")
                || up.matches("(?i)H[OỌ]C\\s*K[YỲ].*");
    }

    // ==================== phanLoai inference ====================

    /** Suy loại tiết từ nội dung bài học. */
    static String suyPhanLoai(String noiDung) {
        if (noiDung == null) return "BAI_MOI";
        String up = noiDung.toUpperCase(Locale.ROOT);
        if (up.contains("KIỂM TRA") || up.contains("KIEM TRA") || up.contains("THI ")
                || up.startsWith("THI")) return "KIEM_TRA";
        if (up.contains("ÔN TẬP") || up.contains("ON TAP")
                || up.contains("BÀI TẬP CUỐI CHƯƠNG") || up.contains("BAI TAP CUOI CHUONG")
                || up.contains("LUYỆN TẬP") || up.contains("LUYEN TAP")) return "ON_TAP";
        if (up.contains("THỰC HÀNH") || up.contains("THUC HANH")
                || up.contains("HĐTH") || up.contains("HOẠT ĐỘNG THỰC HÀNH")) return "THUC_HANH";
        return "BAI_MOI";
    }

    // ==================== Helpers ====================

    private static String rowText(List<XWPFTableCell> cells) {
        StringBuilder sb = new StringBuilder();
        for (XWPFTableCell c : cells) sb.append(c.getText()).append(" ");
        return sb.toString().trim();
    }

    /** Chuẩn hóa mã mạch: bỏ dấu, chuyển hoa, thay khoảng trắng/gạch bằng _. */
    private static String chuanHoaMach(String raw) {
        if (raw == null || raw.isBlank()) return "";
        return norm(raw).replaceAll("[\\s/\\-]+", "_").replaceAll("[^A-Z0-9_]", "");
    }

    /** Tên mạch hiển thị từ mã mạch. */
    private static String tenMachCua(String maMach) {
        if (maMach == null || maMach.isBlank()) return "";
        return switch (maMach) {
            case "DAI_SO" -> "Đại số";
            case "HINH_HOC" -> "Hình học";
            case "THONG_KE", "XAC_SUAT", "THONG_KE_XAC_SUAT" -> "Thống kê – Xác suất";
            case "HDTN", "HOAT_DONG_THUC_HANH" -> "Hoạt động thực hành";
            default -> maMach;
        };
    }

    /** Loại bỏ dấu tiếng Việt, chuyển hoa, cắt khoảng trắng thừa. */
    private static String norm(String s) {
        if (s == null) return "";
        return java.text.Normalizer.normalize(s.trim(), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toUpperCase(Locale.ROOT)
                .replaceAll("\\s+", " ");
    }

    // ==================== Internal record ====================

    /** Ánh xạ chỉ số cột đã nhận diện từ header row. */
    private record ColMap(int headerRow, int cTuan, int cTiet, int cMach, int cNoiDung, int numCols) {}
}
