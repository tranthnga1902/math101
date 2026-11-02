package com.math10.authentication.dto;

/**
 * Phiên xem hộ. Cố tình KHÔNG có refresh token: hết hạn là hết xem, không gia hạn được,
 * nên một cửa sổ bỏ quên cũng tự đóng. Các trường {@code studentXxx} là danh tính mà
 * backend sẽ thấy trong suốt phiên; {@code actorUserId} là người thật ngồi sau bàn phím.
 */
public record ImpersonationResponse(
        String accessToken,
        long expiresInSeconds,
        Long studentId,
        String studentName,
        String studentEmail,
        Long actorUserId
) {
}
