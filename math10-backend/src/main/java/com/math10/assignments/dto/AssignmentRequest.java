package com.math10.assignments.dto;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
public record AssignmentRequest(@NotNull Long classId,Long lessonId,Long worksheetId,@NotBlank String title,LocalDateTime dueAt,@NotBlank String status){}
