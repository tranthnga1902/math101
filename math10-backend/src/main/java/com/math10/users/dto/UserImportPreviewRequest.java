package com.math10.users.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UserImportPreviewRequest(
        @NotBlank
        @Pattern(regexp = "^admin/user-imports/[A-Za-z0-9._/-]+$")
        String objectKey
) {
}
