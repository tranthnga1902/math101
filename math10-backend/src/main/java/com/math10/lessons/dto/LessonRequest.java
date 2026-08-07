package com.math10.lessons.dto;

import com.math10.common.entity.PublishStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record LessonRequest(
        @NotNull(message = "Chương là bắt buộc")
        Long chapterId,
        @NotBlank(message = "Tên bài là bắt buộc")
        String title,
        String publicCode,
        String summary,
        String contentHtml,
        @NotNull(message = "Thứ tự là bắt buộc")
        Integer orderIndex,
        @NotNull(message = "Trạng thái là bắt buộc")
        PublishStatus status
) {
}
