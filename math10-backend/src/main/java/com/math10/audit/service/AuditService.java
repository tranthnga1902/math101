package com.math10.audit.service;

import com.math10.audit.dto.AuditLogQuery;
import com.math10.audit.dto.AuditLogResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditService {
    void record(String action, String targetType, Long targetId, String oldData, String newData);

    /** Tra nhật ký theo bộ lọc; mọi tiêu chí để trống thì trả về toàn bộ, mới nhất trước. */
    Page<AuditLogResponse> search(AuditLogQuery query, Pageable pageable);
}
