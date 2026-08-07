package com.math10.audit.service.impl;

import com.math10.audit.dto.AuditLogResponse;
import com.math10.audit.entity.AuditLog;
import com.math10.audit.repository.AuditLogRepository;
import com.math10.audit.service.AuditService;
import com.math10.configuration.security.CurrentUserService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

@Service
@RequiredArgsConstructor
public class AuditServiceImpl implements AuditService {
    private final AuditLogRepository repository;
    private final CurrentUserService currentUserService;

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String action, String targetType, Long targetId, String oldData, String newData) {
        AuditLog log = new AuditLog();
        try { log.setActorUserId(currentUserService.requireUserId()); } catch (RuntimeException ignored) { }
        log.setAction(action);
        log.setTargetType(targetType);
        log.setTargetId(targetId);
        log.setOldData(oldData);
        log.setNewData(newData);
        if (RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes) {
            HttpServletRequest request = attributes.getRequest();
            String forwarded = request.getHeader("X-Forwarded-For");
            log.setIpAddress(forwarded == null ? request.getRemoteAddr() : forwarded.split(",")[0].trim());
        }
        repository.save(log);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<AuditLogResponse> findAll(Pageable pageable) {
        return repository.findAll(pageable).map(log -> new AuditLogResponse(
                log.getId(), log.getActorUserId(), log.getAction(), log.getTargetType(), log.getTargetId(),
                log.getIpAddress(), log.getOldData(), log.getNewData(), log.getCreatedAt()
        ));
    }
}
