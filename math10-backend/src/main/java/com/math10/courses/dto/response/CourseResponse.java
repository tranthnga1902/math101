package com.math10.courses.dto.response;

import com.math10.courses.entity.CourseStatus;

import java.time.LocalDateTime;

public record CourseResponse(
        Long id,
        String code,
        String name,
        String description,
        CourseStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
