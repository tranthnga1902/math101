package com.math10.documents.dto;

import java.time.LocalDateTime;

public record LessonDocumentProgressResponse(
        Long id,
        Long lessonDocumentId,
        Long studentId,
        String status,
        LocalDateTime openedAt,
        LocalDateTime lastOpenedAt,
        Integer openCount,
        Integer totalSeconds,
        Integer quizScore,
        LocalDateTime completedAt
) {
}
