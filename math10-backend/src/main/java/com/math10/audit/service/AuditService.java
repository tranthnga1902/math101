package com.math10.audit.service;

import com.math10.audit.dto.AuditLogResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface AuditService {
    void record(String action, String targetType, Long targetId, String oldData, String newData);
    Page<AuditLogResponse> findAll(Pageable pageable);
}
