package com.math10.authentication.controller;

import com.math10.authentication.dto.ChangePasswordRequest;
import com.math10.authentication.dto.ImpersonationResponse;
import com.math10.authentication.dto.LoginRequest;
import com.math10.authentication.dto.RefreshTokenRequest;
import com.math10.authentication.dto.TokenResponse;
import com.math10.authentication.service.AuthService;
import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
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

    @PostMapping("/refresh")
    public ApiResponse<TokenResponse> refresh(@RequestBody RefreshTokenRequest request) {
        return ApiResponse.ok("Làm mới phiên đăng nhập", authService.refresh(request));
    }

    /**
     * Không đòi access token: token truy cập hết hạn rồi thì vẫn phải đăng xuất được.
     * Bản thân refresh token chính là bằng chứng sở hữu phiên cần thu hồi.
     */
    @PostMapping("/logout")
    public ApiResponse<Void> logout(@RequestBody(required = false) RefreshTokenRequest request) {
        authService.logout(request);
        return ApiResponse.ok("Đăng xuất thành công", null);
    }

    /**
     * Xem màn hình bằng mắt học viên. Trả token riêng, đời ngắn, chỉ đọc; phía trình duyệt
     * giữ phiên thật lại để thoát ra được. Không có refresh token đi kèm là cố ý.
     */
    @PostMapping("/impersonate/{studentId}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<ImpersonationResponse> impersonate(@PathVariable Long studentId) {
        return ApiResponse.ok("Đang xem bằng mắt học viên", authService.impersonate(
                currentUserService.requireUserId(),
                currentUserService.requireRoleCode(),
                studentId));
    }

    @PostMapping("/change-password")
    public ApiResponse<Void> changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(currentUserService.requireUserId(), request);
        return ApiResponse.ok("Đổi mật khẩu thành công", null);
    }
}
