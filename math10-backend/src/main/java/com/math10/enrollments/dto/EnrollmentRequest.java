package com.math10.enrollments.dto;

import jakarta.validation.constraints.NotNull;

public record EnrollmentRequest(
        @NotNull(message = "Lớp là bắt buộc")
        Long classId,
        Long userId,
        Long courseId
) {
}
