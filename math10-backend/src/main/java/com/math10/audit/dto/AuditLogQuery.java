package com.math10.audit.dto;

/**
 * Bộ lọc nhật ký. Mọi trường null (hoặc chuỗi rỗng) nghĩa là không lọc theo tiêu chí đó.
 *
 * <p>{@code days} đếm ngược từ hiện tại thay vì nhận mốc thời gian: màn hình quản trị chỉ có
 * "Hôm nay / 7 ngày / 30 ngày / tất cả", và để máy chủ tự quy ra mốc thì không phải bàn xem
 * chuỗi ngày trên URL thuộc múi giờ nào.</p>
 */
public record AuditLogQuery(Long actorUserId, String actorRole, String targetType, Long targetId,
                            String action, Integer days) {

    /** Chuẩn hoá tại một chỗ: form HTML gửi ô trống thành chuỗi rỗng, không phải null. */
    public AuditLogQuery {
        actorRole = blankToNull(actorRole);
        targetType = blankToNull(targetType);
        action = blankToNull(action);
        if (days != null && days <= 0) days = null;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
