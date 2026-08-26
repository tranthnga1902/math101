package com.math10.classes.dto;

import com.math10.classes.entity.ClassStatus;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.LocalDateTime;

public record ClassroomResponse(Long id, String code, String name, Long gradeId, ClassStatus status,
                                String description, Long createdBy,
                                long teacherCount, long studentCount, long courseCount,
                                long curriculumCount, long documentCount,
                                @Schema(type = "string", format = "date-time") LocalDateTime createdAt,
                                @Schema(type = "string", format = "date-time") LocalDateTime updatedAt) {
}
