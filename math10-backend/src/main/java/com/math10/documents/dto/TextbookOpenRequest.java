package com.math10.documents.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record TextbookOpenRequest(
        @NotNull @Min(1) Integer bookPage
) {
}
