package com.math10.users.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.net.URI;
import java.time.OffsetDateTime;

public record UserImportPresignResponse(
        URI uploadUrl,
        String objectKey,
        @Schema(type = "string", format = "date-time") OffsetDateTime expiresAt
) {
}
