package com.math10.documents.dto;

public record TextbookOpenResponse(
        Long documentId,
        String title,
        String fileUrl,
        Integer pdfPage,
        Integer totalPages
) {
}
