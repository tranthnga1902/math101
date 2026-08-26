package com.math10.assignments.dto;
import java.time.LocalDateTime;
public record AssignmentResponse(Long id,Long classId,Long lessonId,Long worksheetId,Long documentId,String title,LocalDateTime dueAt,String status,String requirement,Long createdBy){}
