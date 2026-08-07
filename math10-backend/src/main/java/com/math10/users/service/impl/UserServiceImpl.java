package com.math10.users.service.impl;

import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.audit.service.AuditService;
import com.math10.users.dto.ResetPasswordRequest;
import com.math10.users.dto.UserRequest;
import com.math10.users.dto.UserResponse;
import com.math10.users.entity.User;
import com.math10.users.entity.UserStatus;
import com.math10.users.repository.UserRepository;
import com.math10.users.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUserService currentUserService;
    private final ClassStudentRepository classStudentRepository;
    private final AuditService auditService;

    @Override
    @Transactional(readOnly = true)
    public Page<UserResponse> findAll(String search, String roleCode, UserStatus status, Pageable pageable) {
        return userRepository.findAll((root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("username")), pattern),
                        cb.like(cb.lower(root.get("email")), pattern),
                        cb.like(cb.lower(root.get("fullName")), pattern)
                ));
            }
            if (roleCode != null && !roleCode.isBlank()) predicates.add(cb.equal(root.get("roleCode"), roleCode));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        }, pageable).map(this::toResponse);
    }

    @Override
    @Transactional
    public UserResponse create(UserRequest request) {
        if (userRepository.existsByEmail(request.email())) {
            throw new BusinessException("Email đã tồn tại");
        }
        if (userRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new BusinessException("Username đã tồn tại");
        }
        User user = new User();
        apply(request, user);
        if (request.password() == null || request.password().length() < 8) {
            throw new BusinessException("Mật khẩu khởi tạo tối thiểu 8 ký tự");
        }
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        UserResponse result = toResponse(userRepository.save(user));
        auditService.record("CREATE", "USER", result.id(), null, result.toString());
        return result;
    }

    @Override
    @Transactional
    public UserResponse update(Long id, UserRequest request) {
        User user = findEntity(id);
        String oldData = toResponse(user).toString();
        userRepository.findByUsernameIgnoreCase(request.username())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> { throw new BusinessException("Username đã tồn tại"); });
        userRepository.findByEmail(request.email())
                .filter(existing -> !existing.getId().equals(id))
                .ifPresent(existing -> { throw new BusinessException("Email đã tồn tại"); });
        apply(request, user);
        UserResponse result = toResponse(user);
        auditService.record("UPDATE", "USER", id, oldData, result.toString());
        return result;
    }

    @Override
    @Transactional
    public void resetPassword(Long id, ResetPasswordRequest request) {
        User target = findEntity(id);
        String actorRole = currentUserService.requireRoleCode();
        if ("TEACHER".equals(actorRole)) {
            boolean ownsStudent = "STUDENT".equals(target.getRoleCode())
                    && classStudentRepository.existsStudentTaughtByTeacher(target.getId(), currentUserService.requireUserId());
            if (!ownsStudent) {
                throw new org.springframework.security.access.AccessDeniedException(
                        "Giáo viên chỉ được reset mật khẩu cho học sinh thuộc lớp mình dạy"
                );
            }
        } else if (!"ADMIN".equals(actorRole)) {
            throw new org.springframework.security.access.AccessDeniedException("Không có quyền reset mật khẩu");
        }
        target.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        auditService.record("RESET_PASSWORD", "USER", id, null, "password reset");
    }

    @Override
    @Transactional
    public void lock(Long id) {
        findEntity(id).setStatus(UserStatus.LOCKED);
        auditService.record("LOCK", "USER", id, null, "LOCKED");
    }

    @Override
    @Transactional
    public void activate(Long id) {
        findEntity(id).setStatus(UserStatus.ACTIVE);
        auditService.record("ACTIVATE", "USER", id, null, "ACTIVE");
    }

    @Override
    @Transactional
    public void disable(Long id) {
        findEntity(id).setStatus(UserStatus.INACTIVE);
        auditService.record("DISABLE", "USER", id, null, "INACTIVE");
    }

    @Override
    @Transactional
    public void softDelete(Long id) {
        findEntity(id).markDeleted();
        auditService.record("DELETE", "USER", id, null, "soft deleted");
    }

    private User findEntity(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy user: " + id));
    }

    private void apply(UserRequest request, User user) {
        user.setUsername(request.username().trim().toLowerCase());
        user.setEmail(request.email());
        user.setFullName(request.fullName());
        user.setPhone(request.phone());
        user.setRoleCode(request.roleCode());
        user.setStatus(request.status());
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getEmail(), user.getFullName(), user.getPhone(), user.getRoleCode(), user.getStatus(), user.getCreatedAt(), user.getUpdatedAt());
    }
}
