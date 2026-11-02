package com.math10.programs;

import com.math10.programs.support.PhanPhoiChuan;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Suy mạch cho từng dòng PPCT thô. Thuần, không DB — cùng triết lý {@code DoanNoiDen}.
 *
 * <p>PPCT Toán 10 CTST chạy song song nhiều mạch (Đại số, Hình học, Thống kê–Xác suất,
 * HĐTH&TN). Số tiết đếm riêng theo mạch nên lặp lại trong bảng, và <b>mạch không phải
 * là một cột</b> — phải suy từ từ khóa tiêu đề, rồi kiểm chéo bằng tính liền mạch của số
 * tiết.
 *
 * <p><b>Ba mức tin cậy, và mức thấp là để người soát nhìn.</b> Từ khóa khớp và số tiết
 * liền mạch → {@code CAO}. Chỉ một trong hai → {@code VUA} kèm cảnh báo. Không tín hiệu nào
 * chắc → {@code THAP}, gán tạm Đại số và bắt người soát tự chọn. Một gợi ý sai lọt qua tệ
 * hơn một ô người ta buộc phải nhìn.
 *
 * <p>Từ khóa không còn cứng trong code. Mỗi lần gọi {@link #suy} nhận danh sách
 * {@code List<TuKhoa>} từ caller — {@link PpctGhiService} load từ DB qua {@link PpctConfigLoader}.
 * Nếu list rỗng (chương trình chưa cấu hình từ khóa) thì lùi về chế độ "đoán theo liên mạch"
 * (nhiều THAP hơn, nhưng không lỗi).
 *
 * <p>Mã mạch lấy thẳng từ {@link PhanPhoiChuan} để đường {@code /seed} và đường nhập PPCT
 * ghi vào cùng một chỗ.
 */
public final class PpctSuyMach {

    /**
     * Một tiết đã gán mạch. {@code lessonId} để rỗng khi chưa khớp được bài trong
     * {@code lessons} — trung tâm chưa seed bài Toán 10 nào.
     */
    public record TietDoan(String maMach, int soTiet, int tuan, int hocKy, String phanLoai,
                           String tieuDe, Long lessonId, String doTinCay, List<String> canhBao) {}

    /** Một từ khóa nhận dạng mạch từ DB — cùng kiểu với {@link PpctConfigLoader.TuKhoa}. */
    public record TuKhoa(String maMach, String tuKhoa) {}

    public static final String CAO  = "CAO";
    public static final String VUA  = "VUA";
    public static final String THAP = "THAP";

    /**
     * Mốc mặc định: HK1 hết tuần 18. Chỉ dùng khi tuần của dòng PPCT không xác định được.
     * Giá trị thật lấy từ {@code program_ppct_config.tuan_ky_1} qua {@link PpctConfigLoader}.
     */
    private static final int TUAN_HET_KY_I_DEFAULT = 18;

    private static final List<String> MOI_MACH = List.of(
            PhanPhoiChuan.DAI_SO, PhanPhoiChuan.HINH_HOC,
            PhanPhoiChuan.THONG_KE, PhanPhoiChuan.HDTN);

    private static final Map<String, String> TEN = Map.of(
            PhanPhoiChuan.DAI_SO,   "Đại số",
            PhanPhoiChuan.HINH_HOC, "Hình học",
            PhanPhoiChuan.THONG_KE, "Thống kê và Xác suất",
            PhanPhoiChuan.HDTN,     "Hoạt động trải nghiệm");

    private PpctSuyMach() {}

    public static String tenMach(String ma) { return TEN.getOrDefault(ma, ma); }

    /**
     * Suy mạch từ danh sách từ khóa lấy từ DB.
     * Nếu {@code tuKhoa} rỗng thì chỉ dùng tính liền mạch (nhiều THAP hơn, không lỗi).
     */
    public static List<TietDoan> suy(List<PpctExtractor.HangTho> hang, List<TuKhoa> tuKhoa) {
        // Build map mã mạch → Pattern từ danh sách từ khóa
        Map<String, Pattern> patterns = buildPatterns(tuKhoa);

        Map<String, Integer> ke = new HashMap<>();
        List<TietDoan> ket = new ArrayList<>();

        for (PpctExtractor.HangTho h : hang) {
            int tuan = h.tuan() == null ? 1 : h.tuan();
            int tiet = h.tiet();
            String td = h.tieuDe();
            List<String> canhBao = new ArrayList<>();

            String maMach;
            String tin;
            String tuKhoaKhop = tuKhoaMach(td, patterns);

            if (tuKhoaKhop != null) {
                maMach = tuKhoaKhop;
                if (lienMach(ke, maMach, tiet)) {
                    tin = CAO;
                } else {
                    tin = VUA;
                    canhBao.add("Số tiết " + tiet + " không nối tiếp mạch " + tenMach(maMach)
                            + " (đang ở tiết " + ke.getOrDefault(maMach, 0) + ")");
                }
            } else {
                List<String> hopLe = new ArrayList<>();
                for (String m : MOI_MACH) {
                    if (lienMach(ke, m, tiet)) hopLe.add(m);
                }
                if (hopLe.size() == 1) {
                    maMach = hopLe.get(0);
                    tin = VUA;
                    canhBao.add("Không có từ khóa mạch — suy \"" + tenMach(maMach)
                            + "\" theo số tiết nối tiếp");
                } else {
                    maMach = PhanPhoiChuan.DAI_SO;
                    tin = THAP;
                    canhBao.add("Máy không chắc mạch của dòng này — chọn lại giúp");
                }
            }

            ke.put(maMach, tiet);
            int hocKy = tuan <= TUAN_HET_KY_I_DEFAULT ? 1 : 2;
            ket.add(new TietDoan(maMach, tiet, tuan, hocKy, phanLoai(td), td, null, tin, canhBao));
        }
        return ket;
    }

    // ==================== Helpers ====================

    /**
     * Build Pattern cho từng mạch từ danh sách từ khóa.
     * Mỗi từ khóa được escape để khớp literal (không phải regex), nối bằng {@code |}.
     */
    private static Map<String, Pattern> buildPatterns(List<TuKhoa> tuKhoa) {
        Map<String, StringBuilder> byMach = new HashMap<>();
        for (TuKhoa tk : tuKhoa) {
            byMach.computeIfAbsent(tk.maMach(), k -> new StringBuilder())
                  .append(byMach.get(tk.maMach()).length() > 0 ? "|" : "")
                  .append(Pattern.quote(tk.tuKhoa().trim()));
        }
        Map<String, Pattern> result = new HashMap<>();
        for (Map.Entry<String, StringBuilder> e : byMach.entrySet()) {
            if (e.getValue().length() > 0) {
                result.put(e.getKey(), Pattern.compile(e.getValue().toString(),
                        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE));
            }
        }
        return result;
    }

    private static String tuKhoaMach(String td, Map<String, Pattern> patterns) {
        String x = td.trim();
        // HĐTN: prefix check trước vì ổn định hơn regex
        if (x.startsWith("HĐTH&TN") || x.startsWith("HĐTN") || x.startsWith("HĐ TH")) {
            return PhanPhoiChuan.HDTN;
        }
        // Ưu tiên theo thứ tự: HINH_HOC, THONG_KE, DAI_SO (HDTN đã check trên)
        for (String ma : List.of(PhanPhoiChuan.HINH_HOC, PhanPhoiChuan.THONG_KE, PhanPhoiChuan.DAI_SO)) {
            Pattern p = patterns.get(ma);
            if (p != null && p.matcher(x).find()) return ma;
        }
        return null;
    }

    /**
     * Số tiết {@code tiet} có nối tiếp bộ đếm của mạch {@code ma} không. Thống kê và HĐTH&TN
     * dùng chung ô với mạch khác nên chúng khởi động lại từ tiết 1 ở mỗi khối — chấp nhận
     * {@code tiet == 1} bất cứ lúc nào cho hai mạch đó. Mọi mạch đều chấp nhận tiết 1 ở lần
     * đầu xuất hiện.
     */
    private static boolean lienMach(Map<String, Integer> ke, String ma, int tiet) {
        int hienTai = ke.getOrDefault(ma, 0);
        if (tiet == hienTai + 1) return true;
        if (tiet == 1 && !ke.containsKey(ma)) return true;
        return tiet == 1 && (ma.equals(PhanPhoiChuan.THONG_KE) || ma.equals(PhanPhoiChuan.HDTN));
    }

    private static String phanLoai(String td) {
        String x = td.toLowerCase(Locale.ROOT);
        if (x.matches(".*\\bkt\\b.*") || x.contains("kiểm tra")) return "KIEM_TRA";
        if (td.contains("HĐTH&TN") || td.contains("HĐTN")) return "THUC_HANH";
        if (x.contains("bt cuối chương") || x.contains("bài tập cuối chương")
                || x.contains("ôn tập") || x.contains("ôn cuối")) return "ON_TAP";
        return "BAI_MOI";
    }
}
