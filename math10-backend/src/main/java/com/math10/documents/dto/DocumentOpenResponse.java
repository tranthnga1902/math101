package com.math10.documents.dto;

public record DocumentOpenResponse(
        Long lessonDocumentId,
        String title,
        String fileUrl,
        Integer startPage
) {
}
