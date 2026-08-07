package com.math10.assignments.dto;
import java.time.LocalDateTime;
public record AssignmentProgressResponse(Long assignmentId,Long studentId,LocalDateTime openedAt,LocalDateTime completedAt,Integer completionPercent,String status){}
