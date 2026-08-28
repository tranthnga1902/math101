package com.math10.assignments.dto;

import java.math.BigDecimal;

/**
 * Một câu trong bảng chấm chi tiết.
 *
 * <p>{@code score} null nghĩa là <b>chưa ai chấm câu này</b> — khác hẳn 0 điểm, và hai chỗ hiển
 * thị (bảng chấm của giáo viên, bảng kết quả của học sinh) đều phải phân biệt được.
 *
 * <p>{@code essay} true thì {@code score} do giáo viên nhập; false thì máy chấm theo đáp án và
 * giáo viên không sửa được — chỉ có một chỗ quyết định điểm trắc nghiệm là đáp án của đề.
 */
public record SubmissionItemView(Long problemId, int orderNo, String publicCode, String statement,
        boolean essay, String correctOption, String studentAnswer,
        BigDecimal score, BigDecimal maxScore, String feedback) {}
