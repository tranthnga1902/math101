package com.math10.chapters.dto;

import com.math10.common.entity.PublishStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ChapterRequest(
        @NotNull(message = "Khóa học là bắt buộc")
        Long courseId,
        @NotBlank(message = "Tên chương là bắt buộc")
        String title,
        @NotNull(message = "Thứ tự là bắt buộc")
        Integer orderIndex,
        @NotNull(message = "Trạng thái là bắt buộc")
        PublishStatus status
) {
}
