package com.math10.authentication.service;

import com.math10.authentication.dto.ChangePasswordRequest;
import com.math10.authentication.dto.LoginRequest;
import com.math10.authentication.dto.RefreshTokenRequest;
import com.math10.authentication.dto.TokenResponse;

public interface AuthService {

    TokenResponse login(LoginRequest request);

    /** Đổi refresh token lấy cặp token mới; token cũ bị thu hồi ngay (xoay vòng). */
    TokenResponse refresh(RefreshTokenRequest request);

    /** Thu hồi refresh token. Im lặng bỏ qua nếu token không tồn tại hoặc đã thu hồi. */
    void logout(RefreshTokenRequest request);

    void changePassword(Long userId, ChangePasswordRequest request);
}
