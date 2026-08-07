package com.math10.audit.controller;

import com.math10.audit.dto.AuditLogResponse;
import com.math10.audit.service.AuditService;
import com.math10.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/audit-logs")
public class AuditController {
    private final AuditService auditService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<AuditLogResponse>> findAll(Pageable pageable) {
        return ApiResponse.ok("Lấy nhật ký hoạt động thành công", auditService.findAll(pageable));
    }
}
