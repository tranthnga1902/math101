package com.math10.programs;

import com.math10.programs.PpctExtractor.HangTho;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Phân tích cấu trúc Chương → Bài từ danh sách dòng PPCT thô.
 *
 * <p>Quy tắc tách: cột {@code tieuDe} trong file PPCT thường có dạng
 * <em>"Tên chương - Tên bài"</em>. Dấu phân cách là {@code " - "} (gạch ngang có
 * khoảng trắng 2 bên). Nếu không có dấu phân cách thì toàn bộ chuỗi là tên bài,
 * và tên chương được kế thừa từ dòng trước cùng mạch.
 *
 * <p>Thứ tự chương giữ theo lần xuất hiện đầu tiên trong file. Thứ tự bài trong mỗi
 * chương giữ theo thứ tự xuất hiện. Mỗi cặp {@code (tenChuong, tenBai)} là một bài;
 * hai dòng cùng {@code tenBai} trong cùng chương được gộp (đếm thêm tiết).
 *
 * <p>Thuần, không DB — dễ unit test.
 */
public final class PpctCauTrucParser {

    /** Dấu phân cách tên chương và tên bài. Giữ dạng literal để Pattern.quote xử lý ký tự đặc biệt. */
    public static final String DAU_TACH = " - ";
    private static final Pattern CHUONG_PREFIX = Pattern.compile(
            "(?iu)^\\s*ch[uư][oơ]ng\\s*([IVXLCDM0-9]+)\\s*[.:\\-]?\\s*(.*?)$");
    private static final Pattern CHUYEN_DE_PREFIX = Pattern.compile(
            "(?iu)^\\s*chuy[eê]n\\s*đ[eề]\\s*(\\d+)\\s*[.:\\-]?\\s*(.*?)$");
    private static final Pattern CUOI_CHUONG = Pattern.compile(
            "(?iu).*(?:b[aà]i\\s*t[aậ]p|[oô]n\\s*t[aậ]p)\\s*cu[oố]i\\s*ch[uư][oơ]ng\\s*([IVXLCDM0-9]+).*");

    /** Một bài học được suy ra từ file PPCT. */
    public record BaiHoc(
            String tenBai,
            int thuTu,
            int tuanBatDau,
            int soTiet,
            String maMach
    ) {}

    /** Một chương được suy ra từ file PPCT — chứa danh sách bài đã nhóm. */
    public record ChuongVaBai(
            String tenChuong,
            int thuTu,
            List<BaiHoc> bai
    ) {}

    private PpctCauTrucParser() {}

    /**
     * Phân tích danh sách dòng thô thành cấu trúc chương/bài.
     *
     * @param hang     danh sách dòng từ {@link PpctExtractor#tach}
     * @param maMachCu tên mạch đã được {@link PpctSuyMach#suy} gắn vào từng dòng — cùng thứ tự với {@code hang}
     */
    public static List<ChuongVaBai> phanTich(List<HangTho> hang, List<String> maMachCu) {
        // Dùng LinkedHashMap để giữ thứ tự xuất hiện của chương
        Map<String, List<BaiGoc>> nhomChuong = new LinkedHashMap<>();

        String chuongHienTai = "";
        for (int i = 0; i < hang.size(); i++) {
            HangTho h = hang.get(i);
            String maMach = i < maMachCu.size() ? maMachCu.get(i) : "";
            String td = h.tieuDe().trim();

            // Bỏ qua dòng ôn tập cuối mạch nếu không có tên bài cụ thể
            if (td.startsWith("Ôn tập cuối mạch") || td.startsWith("On tap cuoi mach")) {
                // Vẫn ghi vào chương hiện tại như một bài "Ôn tập"
                String tenBai = td;
                String chuong = chuongHienTai.isBlank() ? "Ôn tập" : chuongHienTai;
                nhomChuong.computeIfAbsent(chuong, k -> new ArrayList<>())
                        .add(new BaiGoc(tenBai, h.tuan() == null ? 0 : h.tuan(), maMach));
                continue;
            }

            String tenChuong;
            String tenBai;
            Matcher chapterPrefix = CHUONG_PREFIX.matcher(td);
            Matcher specialPrefix = CHUYEN_DE_PREFIX.matcher(td);
            Matcher chapterReview = CUOI_CHUONG.matcher(td);
            int idx = td.indexOf(DAU_TACH);
            if (chapterPrefix.matches()) {
                tenChuong = "Chương " + chapterPrefix.group(1).toUpperCase(Locale.ROOT);
                tenBai = chapterPrefix.group(2).trim();
            } else if (specialPrefix.matches()) {
                tenChuong = "Chuyên đề " + specialPrefix.group(1);
                tenBai = specialPrefix.group(2).trim();
            } else if (chapterReview.matches()) {
                tenChuong = "Chương " + chapterReview.group(1).toUpperCase(Locale.ROOT);
                tenBai = td;
            } else if (idx > 0) {
                tenChuong = td.substring(0, idx).trim();
                tenBai    = td.substring(idx + DAU_TACH.length()).trim();
            } else if (laDanhGiaDinhKy(td)) {
                tenChuong = "Kiểm tra và đánh giá";
                tenBai = td;
            } else {
                // Không có dấu "-": coi toàn bộ là tên bài, kế thừa chương trước
                tenChuong = chuongHienTai.isBlank() ? td : chuongHienTai;
                tenBai    = td;
            }

            if (tenChuong.isBlank() || tenBai.isBlank()) continue;
            chuongHienTai = tenChuong;
            nhomChuong.computeIfAbsent(tenChuong, k -> new ArrayList<>())
                    .add(new BaiGoc(tenBai, h.tuan() == null ? 0 : h.tuan(), maMach));
        }

        // Gộp bài trùng tên trong cùng chương (đếm số tiết)
        List<ChuongVaBai> ketQua = new ArrayList<>();
        int thuTuChuong = 1;
        for (Map.Entry<String, List<BaiGoc>> e : nhomChuong.entrySet()) {
            List<BaiHoc> dsBai = gop(e.getValue());
            ketQua.add(new ChuongVaBai(e.getKey(), thuTuChuong++, dsBai));
        }
        return ketQua;
    }

    // ==================== Internal helpers ====================

    /** Một dòng gốc chưa gộp: tên bài, tuần, mã mạch. */
    private record BaiGoc(String tenBai, int tuan, String maMach) {}

    /** Gộp các dòng cùng tên bài → đếm số tiết; giữ thứ tự xuất hiện đầu tiên. */
    private static List<BaiHoc> gop(List<BaiGoc> ds) {
        // Dùng LinkedHashMap giữ thứ tự, key = tenBai (case-sensitive, đã trim)
        Map<String, int[]> dem = new LinkedHashMap<>(); // [soTiet, tuanBatDau]
        Map<String, String> mach = new LinkedHashMap<>();
        for (BaiGoc b : ds) {
            String key = b.tenBai();
            if (!dem.containsKey(key)) {
                dem.put(key, new int[]{1, b.tuan()});
                mach.put(key, b.maMach());
            } else {
                dem.get(key)[0]++; // thêm tiết
            }
        }
        List<BaiHoc> ket = new ArrayList<>();
        int thuTu = 1;
        for (Map.Entry<String, int[]> e : dem.entrySet()) {
            int[] v = e.getValue();
            ket.add(new BaiHoc(e.getKey(), thuTu++, v[1], v[0], mach.get(e.getKey())));
        }
        return ket;
    }

    private static boolean laDanhGiaDinhKy(String title) {
        String normalized = java.text.Normalizer.normalize(
                        title.replace('Đ', 'D').replace('đ', 'd'), java.text.Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "").toLowerCase(Locale.ROOT);
        return normalized.contains("kiem tra") || normalized.contains("on tap giua hoc")
                || normalized.contains("on tap cuoi hoc");
    }
}
