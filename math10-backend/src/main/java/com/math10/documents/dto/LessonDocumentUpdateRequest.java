package com.math10.documents.dto;

public record LessonDocumentUpdateRequest(
        boolean required,
        String teacherNote,
        Integer startPage
) {
}
