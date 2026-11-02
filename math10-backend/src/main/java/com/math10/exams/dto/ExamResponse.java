package com.math10.exams.dto;
import java.time.LocalDateTime;
/** {@code classCount} = số lớp kì thi này đang chạm tới; {@code assignmentCount} = đã rơi xuống mấy lớp. */
public record ExamResponse(
 Long id,String scope,Long courseInstanceId,Long classId,String courseName,String className,
 String title,String description,Long worksheetId,Long worksheetVersionId,String worksheetTitle,
 Integer durationMinutes,LocalDateTime openAt,LocalDateTime dueAt,Long anchorPeriodId,
 Integer maxAttempts,String latePolicy,String answerReveal,Boolean countsInGradebook,
 String status,int classCount,int assignmentCount,LocalDateTime createdAt){}
