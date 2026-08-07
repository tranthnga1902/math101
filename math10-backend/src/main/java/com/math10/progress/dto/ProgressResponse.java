package com.math10.progress.dto;

import java.time.LocalDateTime;

public record ProgressResponse(
        Long id,
        Long studentId,
        Long lessonId,
        Long worksheetId,
        String status,
        LocalDateTime openedAt,
        LocalDateTime completedAt,
        Integer completionPercent
) {
}
