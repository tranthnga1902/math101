package com.math10.users.dto;

import com.math10.users.entity.UserStatus;
import io.swagger.v3.oas.annotations.media.Schema;

import java.time.LocalDateTime;

public record UserResponse(
        Long id,
        String username,
        String email,
        String fullName,
        String phone,
        String roleCode,
        UserStatus status,
        @Schema(type = "string", format = "date-time") LocalDateTime createdAt,
        @Schema(type = "string", format = "date-time") LocalDateTime updatedAt
) {
}
