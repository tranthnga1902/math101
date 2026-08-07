package com.math10.documents.dto;

import jakarta.validation.constraints.NotNull;

public record LessonDocumentRequest(
        @NotNull Long documentId,
        boolean required,
        String teacherNote,
        Integer startPage
) {
}
