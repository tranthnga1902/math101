package com.math10.resources.dto;

import com.math10.resources.entity.ResourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LessonResourceRequest(
        @NotNull(message = "Bài học là bắt buộc")
        Long lessonId,
        @NotNull(message = "Loại tài liệu là bắt buộc")
        ResourceType type,
        @NotBlank(message = "Tên tài liệu là bắt buộc")
        String title,
        String externalUrl,
        Long fileAssetId,
        String textContent,
        @NotNull(message = "Thứ tự là bắt buộc")
        Integer orderIndex
) {
}
