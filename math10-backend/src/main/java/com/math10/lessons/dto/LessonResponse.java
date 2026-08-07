package com.math10.lessons.dto;

import com.math10.common.entity.PublishStatus;

public record LessonResponse(
        Long id,
        Long chapterId,
        String title,
        String publicCode,
        String summary,
        String contentHtml,
        Integer orderIndex,
        PublishStatus status
) {
}
