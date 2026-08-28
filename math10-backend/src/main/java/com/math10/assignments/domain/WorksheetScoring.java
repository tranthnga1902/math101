package com.math10.assignments.domain;

import com.math10.common.exception.BusinessException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Cách tính điểm cho phiếu có cả câu trắc nghiệm lẫn câu tự luận.
 *
 * <p>Một câu là <b>tự luận</b> khi {@link McqGrading.Key#multipleChoice()} false — cờ này do
 * {@code WorksheetAnswerKeys} suy ra từ đề. Không dùng "đáp án đúng đang để trống" làm phép thử:
 * để trống còn có nghĩa là giáo viên quên nhập đáp án cho một câu trắc nghiệm, và nếu coi hai
 * chuyện đó là một thì mỗi lần quên là một câu tự luận mọc ra không ai biết.
 *
 * <p>Máy chấm phần trắc nghiệm, người chấm phần tự luận. Toàn bộ luật chia điểm nằm ở đây chứ
 * không rải trong controller, vì có ba đường cùng phải tính ra một con số giống nhau: học sinh
 * nộp bài, giáo viên chấm từng câu, và giáo viên chấm lại cả lớp. Ba chỗ tự tính riêng là ba cơ
 * hội để chúng lệch nhau.
 */
public final class WorksheetScoring {

    private WorksheetScoring() {}

    /** Thang điểm của cả phiếu, giống {@link McqGrading#MAX_SCORE}. */
    public static final BigDecimal MAX_SCORE = McqGrading.MAX_SCORE;

    /**
     * Điểm tối đa của một câu: chia đều thang 10 cho số câu, làm tròn hai chữ số.
     *
     * <p>Con số này là <b>mức trần để nhập điểm và để hiển thị</b>, không phải đơn vị dùng để cộng
     * ra tổng — xem {@link #tongHop}. Phân biệt hai vai trò đó là điều quan trọng nhất ở lớp này.
     */
    public static BigDecimal diemToiDaMoiCau(int soCau) {
        if (soCau <= 0) throw new BusinessException("Đề chưa có câu hỏi");
        return MAX_SCORE.divide(BigDecimal.valueOf(soCau), 2, RoundingMode.HALF_UP);
    }

    /** Câu này phải người chấm. */
    public static boolean laTuLuan(McqGrading.Key key) {
        return !key.multipleChoice();
    }

    /** Đề này có câu nào phải người chấm không. */
    public static boolean coCauTuLuan(List<McqGrading.Key> keys) {
        return keys.stream().anyMatch(WorksheetScoring::laTuLuan);
    }

    /**
     * Đề phải chấm được: mọi câu <b>trắc nghiệm</b> đều đã nhập đáp án đúng.
     *
     * <p>Cùng cái lưới của {@link McqGrading#requireGradable}, chỉ khác là bỏ qua câu tự luận —
     * câu tự luận không có đáp án là đúng chứ không phải hỏng. Vẫn phải giữ lưới này: bỏ nó đi
     * thì một câu trắc nghiệm quên đáp án sẽ chuyển thành câu chờ chấm tay, giáo viên không hiểu
     * vì sao bài không tự lên điểm, và cái sai nằm ở đề chứ không nằm ở bài nộp.
     */
    public static void requireGradable(List<McqGrading.Key> keys) {
        if (keys == null || keys.isEmpty()) throw new BusinessException("Đề chưa có câu hỏi");
        List<Long> missing = new ArrayList<>();
        for (McqGrading.Key key : keys) {
            if (!laTuLuan(key) && !McqGrading.isOption(key.correctOption())) missing.add(key.problemId());
        }
        if (!missing.isEmpty()) {
            throw new BusinessException("Đề có câu chưa được cấu hình đáp án đúng: " + missing);
        }
    }

    /**
     * Điểm máy tự chấm được cho từng câu.
     *
     * <p>Câu trắc nghiệm: đúng thì trọn điểm câu đó, sai hoặc bỏ trống thì 0. Câu tự luận: không
     * có mặt trong kết quả, chờ người chấm — <b>không phải 0</b>. Trả 0 cho câu chưa ai chấm là
     * biến "chưa chấm" thành "chấm rồi, được 0 điểm", và tổng chốt ra sẽ thấp hơn thực tế.
     */
    public static Map<Long, BigDecimal> diemTuDong(List<McqGrading.Key> keys, Map<Long, String> baiLam) {
        requireGradable(keys);
        BigDecimal toiDa = diemToiDaMoiCau(keys.size());
        Map<Long, BigDecimal> ket = new LinkedHashMap<>();
        for (McqGrading.Key key : keys) {
            if (laTuLuan(key)) continue;
            boolean dung = McqGrading.isCorrect(key, baiLam == null ? null : baiLam.get(key.problemId()));
            ket.put(key.problemId(), dung ? toiDa : BigDecimal.ZERO);
        }
        return ket;
    }

    /** Số câu trắc nghiệm đúng trên tổng số câu trắc nghiệm của đề. */
    public record ThongKeTracNghiem(int dung, int tong) {}

    /**
     * Đếm phần trắc nghiệm — hai cột {@code correct_count} / {@code total_questions} của bài nộp.
     *
     * <p>Chỉ đếm câu trắc nghiệm, không đếm cả phiếu. Với đề toàn trắc nghiệm thì không khác gì
     * trước, còn với đề trộn thì "3/5 câu đúng" trên phiếu có 2 câu tự luận là con số vô nghĩa:
     * câu tự luận không có khái niệm đúng hay sai, chỉ có được bao nhiêu điểm.
     */
    public static ThongKeTracNghiem thongKeTracNghiem(List<McqGrading.Key> keys, Map<Long, String> baiLam) {
        requireGradable(keys);
        int dung = 0, tong = 0;
        for (McqGrading.Key key : keys) {
            if (laTuLuan(key)) continue;
            tong++;
            if (McqGrading.isCorrect(key, baiLam == null ? null : baiLam.get(key.problemId()))) dung++;
        }
        return new ThongKeTracNghiem(dung, tong);
    }

    /**
     * Kết quả gộp. {@code rawScore} null nghĩa là <b>chưa chốt được tổng</b> vì còn câu tự luận
     * chưa ai chấm — không phải 0 điểm.
     */
    public record KetQua(BigDecimal rawScore, int daCham, int tongSoCau, int conThieu) {
        public boolean chamXong() { return conThieu == 0; }
    }

    /**
     * Cộng điểm máy chấm với điểm người chấm, quy về thang 10.
     *
     * <p><b>Tổng là tỉ lệ điểm đạt trên điểm tối đa, rồi nhân 10 — không phải phép cộng thẳng
     * điểm từng câu.</b> Chỗ này nhìn qua thì rườm rà, nhưng cộng thẳng là sai, và sai theo kiểu
     * khó thấy:
     *
     * <ul>
     *   <li>Đề 3 câu, mỗi câu trần 3.33. Học sinh làm đúng cả ba được 9.99 chứ không phải 10.
     *       Cộng thẳng thì điểm tối đa của đề 3 câu là một con số không ai đạt tới được.</li>
     *   <li>Nếu chữa bằng cách rải phần dư (3.34 / 3.33 / 3.33) thì hỏng nặng hơn: hai học sinh
     *       cùng đúng 2 trên 3 câu nhận điểm khác nhau, tuỳ đúng câu nào. Đó là bất công thật,
     *       và nó im lặng.</li>
     * </ul>
     *
     * <p>Quy về tỉ lệ thì cả hai chỗ đó biến mất, và với đề toàn trắc nghiệm công thức rút gọn
     * thành đúng {@code soCauDung / soCau × 10} mà {@link McqGrading#grade} vẫn dùng — nên điểm
     * của những bài đã chấm trước lát này không đổi.
     *
     * <p>Chỉ ra tổng khi <b>mọi</b> câu tự luận đã có điểm. Giáo viên chấm dở nửa chừng là chuyện
     * bình thường — chấm 40 bài thì không ai làm một mạch — nên phải lưu được phần đã chấm mà
     * chưa chốt điểm. Chốt sớm thì học sinh nhìn thấy một con số thấp hơn thật, và đó là con số
     * họ sẽ đi khiếu nại.
     */
    public static KetQua tongHop(List<McqGrading.Key> keys, Map<Long, String> baiLam,
                                 Map<Long, BigDecimal> diemNguoiCham) {
        requireGradable(keys);
        BigDecimal toiDaMoiCau = diemToiDaMoiCau(keys.size());
        Map<Long, BigDecimal> tuDong = diemTuDong(keys, baiLam);
        BigDecimal datDuoc = BigDecimal.ZERO;
        int daCham = 0, conThieu = 0;
        for (McqGrading.Key key : keys) {
            BigDecimal diem = tuDong.containsKey(key.problemId())
                    ? tuDong.get(key.problemId())
                    : (diemNguoiCham == null ? null : diemNguoiCham.get(key.problemId()));
            if (diem == null) { conThieu++; continue; }
            datDuoc = datDuoc.add(diem);
            daCham++;
        }
        if (conThieu > 0) return new KetQua(null, daCham, keys.size(), conThieu);
        BigDecimal toiDaCaPhieu = toiDaMoiCau.multiply(BigDecimal.valueOf(keys.size()));
        BigDecimal rawScore = datDuoc.multiply(MAX_SCORE)
                .divide(toiDaCaPhieu, 2, RoundingMode.HALF_UP);
        return new KetQua(rawScore, daCham, keys.size(), 0);
    }

    /**
     * Trần độ dài một câu trả lời tự luận. Lời giải một bài toán viết tay dài lắm là vài nghìn ký
     * tự, nên con số này rộng rãi cho việc học nhưng vẫn chặn được chỗ hở: {@code answer_json}
     * là cột text không giới hạn, mà sổ điểm và hàng chờ chấm đọc cả cột đó cho từng bài — một em
     * dán vào vài megabyte là cả bảng điểm của lớp nặng theo.
     */
    public static final int MAX_DO_DAI_TU_LUAN = 5000;

    /**
     * Cắt khoảng trắng thừa của một câu trả lời tự luận và soát độ dài.
     *
     * <p>Trả null khi chỉ có khoảng trắng — "gõ vài dấu cách rồi nộp" phải bị coi là bỏ trống, chứ
     * không phải là đã trả lời.
     */
    public static String chuanHoaTuLuan(String traLoi) {
        if (traLoi == null) return null;
        String cat = traLoi.strip();
        if (cat.isEmpty()) return null;
        if (cat.length() > MAX_DO_DAI_TU_LUAN) {
            throw new BusinessException("Câu trả lời tự luận không được dài quá " + MAX_DO_DAI_TU_LUAN + " ký tự");
        }
        return cat;
    }

    /**
     * Bài nộp phải trả lời đủ mọi câu. Câu trắc nghiệm chỉ nhận A/B/C/D; câu tự luận nhận văn bản
     * tự do, miễn không để trống.
     *
     * <p>Soát theo từng câu của đề chứ không đếm số phần tử: gửi đủ số đáp án nhưng mang id câu
     * hỏi của đề khác thì vẫn qua được phép đếm, rồi bị chấm 0 mà không hiểu vì sao.
     */
    public static void requireCompleteAnswers(List<McqGrading.Key> keys, Map<Long, String> baiLam) {
        requireGradable(keys);
        for (McqGrading.Key key : keys) {
            String traLoi = baiLam == null ? null : baiLam.get(key.problemId());
            if (laTuLuan(key)) {
                if (chuanHoaTuLuan(traLoi) == null) throw new BusinessException("Bạn phải trả lời đầy đủ tất cả câu hỏi");
            } else {
                if (McqGrading.normalize(traLoi) == null) throw new BusinessException("Bạn phải trả lời đầy đủ tất cả câu hỏi");
                if (!McqGrading.isOption(traLoi)) throw new BusinessException("Đáp án không hợp lệ");
            }
        }
    }
}
