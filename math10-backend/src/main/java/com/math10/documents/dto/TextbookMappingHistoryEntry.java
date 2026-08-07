package com.math10.documents.dto;

import java.time.LocalDateTime;

public record TextbookMappingHistoryEntry(
        Long id,
        Integer pdfPage,
        Integer pdfAnchor,
        Integer bookAnchor,
        String action,
        LocalDateTime createdAt
) {}
