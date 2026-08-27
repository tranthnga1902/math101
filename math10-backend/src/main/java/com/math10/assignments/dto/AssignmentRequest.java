package com.math10.assignments.dto;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
/** {@code maxAttempts} bỏ trống = 1 lượt; 0 = không giới hạn. {@code latePolicy} bỏ trống = REJECT. */
public record AssignmentRequest(@NotNull Long classId,Long lessonId,Long worksheetId,Long documentId,@NotBlank String title,
        LocalDateTime openAt,LocalDateTime dueAt,@NotBlank String status,String requirement,
        @Min(0) @Max(50) Integer maxAttempts,String latePolicy,@Min(0) @Max(100) Integer latePenaltyPercent,
        LocalDateTime publishScoreAt){}
