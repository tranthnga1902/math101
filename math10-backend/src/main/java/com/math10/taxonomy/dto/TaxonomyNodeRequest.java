package com.math10.taxonomy.dto;

import jakarta.validation.constraints.NotBlank;

public record TaxonomyNodeRequest(
        @NotBlank(message = "Tên là bắt buộc")
        String title,
        String description
) {
}
