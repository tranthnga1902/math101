package com.math10.authentication.dto;

/**
 * Dùng chung cho /auth/refresh và /auth/logout.
 * Cố tình không đặt @NotBlank: logout phải im lặng bỏ qua khi client không còn token,
 * còn refresh tự kiểm tra và ném lỗi nghiệp vụ với thông điệp tiếng Việt.
 */
public record RefreshTokenRequest(String refreshToken) {
}
