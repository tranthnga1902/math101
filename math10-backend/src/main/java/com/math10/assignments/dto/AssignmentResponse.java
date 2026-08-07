package com.math10.assignments.dto;
import java.time.LocalDateTime;
public record AssignmentResponse(Long id,Long classId,Long lessonId,Long worksheetId,String title,LocalDateTime dueAt,String status,Long createdBy){}
