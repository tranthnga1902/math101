package com.math10.chapters.dto;

import com.math10.common.entity.PublishStatus;

public record ChapterResponse(Long id, Long courseId, String title, Integer orderIndex, PublishStatus status) {
}
