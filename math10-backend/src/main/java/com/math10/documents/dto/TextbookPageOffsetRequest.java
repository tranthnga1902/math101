package com.math10.documents.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record TextbookPageOffsetRequest(
        @NotNull @Min(1) Integer pdfPageForBookPageOne
) {
}
