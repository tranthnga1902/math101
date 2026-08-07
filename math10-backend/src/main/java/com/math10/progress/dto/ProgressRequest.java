package com.math10.progress.dto;

import jakarta.validation.constraints.NotNull;

public record ProgressRequest(
        @NotNull(message = "Học sinh là bắt buộc")
        Long studentId,
        @NotNull(message = "Bài học là bắt buộc")
        Long lessonId
) {
}
