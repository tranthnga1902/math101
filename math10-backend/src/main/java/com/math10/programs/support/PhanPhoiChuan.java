package com.math10.programs.support;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Phân phối chương trình chuẩn: bốn mạch, 35 tuần, 105 tiết.
 *
 * <p>Quy tắc nằm ở đây chứ không nằm trong một câu SQL, vì nó là thứ người ta sẽ đọc để cãi nhau
 * — "sao tuần 12 Hình học biến mất" là câu hỏi có thật, và trả lời được bằng cách chỉ vào
 * {@link #ctst()} thì nhanh hơn nhiều so với đọc một câu {@code generate_series}.
 *
 * <p><b>Ba con số phải đúng.</b> Tổng 105 tiết. Tuần 5 có đúng ba dòng: Đại số tiết 5, Hình học
 * tiết 9 và tiết 10. Tuần 12 là lần đầu mạch Thống kê xuất hiện. Ba điều đó không phải là hệ quả
 * tình cờ của các hằng số dưới đây — chúng là lý do các hằng số ấy có giá trị như vậy, nên đổi
 * một hằng số mà không đổi test là làm hỏng đúng thứ test đang canh.
 *
 * <p><b>Đây là bộ khung, không phải nội dung.</b> Lớp này sinh ra cấu trúc — mạch nào, tuần nào,
 * tiết thứ mấy, loại tiết gì — và <em>không</em> sinh ra tên bài. {@code lesson_id} để rỗng;
 * tiêu đề tiết bài mới chỉ là "Đại số · tiết 5". Bịa tên bài là dữ liệu sai tệ nhất: nhìn thì
 * đủ, đọc thì hợp lý, và không ai phát hiện ra cho tới lúc dạy sai.
 *
 * <p><b>Không còn hằng số public.</b> Toàn bộ tham số đi qua {@link CauHinhChuan} — nguồn thật
 * là DB (qua {@code PpctConfigLoader}); lớp này chỉ cung cấp cấu hình mặc định CTST qua
 * {@link #ctst()} làm fallback khi chương trình chưa được cấu hình.
 */
public final class PhanPhoiChuan {
    private PhanPhoiChuan() {}

    // ==================== Mã mạch: public, dùng chung với PpctSuyMach / DB ====================

    public static final String DAI_SO   = "DAI_SO";
    public static final String HINH_HOC = "HINH_HOC";
    public static final String THONG_KE = "THONG_KE";
    public static final String HDTN     = "HDTN";

    // ==================== Tham số mặc định CTST Toán 10: private ====================

    private static final int SO_TUAN            = 35;
    private static final int TUAN_CUOI_KY_I     = 18;
    private static final int TIET_MOT_TUAN      = 3;
    private static final int TUAN_CUOI_HINH_HOC = 11;

    private static final List<Integer> TUAN_HDTN     = List.of(6, 14, 23, 31);
    private static final List<Integer> TUAN_ON_TAP   = List.of(8, 17, 26, 34);
    private static final List<Integer> TUAN_KIEM_TRA = List.of(9, 18, 27, 35);

    private static final List<String> NHAN_KY = List.of(
            "giữa học kỳ I", "cuối học kỳ I", "giữa học kỳ II", "cuối học kỳ II");

    // ==================== Kiểu dữ liệu: public, đi qua PpctConfigLoader ====================

    /**
     * Một mạch trong chương trình.
     * {@code batDauTuan}/{@code ketThucTuan} = 0 có nghĩa là dùng đầu/cuối năm.
     * {@code soTietMotTuan}: số tiết mạch này chiếm mỗi tuần (1 cho DAI_SO/HDTN, 2 cho HINH_HOC/THONG_KE).
     */
    public record Mach(String ma, String ten, int thuTu, int batDauTuan, int ketThucTuan, int soTietMotTuan) {}

    /** Một tuần đặc biệt: HĐTN lấy chỗ ô đơn, ôn tập, hoặc kiểm tra. */
    public record TuanDacBiet(int tuanSo, String loai, String maMach, String nhan) {}

    /** Một tiết đã được gán mạch, số tiết, tuần, học kỳ, tiêu đề và loại. */
    public record Tiet(String maMach, int soTiet, int tuan, int hocKy, String tieuDe, String phanLoai) {}

    /**
     * Cấu hình đầy đủ của một chương trình — nguồn dữ liệu cho mọi thứ sinh tiết.
     * Được build bởi {@code PpctConfigLoader} từ DB, hoặc bởi {@link #ctst()} khi fallback.
     */
    public record CauHinhChuan(
            int soTuan,
            int tuanKy1,
            int tietMotTuan,
            List<Mach> mach,
            List<TuanDacBiet> tuanDacBiet
    ) {}

    // ==================== Factory ====================

    /**
     * Cấu hình mặc định CTST Toán 10: 35 tuần, 105 tiết, 4 mạch.
     * Dùng làm fallback khi chương trình chưa có config trong DB.
     */
    public static CauHinhChuan ctst() {
        List<Mach> mach = List.of(
                new Mach(DAI_SO,   "Đại số",                  1, 1, SO_TUAN,            1),
                new Mach(HINH_HOC, "Hình học",                 2, 1, TUAN_CUOI_HINH_HOC, 2),
                new Mach(THONG_KE, "Thống kê và Xác suất",    3, TUAN_CUOI_HINH_HOC + 1, SO_TUAN, 2),
                new Mach(HDTN,     "Hoạt động trải nghiệm",   4, 1, SO_TUAN,            1)
        );
        List<TuanDacBiet> dac = new ArrayList<>();
        for (int t : TUAN_HDTN)
            dac.add(new TuanDacBiet(t, "HDTN", HDTN, null));
        for (int i = 0; i < TUAN_ON_TAP.size(); i++)
            dac.add(new TuanDacBiet(TUAN_ON_TAP.get(i),   "ON_TAP",   null, NHAN_KY.get(i)));
        for (int i = 0; i < TUAN_KIEM_TRA.size(); i++)
            dac.add(new TuanDacBiet(TUAN_KIEM_TRA.get(i), "KIEM_TRA", null, NHAN_KY.get(i)));
        return new CauHinhChuan(SO_TUAN, TUAN_CUOI_KY_I, TIET_MOT_TUAN, mach, dac);
    }

    // ==================== Sinh tiết từ cấu hình ====================

    /** Danh sách mạch từ cấu hình — tương thích với {@code ProgramStrandController.seed()}. */
    public static List<Mach> mach(CauHinhChuan cfg) { return cfg.mach(); }

    /**
     * Sinh danh sách tiết từ cấu hình.
     *
     * <p>Mỗi mạch tự biết số tiết của mình mỗi tuần qua {@code soTietMotTuan}. Tuần HĐTN
     * (khai báo trong {@code tuanDacBiet}) thay thế toàn bộ tiết ô đơn (mạch {@code soTietMotTuan=1}
     * và không phải HDTN) bằng tiết HĐTN. Tuần ôn tập/kiểm tra override phân loại tiết ô đơn.
     */
    public static List<Tiet> tiet(CauHinhChuan cfg) {
        int soTuan      = cfg.soTuan();
        int tuanKy1     = cfg.tuanKy1();

        Set<Integer>         tuanHdtn    = new HashSet<>();
        Set<Integer>         tuanOnTap   = new HashSet<>();
        Set<Integer>         tuanKiemTra = new HashSet<>();
        Map<Integer, String> nhanKiemTra = new HashMap<>();
        Map<Integer, String> nhanOnTap   = new HashMap<>();

        for (TuanDacBiet d : cfg.tuanDacBiet()) {
            switch (d.loai()) {
                case "HDTN"     -> tuanHdtn.add(d.tuanSo());
                case "ON_TAP"   -> { tuanOnTap.add(d.tuanSo());
                                     if (d.nhan() != null) nhanOnTap.put(d.tuanSo(), d.nhan()); }
                case "KIEM_TRA" -> { tuanKiemTra.add(d.tuanSo());
                                     if (d.nhan() != null) nhanKiemTra.put(d.tuanSo(), d.nhan()); }
                default -> { /* bỏ qua */ }
            }
        }

        Map<String, Integer> ke = new HashMap<>();
        List<Tiet> ra = new ArrayList<>();

        for (int tuan = 1; tuan <= soTuan; tuan++) {
            int ky = tuan <= tuanKy1 ? 1 : 2;
            boolean laHdtn = tuanHdtn.contains(tuan);
            final int t = tuan;

            // Mạch hoạt động tuần này
            List<Mach> hoatDong = cfg.mach().stream()
                    .filter(m -> t >= coalesce(m.batDauTuan(), 1) && t <= coalesce(m.ketThucTuan(), soTuan))
                    .sorted(java.util.Comparator.comparingInt(Mach::thuTu))
                    .toList();

            for (Mach m : hoatDong) {
                // HDTN chỉ sinh tiết trong tuần HĐTN
                if (m.ma().equals(HDTN) && !laHdtn) continue;
                // Mạch ô đơn (soTietMotTuan=1, không phải HDTN) bị thay bởi HĐTN trong tuần HĐTN
                if (!m.ma().equals(HDTN) && m.soTietMotTuan() == 1 && laHdtn) continue;

                boolean cuoi = m.ketThucTuan() > 0 && m.ketThucTuan() == tuan && !m.ma().equals(DAI_SO) && !m.ma().equals(HDTN);
                for (int i = 0; i < m.soTietMotTuan(); i++) {
                    int so = ke.merge(m.ma(), 1, Integer::sum);
                    String tieuDe;
                    String phanLoai;
                    if (m.soTietMotTuan() == 1) {
                        // Ô đơn: ôn tập / kiểm tra / HĐTN / bài mới
                        tieuDe   = tieuDeODon(m, tuan, so, tuanKiemTra, tuanOnTap, nhanKiemTra, nhanOnTap);
                        phanLoai = phanLoaiODon(tuan, m, tuanKiemTra, tuanOnTap, laHdtn);
                    } else {
                        // Ô đôi: bài mới hoặc ôn tập cuối mạch
                        tieuDe   = cuoi ? "Ôn tập cuối mạch " + m.ten() : m.ten() + " · tiết " + so;
                        phanLoai = cuoi ? "ON_TAP" : "BAI_MOI";
                    }
                    ra.add(new Tiet(m.ma(), so, tuan, ky, tieuDe, phanLoai));
                }
            }
        }
        return ra;
    }

    // ==================== Helpers ====================

    private static int coalesce(int val, int fallback) { return val <= 0 ? fallback : val; }

    private static String tieuDeODon(Mach m, int tuan, int so,
            Set<Integer> tuanKiemTra, Set<Integer> tuanOnTap,
            Map<Integer, String> nhanKiemTra, Map<Integer, String> nhanOnTap) {
        if (tuanKiemTra.contains(tuan))
            return "Kiểm tra " + nhanKiemTra.getOrDefault(tuan, String.valueOf(tuan));
        if (tuanOnTap.contains(tuan))
            return "Ôn tập " + nhanOnTap.getOrDefault(tuan, String.valueOf(tuan));
        if (m.ma().equals(HDTN))
            return m.ten() + " " + so;
        return m.ten() + " · tiết " + so;
    }

    private static String phanLoaiODon(int tuan, Mach m,
            Set<Integer> tuanKiemTra, Set<Integer> tuanOnTap, boolean laHdtn) {
        if (tuanKiemTra.contains(tuan)) return "KIEM_TRA";
        if (tuanOnTap.contains(tuan))   return "ON_TAP";
        if (laHdtn || m.ma().equals(HDTN)) return "THUC_HANH";
        return "BAI_MOI";
    }
}
