package com.math10.documents.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TextbookMappingHistoryResponse(
        Long documentId,
        List<TextbookMappingHistoryEntry> entries,
        LocalDateTime fetchedAt
) {}
