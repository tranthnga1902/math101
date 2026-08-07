package com.math10.users.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record UserImportPresignRequest(
        @NotBlank
        @Pattern(regexp = ".*\\.xlsx$", flags = Pattern.Flag.CASE_INSENSITIVE, message = "Chỉ hỗ trợ file .xlsx")
        String fileName,
        String contentType
) {
}
