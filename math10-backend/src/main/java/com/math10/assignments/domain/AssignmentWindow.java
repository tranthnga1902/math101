package com.math10.assignments.domain;

import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentProgress;
import com.math10.assignments.entity.AssignmentState;
import com.math10.assignments.entity.LatePolicy;
import com.math10.common.exception.BusinessException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

/**
 * Luật vòng đời của một bài giao. Thuần tính toán, không đụng cơ sở dữ liệu — nên kiểm được
 * bằng unit test thật, không cần dựng cả ứng dụng.
 *
 * <p>Gom về một chỗ vì cùng một câu hỏi ("bài này còn nộp được không?") được hỏi ở bốn nơi:
 * lúc học sinh mở bài, lúc tự động lưu đáp án, lúc nộp, và lúc dựng danh sách bài của học sinh.
 * Mỗi nơi trả lời một kiểu là có nơi hở.
 */
public final class AssignmentWindow {

    private AssignmentWindow() {
    }

    public static AssignmentState stateOf(Assignment assignment, LocalDateTime now) {
        if ("DRAFT".equalsIgnoreCase(assignment.getStatus())) return AssignmentState.DRAFT;
        // Mọi trạng thái không phải PUBLISHED (COMPLETED, ARCHIVED, …) đều coi là đã đóng:
        // thà chặn nhầm một trạng thái lạ còn hơn mở nhầm.
        if (!"PUBLISHED".equalsIgnoreCase(assignment.getStatus())) return AssignmentState.CLOSED;
        if (assignment.getOpenAt() != null && now.isBefore(assignment.getOpenAt())) return AssignmentState.SCHEDULED;
        if (!isLate(assignment, now)) return AssignmentState.OPEN;
        return LatePolicy.of(assignment.getLatePolicy()) == LatePolicy.REJECT
                ? AssignmentState.CLOSED
                : AssignmentState.LATE_OPEN;
    }

    public static boolean isLate(Assignment assignment, LocalDateTime now) {
        return assignment.getDueAt() != null && now.isAfter(assignment.getDueAt());
    }

    /** Số lượt nộp còn lại; {@code null} nghĩa là không giới hạn. */
    public static Integer attemptsLeft(Assignment assignment, AssignmentProgress progress) {
        int max = assignment.getMaxAttempts() == null ? 1 : assignment.getMaxAttempts();
        if (max <= 0) return null;
        int used = progress == null || progress.getAttemptNo() == null ? 0 : progress.getAttemptNo();
        return Math.max(0, max - used);
    }

    /**
     * Cửa duy nhất cho phép ghi bài làm. Ném {@link BusinessException} kèm lý do đọc được,
     * vì học sinh cần biết mình bị chặn vì hết giờ hay vì hết lượt.
     */
    public static void requireSubmittable(Assignment assignment, AssignmentProgress progress, LocalDateTime now) {
        AssignmentState state = stateOf(assignment, now);
        switch (state) {
            case DRAFT -> throw new BusinessException("Bài giao chưa được mở");
            case SCHEDULED -> throw new BusinessException("Bài chưa tới giờ mở (" + assignment.getOpenAt() + ")");
            case CLOSED -> throw new BusinessException(isLate(assignment, now)
                    ? "Đã quá hạn nộp, bài không nhận nộp muộn"
                    : "Bài giao đã đóng");
            default -> {
            }
        }
        if (progress != null && progress.getReturnedAt() != null) {
            throw new BusinessException("Điểm đã được trả; không thể nộp lại");
        }
        Integer left = attemptsLeft(assignment, progress);
        if (left != null && left <= 0) {
            throw new BusinessException("Bạn đã dùng hết " + assignment.getMaxAttempts() + " lượt nộp");
        }
    }

    /**
     * Trừ điểm nộp muộn. Nhận vào điểm gốc để chấm lại nhiều lần không nhân trừ chồng lên nhau —
     * đây là lý do {@code raw_score} được lưu riêng.
     */
    public static BigDecimal applyLatePenalty(Assignment assignment, BigDecimal rawScore, boolean late) {
        if (rawScore == null || !late || LatePolicy.of(assignment.getLatePolicy()) != LatePolicy.PENALTY) return rawScore;
        int penalty = assignment.getLatePenaltyPercent() == null ? 0 : assignment.getLatePenaltyPercent();
        if (penalty <= 0) return rawScore;
        if (penalty >= 100) return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        return rawScore.multiply(BigDecimal.valueOf(100L - penalty))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP)
                .max(BigDecimal.ZERO);
    }

    /**
     * Học sinh có được thấy điểm chưa. Hai đường: giáo viên bấm trả từng bài, hoặc tới giờ
     * công bố đã hẹn trước. Chưa chấm thì giờ công bố cũng không hiện ra được cái gì.
     */
    public static boolean scoreVisible(Assignment assignment, AssignmentProgress progress, LocalDateTime now) {
        if (progress == null) return false;
        if (progress.getReturnedAt() != null) return true;
        LocalDateTime publishAt = assignment.getPublishScoreAt();
        return publishAt != null && progress.getGradedAt() != null && !now.isBefore(publishAt);
    }
}
