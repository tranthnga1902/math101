package com.math10.assignments.domain;

import com.math10.common.exception.BusinessException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Chấm một câu, theo kiểu của câu đó. Thuần logic, không biết gì về JPA hay JDBC — cùng lối với
 * {@link McqGrading}, để test chỉ cần vài dòng.
 *
 * <p>Bốn kiểu của đề thi hiện hành:
 * <ul>
 *   <li>{@code MCQ} — một phương án đúng trong A/B/C/D.</li>
 *   <li>{@code DUNG_SAI_4Y} — bốn ý, mỗi ý đúng hoặc sai, chấm theo thang lũy tiến của Bộ:
 *       đúng 1 ý được 0.1, 2 ý 0.25, 3 ý 0.5, đủ 4 ý mới trọn điểm. Thang này <b>không tuyến
 *       tính</b> là cố ý: đoán mò bốn ý trúng một hai ý là chuyện thường, nên phần thưởng dồn về
 *       cuối.</li>
 *   <li>{@code TRA_LOI_NGAN} — so số, có dung sai.</li>
 *   <li>{@code TU_LUAN} — người chấm. Trả {@code null}, <b>không phải 0</b>: trả 0 là biến
 *       "chưa chấm" thành "chấm rồi, được 0 điểm" (xem {@link WorksheetScoring#tongHop}).</li>
 * </ul>
 */
public final class ChamDiemCauHoi {

    private ChamDiemCauHoi() {}

    public static final String MCQ = "MCQ";
    public static final String DUNG_SAI_4Y = "DUNG_SAI_4Y";
    public static final String TRA_LOI_NGAN = "TRA_LOI_NGAN";
    public static final String TU_LUAN = "TU_LUAN";

    /** Tỉ lệ điểm theo số ý đúng của câu đúng/sai 4 ý: chỉ số 0..4. */
    private static final BigDecimal[] THANG_DUNG_SAI = {
            BigDecimal.ZERO,
            new BigDecimal("0.10"),
            new BigDecimal("0.25"),
            new BigDecimal("0.50"),
            BigDecimal.ONE
    };

    /** Dung sai mặc định của trả lời ngắn khi đề không ghi rõ. Đủ chặt để không nhận nhầm. */
    private static final BigDecimal DUNG_SAI_MAC_DINH = new BigDecimal("0.0001");

    private static final Pattern SO = Pattern.compile("-?\\d+(?:[.,]\\d+)?");

    /**
     * Một câu của đề kèm đáp án. {@code dapAn} và {@code payload} lấy từ bản chụp của phiên bản
     * đề, không lấy từ câu gốc — câu gốc có thể đã bị sửa sau khi phát hành.
     *
     * @param payload JSON tuỳ kiểu câu. Trả lời ngắn dùng {@code {"tolerance":0.01}}.
     */
    public record Cau(Long id, String kieu, String dapAn, String payload, BigDecimal diemToiDa) {

        public Cau {
            if (diemToiDa == null || diemToiDa.signum() <= 0) diemToiDa = BigDecimal.ONE;
            if (kieu == null || kieu.isBlank()) kieu = "UNKNOWN";
        }

        public boolean nguoiCham() { return TU_LUAN.equals(kieu); }
    }

    /** Câu này máy chấm được không. Tự luận thì không; các kiểu còn lại cần có đáp án. */
    public static boolean mayChamDuoc(Cau cau) {
        return !cau.nguoiCham() && cau.dapAn() != null && !cau.dapAn().isBlank();
    }

    /**
     * Đề phải chấm được: mọi câu không phải tự luận đều đã có đáp án đúng, và đáp án ấy phải hợp
     * lệ với kiểu câu. Đáp án sai định dạng mà lọt qua đây thì cả lớp bị 0 câu đó mà không ai báo.
     */
    public static void requireGradable(List<Cau> de) {
        if (de == null || de.isEmpty()) throw new BusinessException("Đề chưa có câu hỏi");
        for (Cau cau : de) {
            if (cau.nguoiCham()) continue;
            if (!mayChamDuoc(cau)) {
                throw new BusinessException("Câu chưa có đáp án đúng: " + cau.id());
            }
            if (DUNG_SAI_4Y.equals(cau.kieu()) && dungSai(cau.dapAn()) == null) {
                throw new BusinessException("Đáp án đúng/sai phải gồm 4 ý D hoặc S: " + cau.id());
            }
            if (TRA_LOI_NGAN.equals(cau.kieu()) && so(cau.dapAn()) == null) {
                throw new BusinessException("Đáp án trả lời ngắn phải là một số: " + cau.id());
            }
        }
    }

    /** Đáp án của câu này có dùng chấm được không. Cùng luật với {@link #requireGradable}, dạng boolean. */
    public static boolean dapAnHopLe(Cau cau) {
        if (cau.nguoiCham()) return true;
        if (!mayChamDuoc(cau)) return false;
        return switch (cau.kieu()) {
            case DUNG_SAI_4Y -> dungSai(cau.dapAn()) != null;
            case TRA_LOI_NGAN -> so(cau.dapAn()) != null;
            default -> true;
        };
    }

    /**
     * Bài làm có đúng dạng của kiểu câu không — lưới chặn lúc học sinh nộp.
     *
     * <p>Chặn ở đây chứ không để lúc chấm tự phát hiện: gõ "12 cm" vào câu trả lời ngắn thì hàm
     * {@link #so} vẫn đọc ra 12 và chấm đúng, nhưng gõ "khoảng mười hai" thì lặng lẽ thành 0 điểm.
     * Học sinh phải biết ngay lúc nộp, không phải lúc xem điểm.
     */
    public static boolean baiLamHopLe(Cau cau, String baiLam) {
        return switch (cau.kieu()) {
            case DUNG_SAI_4Y -> dungSai(baiLam) != null;
            case TRA_LOI_NGAN -> so(baiLam) != null;
            case TU_LUAN -> baiLam != null && !baiLam.isBlank();
            default -> McqGrading.isOption(baiLam);
        };
    }

    /**
     * Điểm của một câu. Trả {@code null} khi phải người chấm.
     *
     * <p>Bỏ trống tính là sai — trừ tự luận, vì tự luận bỏ trống vẫn phải qua mắt người chấm.
     */
    public static BigDecimal cham(Cau cau, String baiLam) {
        if (cau.nguoiCham()) return null;
        return cau.diemToiDa().multiply(tiLe(cau, baiLam)).setScale(2, RoundingMode.HALF_UP);
    }

    /** Phần điểm đạt được trên thang 0..1 của một câu. */
    public static BigDecimal tiLe(Cau cau, String baiLam) {
        return switch (cau.kieu()) {
            case DUNG_SAI_4Y -> tiLeDungSai(cau.dapAn(), baiLam);
            case TRA_LOI_NGAN -> tiLeTraLoiNgan(cau, baiLam);
            default -> {
                String dung = McqGrading.normalize(cau.dapAn()), lam = McqGrading.normalize(baiLam);
                yield dung != null && dung.equals(lam) ? BigDecimal.ONE : BigDecimal.ZERO;
            }
        };
    }

    private static BigDecimal tiLeDungSai(String dapAn, String baiLam) {
        boolean[] dung = dungSai(dapAn), lam = dungSai(baiLam);
        if (dung == null) return BigDecimal.ZERO;
        if (lam == null) return BigDecimal.ZERO;
        int trung = 0;
        for (int i = 0; i < 4; i++) if (dung[i] == lam[i]) trung++;
        return THANG_DUNG_SAI[trung];
    }

    /**
     * Đọc bốn ý đúng/sai. Nhận cả tiếng Việt (D/S) lẫn tiếng Anh (T/F) và cả 1/0, vì cùng một
     * chuỗi này đi qua tay người soạn đề, bộ tách tài liệu và màn làm bài của học sinh.
     */
    public static boolean[] dungSai(String value) {
        if (value == null) return null;
        String gon = value.replaceAll("[^A-Za-z01]", "").toUpperCase(Locale.ROOT);
        if (gon.length() != 4) return null;
        boolean[] ket = new boolean[4];
        for (int i = 0; i < 4; i++) {
            char c = gon.charAt(i);
            if (c == 'D' || c == 'T' || c == '1') ket[i] = true;
            else if (c == 'S' || c == 'F' || c == '0') ket[i] = false;
            else return null;
        }
        return ket;
    }

    private static BigDecimal tiLeTraLoiNgan(Cau cau, String baiLam) {
        BigDecimal dung = so(cau.dapAn()), lam = so(baiLam);
        if (dung == null || lam == null) return BigDecimal.ZERO;
        BigDecimal saiSo = dung.subtract(lam).abs();
        return saiSo.compareTo(dungSaiCuaCau(cau)) <= 0 ? BigDecimal.ONE : BigDecimal.ZERO;
    }

    /**
     * Dung sai đọc từ {@code payload}. Đọc bằng regex chứ không dựng cây JSON: cả dự án chỉ cần
     * đúng một con số ở đây, và cột {@code answer_payload} do chính hệ thống ghi ra.
     */
    static BigDecimal dungSaiCuaCau(Cau cau) {
        if (cau.payload() == null) return DUNG_SAI_MAC_DINH;
        Matcher m = Pattern.compile("\"tolerance\"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)").matcher(cau.payload());
        if (!m.find()) return DUNG_SAI_MAC_DINH;
        BigDecimal value = new BigDecimal(m.group(1));
        return value.signum() < 0 ? DUNG_SAI_MAC_DINH : value;
    }

    /** Số đầu tiên trong chuỗi, chấp nhận dấu phẩy thập phân kiểu Việt. Không có số thì null. */
    public static BigDecimal so(String value) {
        if (value == null) return null;
        Matcher m = SO.matcher(value.trim());
        return m.find() ? new BigDecimal(m.group().replace(',', '.')) : null;
    }

}
