package com.math10.authentication.service;

import com.math10.authentication.dto.ChangePasswordRequest;
import com.math10.authentication.dto.LoginRequest;
import com.math10.authentication.dto.TokenResponse;

public interface AuthService {

    TokenResponse login(LoginRequest request);

    void changePassword(Long userId, ChangePasswordRequest request);
}
