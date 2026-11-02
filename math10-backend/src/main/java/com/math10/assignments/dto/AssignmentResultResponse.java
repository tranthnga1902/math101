package com.math10.assignments.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * {@code attemptsLeft} null nghĩa là không giới hạn lượt nộp. {@code rawScore} chỉ hiện khi điểm
 * đã được công bố và bài có bị trừ điểm nộp muộn — để học sinh biết vì sao 8.0 thành 6.4.
 *
 * <p>{@code items} là điểm và nhận xét từng câu, rỗng khi điểm chưa được công bố. Mỗi phần tử
 * trong đó <b>luôn có {@code correctOption} để trống</b>: đây là đường trả về cho học sinh, và
 * đáp án đúng của đề thì không đi qua đường này — bài cho nộp nhiều lượt hoặc giao lệch giờ giữa
 * các lớp thì một em xem xong đáp án là cả khối biết.
 */
public record AssignmentResultResponse(Long assignmentId, Long studentId, String gradingStatus,
        Integer completionPercent, LocalDateTime submittedAt, LocalDateTime gradedAt, LocalDateTime returnedAt,
        BigDecimal score, BigDecimal maxScore, Integer correctCount, Integer totalQuestions,
        String teacherFeedback, Map<Long,String> answers,
        String state, LocalDateTime openAt, LocalDateTime dueAt, Integer attemptsLeft,
        boolean submittedLate, BigDecimal rawScore, List<SubmissionItemView> items) {}
