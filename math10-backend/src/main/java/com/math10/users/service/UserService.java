package com.math10.users.service;

import com.math10.users.dto.ResetPasswordRequest;
import com.math10.users.dto.UserRequest;
import com.math10.users.dto.UserResponse;
import com.math10.users.entity.UserStatus;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface UserService {

    Page<UserResponse> findAll(String search, String roleCode, UserStatus status, Pageable pageable);

    UserResponse create(UserRequest request);

    UserResponse update(Long id, UserRequest request);

    void resetPassword(Long id, ResetPasswordRequest request);

    void lock(Long id);

    void activate(Long id);

    void disable(Long id);

    void softDelete(Long id);
}
