package com.math10.assignments.dto;
import java.time.LocalDateTime;
/** {@code state} là trạng thái suy ra tại thời điểm gọi, không phải cột trong bảng. */
public record AssignmentResponse(Long id,Long classId,Long lessonId,Long worksheetId,Long documentId,String title,
        LocalDateTime openAt,LocalDateTime dueAt,String status,String state,String requirement,
        Integer maxAttempts,String latePolicy,Integer latePenaltyPercent,LocalDateTime publishScoreAt,Long createdBy){}
