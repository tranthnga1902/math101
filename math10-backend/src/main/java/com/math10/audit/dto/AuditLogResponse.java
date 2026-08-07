package com.math10.audit.dto;

import java.time.LocalDateTime;

public record AuditLogResponse(
        Long id, Long actorUserId, String action, String targetType, Long targetId,
        String ipAddress, String oldData, String newData, LocalDateTime createdAt
) {
}
