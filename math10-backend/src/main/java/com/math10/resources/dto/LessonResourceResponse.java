package com.math10.resources.dto;

import com.math10.resources.entity.ResourceType;

public record LessonResourceResponse(
        Long id,
        Long lessonId,
        ResourceType type,
        String title,
        String externalUrl,
        Long fileAssetId,
        String textContent,
        Integer orderIndex
) {
}
