package com.math10.users.dto;

import com.math10.users.entity.UserStatus;
import java.time.LocalDateTime;
import java.util.List;

public record MyProfileResponse(
        Long id, String code, String username, String email, String fullName, String phone,
        String roleCode, UserStatus status, LocalDateTime createdAt, LocalDateTime lastLoginAt,
        String dateOfBirth, String gender, String address, String avatarUrl,
        Integer grade, List<String> classes, String academicYear, String subject,
        String permissionGroup, String department
) {}
