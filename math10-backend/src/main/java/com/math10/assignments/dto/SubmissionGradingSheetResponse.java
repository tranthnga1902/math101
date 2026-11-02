package com.math10.assignments.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Bảng chấm chi tiết một bài nộp.
 *
 * <p>{@code rawScore} null nghĩa là còn {@code conThieu} câu tự luận chưa chấm nên chưa chốt được
 * tổng. Trả về cả {@code daCham}/{@code tongSoCau} để giáo viên chấm 40 bài biết mình đang dở đến
 * đâu mà không phải tự đếm.
 */
public record SubmissionGradingSheetResponse(Long submissionId, Long assignmentId, Long studentId,
        String studentName, String gradingStatus, String teacherFeedback,
        BigDecimal maxScoreMoiCau, List<SubmissionItemView> items,
        int daCham, int tongSoCau, int conThieu, BigDecimal rawScore, BigDecimal score,
        boolean submittedLate) {}
