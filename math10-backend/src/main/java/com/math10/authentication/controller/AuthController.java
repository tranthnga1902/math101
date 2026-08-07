package com.math10.authentication.controller;

import com.math10.authentication.dto.ChangePasswordRequest;
import com.math10.authentication.dto.LoginRequest;
import com.math10.authentication.dto.TokenResponse;
import com.math10.authentication.service.AuthService;
import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService authService;
    private final CurrentUserService currentUserService;

    @PostMapping("/login")
    public ApiResponse<TokenResponse> login(@Valid @RequestBody LoginRequest request) {
        return ApiResponse.ok("Đăng nhập thành công", authService.login(request));
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(currentUserService.requireUserId(), request);
        return ApiResponse.ok("Đổi mật khẩu thành công", null);
    }
}
