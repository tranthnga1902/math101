package com.math10.taxonomy.dto;

import jakarta.validation.constraints.NotNull;

public record MergeRequest(
        @NotNull(message = "Nút nguồn là bắt buộc")
        Long sourceId,
        @NotNull(message = "Nút đích là bắt buộc")
        Long targetId
) {
}
