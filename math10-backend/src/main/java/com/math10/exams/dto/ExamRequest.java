package com.math10.exams.dto;
import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;
public record ExamRequest(
 @NotBlank String scope,Long courseInstanceId,Long classId,
 @NotBlank String title,String description,
 Long worksheetId,Long worksheetVersionId,
 Integer durationMinutes,LocalDateTime openAt,LocalDateTime dueAt,Long anchorPeriodId,
 Integer maxAttempts,String latePolicy,String answerReveal,Boolean countsInGradebook){}
