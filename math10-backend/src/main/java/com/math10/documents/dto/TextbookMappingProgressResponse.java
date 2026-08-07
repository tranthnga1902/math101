package com.math10.documents.dto;

import java.time.LocalDateTime;

public record TextbookMappingProgressResponse(
        Long documentId,
        Integer pdfPage,
        Integer pdfAnchor,
        Integer bookAnchor,
        Integer zoom,
        Integer thumbPage,
        LocalDateTime updatedAt,
        boolean exists
) {}
