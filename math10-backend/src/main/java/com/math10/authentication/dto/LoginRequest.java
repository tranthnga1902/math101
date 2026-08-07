package com.math10.authentication.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank(message = "Tên đăng nhập hoặc email là bắt buộc")
        String identifier,
        @NotBlank(message = "Mật khẩu là bắt buộc")
        String password
) {
}
