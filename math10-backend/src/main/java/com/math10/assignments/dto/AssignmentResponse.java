package com.math10.assignments.dto;
import java.time.LocalDateTime;
import java.util.List;
/**
 * {@code state} là trạng thái suy ra tại thời điểm gọi, không phải cột trong bảng.
 *
 * <p>{@code dueReason} chỉ có khi bài neo vào buổi mà chưa suy ra được hạn — và khi đó màn hình
 * phải nói đúng câu ấy chứ không hiện một ngày đoán.
 */
public record AssignmentResponse(Long id,Long classId,Long lessonId,Long worksheetId,Long documentId,String title,
        LocalDateTime openAt,LocalDateTime dueAt,String status,String state,String requirement,
        Integer maxAttempts,String latePolicy,Integer latePenaltyPercent,LocalDateTime publishScoreAt,Long createdBy,
        Long anchorPeriodId,String anchorPeriodLabel,Integer dueBufferMinutes,String dueReason,
        String taskKind,String answerReveal,Boolean countsInGradebook,String targetScope,List<Long> studentIds){}
