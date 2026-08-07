package com.math10.documents.dto;

import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentStatus;
import com.math10.documents.entity.DocumentType;

import java.time.LocalDateTime;

public record TextbookListResponse(
        Long id,
        String title,
        DocumentType docType,
        DocumentAudience audience,
        Long gradeId,
        Long subjectId,
        DocumentStatus status,
        Integer totalPages,
        Integer basePageOffset,
        String fileUrl,
        String thumbnailUrl,
        LocalDateTime createdAt
) {
}