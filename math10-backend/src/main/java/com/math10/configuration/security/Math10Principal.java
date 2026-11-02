package com.math10.configuration.security;

/**
 * Người đang gọi API. {@code actorUserId} chỉ có giá trị trong phiên xem hộ: lúc đó
 * {@code userId}/{@code roleCode} là của học viên bị xem, còn {@code actorUserId} là
 * giáo viên/admin thật sự ngồi sau bàn phím. Giữ danh tính học viên ở đúng vị trí cũ
 * để mọi cổng đọc (LuongNoiDung) chạy nguyên vẹn mà không phải biết tới việc xem hộ.
 */
public record Math10Principal(
        Long userId,
        String email,
        String roleCode,
        Long actorUserId
) {
    public Math10Principal(Long userId, String email, String roleCode) {
        this(userId, email, roleCode, null);
    }

    public boolean dangXemHo() {
        return actorUserId != null;
    }
}
