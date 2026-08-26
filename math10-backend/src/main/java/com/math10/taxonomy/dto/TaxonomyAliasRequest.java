package com.math10.taxonomy.dto;

import jakarta.validation.constraints.NotBlank;

public record TaxonomyAliasRequest(
        @NotBlank(message = "Tên gọi khác là bắt buộc")
        String alias
) {
}
