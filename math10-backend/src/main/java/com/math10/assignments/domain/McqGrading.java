package com.math10.assignments.domain;

import com.math10.common.exception.BusinessException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Chấm trắc nghiệm — một bản luật duy nhất.
 *
 * <p>Trước đây luật này được viết ba lần: lúc học sinh nộp bài, lúc giáo viên bấm "Chấm lại",
 * và lúc dựng bảng tỉ lệ đúng từng câu. Ba bản đã lệch nhau thật: nộp bài thì báo lỗi khi đề
 * có câu chưa nhập đáp án, còn chấm lại thì lặng lẽ tính cả lớp là sai câu đó rồi vẫn chia
 * cho đủ số câu — tức là thêm một câu quên đáp án rồi bấm chấm lại là tụt điểm cả lớp mà
 * không ai được báo. Bảng thống kê thì hiển thị câu đó "0% đúng" kèm cờ đỏ.
 *
 * <p>Lớp này không biết gì về JPA: người gọi tự dựng danh sách {@link Key} từ đề. Nhờ vậy
 * test chấm điểm chỉ cần vài dòng, không phải dựng repository.
 */
public final class McqGrading {

    private McqGrading() {
    }

    /**
     * Một câu trong đề kèm đáp án đúng.
     *
     * <p>{@code multipleChoice} false nghĩa là câu <b>tự luận</b> — phải người chấm, xem
     * {@link WorksheetScoring}. Cần cờ riêng vì {@code correctOption} null mang hai nghĩa khác hẳn
     * nhau: "câu này không có đáp án để chấm máy" và "đây là câu trắc nghiệm mà giáo viên quên
     * nhập đáp án". Gộp hai nghĩa đó lại thì mỗi lần quên nhập đáp án là một câu tự luận mọc ra
     * lặng lẽ, và {@link #requireGradable} — cái lưới chặn quên đáp án — mất tác dụng.
     *
     * <p>Với {@code multipleChoice} true mà {@code correctOption} null thì đề hỏng, không phải
     * đề tự luận: {@link #requireGradable} chặn.
     */
    public record Key(Long problemId, String correctOption, boolean multipleChoice) {

        /** Câu trắc nghiệm — dạng gọn cho những chỗ chỉ làm việc với đề trắc nghiệm. */
        public Key(Long problemId, String correctOption) {
            this(problemId, correctOption, true);
        }
    }

    /** Kết quả chấm. {@code rawScore} là điểm gốc thang 10, chưa trừ phần trăm nộp muộn. */
    public record Result(int correct, int total, BigDecimal rawScore) {
    }

    /** Thang điểm của một phiếu trắc nghiệm. */
    public static final BigDecimal MAX_SCORE = BigDecimal.TEN;

    private static final Set<String> OPTIONS = Set.of("A", "B", "C", "D");

    /** Chuẩn hoá đáp án: bỏ khoảng trắng, đưa về chữ hoa. Null vào thì null ra. */
    public static String normalize(String option) {
        if (option == null) return null;
        String trimmed = option.trim().toUpperCase(Locale.ROOT);
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static boolean isOption(String option) {
        // Phải chặn null trước: Set.of(...) ném NullPointerException khi hỏi contains(null).
        String normalized = normalize(option);
        return normalized != null && OPTIONS.contains(normalized);
    }

    /**
     * Câu này là trắc nghiệm hay tự luận. Đề không có cột "loại câu", nên phải suy ra từ dữ liệu
     * sẵn có — và suy sai thì hoặc là bài trắc nghiệm bỗng bắt giáo viên chấm tay, hoặc là câu
     * quên đáp án lọt lưới {@link #requireGradable}.
     *
     * <p>Trắc nghiệm khi <b>có phương án in ra, hoặc đã nhập đáp án đúng</b>. Vế thứ hai là để
     * không phá đề cũ: nhiều câu nhập từ file PDF/DOCX in bốn phương án ngay trong đề bài, bốn cột
     * {@code option_a..d} để trống nhưng {@code correct_option} vẫn có — bỏ vế đó thì toàn bộ
     * những phiếu ấy lặng lẽ biến thành đề tự luận và điểm cũ không tính lại được.
     *
     * <p>Còn lại — không phương án, không đáp án — là tự luận. Một câu trắc nghiệm mà thiếu cả hai
     * thì trong dữ liệu không còn dấu hiệu nào để nhận ra; chỗ chữa là lúc soạn đề, không phải ở đây.
     *
     * <p>Luật nằm ở đây, nhận vào bốn phương án và đáp án dạng chuỗi, chứ không nhận entity: màn
     * hình làm bài của học sinh đọc đề bằng JDBC thô còn đường chấm đọc bằng JPA, mà hai bên bắt
     * buộc phải trả lời giống nhau — lệch một câu là học sinh gõ tự luận vào câu mà server đợi A/B/C/D.
     */
    public static boolean laTracNghiem(String optionA, String optionB, String optionC, String optionD,
                                       String correctOption) {
        return coChu(optionA) || coChu(optionB) || coChu(optionC) || coChu(optionD) || isOption(correctOption);
    }

    private static boolean coChu(String value) {
        return value != null && !value.isBlank();
    }

    /**
     * Câu này có được trả lời đúng không. Đề chưa có đáp án thì câu nào cũng không tính là đúng —
     * nhưng {@link #grade} không bao giờ chấm tới trạng thái đó, vì {@link #requireGradable}
     * đã chặn từ trước. Hàm này để riêng cho bảng thống kê dùng lại đúng phép so sánh.
     */
    public static boolean isCorrect(Key key, String answer) {
        String expected = normalize(key.correctOption());
        String actual = normalize(answer);
        return expected != null && expected.equals(actual);
    }

    /** Đề phải có câu, và câu nào cũng phải có đáp án hợp lệ, thì mới chấm được. */
    public static void requireGradable(List<Key> keys) {
        if (keys == null || keys.isEmpty()) throw new BusinessException("Đề chưa có câu hỏi");
        List<Long> missing = new ArrayList<>();
        for (Key key : keys) if (!isOption(key.correctOption())) missing.add(key.problemId());
        if (!missing.isEmpty()) {
            throw new BusinessException("Đề có câu chưa được cấu hình đáp án đúng: " + missing);
        }
    }

    /**
     * Bài nộp phải trả lời đủ mọi câu của đề, và chỉ được trả lời A, B, C hoặc D.
     *
     * <p>Đếm số phần tử là chưa đủ: gửi đúng 20 đáp án nhưng mang id câu hỏi của đề khác thì
     * vẫn qua được phép đếm, rồi bị chấm 0 điểm mà không hiểu vì sao. Ở đây soát theo từng câu
     * của đề.
     */
    public static void requireCompleteAnswers(List<Key> keys, Map<Long, String> answers) {
        requireGradable(keys);
        for (Key key : keys) {
            String answer = answers == null ? null : answers.get(key.problemId());
            if (normalize(answer) == null) throw new BusinessException("Bạn phải trả lời đầy đủ tất cả câu hỏi");
            if (!isOption(answer)) throw new BusinessException("Đáp án không hợp lệ");
        }
    }

    /**
     * Chấm một bài. Câu không trả lời tính là sai; điểm gốc thang 10 làm tròn hai chữ số.
     * Không trừ điểm nộp muộn ở đây — việc đó là của {@link AssignmentWindow#applyLatePenalty},
     * và nó phải tính từ điểm gốc để chấm lại nhiều lần không nhân trừ chồng lên nhau.
     */
    public static Result grade(List<Key> keys, Map<Long, String> answers) {
        requireGradable(keys);
        int correct = 0;
        for (Key key : keys) {
            if (isCorrect(key, answers == null ? null : answers.get(key.problemId()))) correct++;
        }
        int total = keys.size();
        BigDecimal rawScore = BigDecimal.valueOf(correct)
                .multiply(MAX_SCORE)
                .divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP);
        return new Result(correct, total, rawScore);
    }
}
