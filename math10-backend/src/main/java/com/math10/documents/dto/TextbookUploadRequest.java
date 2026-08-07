package com.math10.documents.dto;

import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentType;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record TextbookUploadRequest(
        @NotBlank String title,
        @NotNull DocumentType docType,
        @NotNull DocumentAudience audience,
        Long gradeId,
        Long subjectId,
        @Min(1) Integer basePageOffset
) {
}
