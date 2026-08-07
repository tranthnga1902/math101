package com.math10.authentication.service.impl;

import com.math10.authentication.dto.ChangePasswordRequest;
import com.math10.authentication.dto.LoginRequest;
import com.math10.authentication.dto.TokenResponse;
import com.math10.authentication.service.AuthService;
import com.math10.common.exception.BusinessException;
import com.math10.configuration.security.JwtService;
import com.math10.users.entity.User;
import com.math10.users.entity.UserStatus;
import com.math10.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Override
    @Transactional(readOnly = true)
    public TokenResponse login(LoginRequest request) {
        String identifier = request.identifier().trim();
        User user = (identifier.contains("@")
                ? userRepository.findByEmail(identifier.toLowerCase())
                : userRepository.findByUsernameIgnoreCase(identifier))
                .orElseThrow(() -> new BusinessException("Tên đăng nhập/email hoặc mật khẩu không đúng"));
        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException("Tên đăng nhập/email hoặc mật khẩu không đúng");
        }
        if (user.getStatus() != UserStatus.ACTIVE) {
            throw new BusinessException("Tài khoản không hoạt động");
        }

        return new TokenResponse(
                jwtService.createAccessToken(user),
                "",
                jwtService.expiresInSeconds(),
                user.getId(),
                user.getEmail(),
                user.getRoleCode()
        );
    }

    @Override
    @Transactional
    public void changePassword(Long userId, ChangePasswordRequest request) {
        if (!request.newPassword().equals(request.confirmPassword())) {
            throw new BusinessException("Xác nhận mật khẩu mới không khớp");
        }
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException("Không tìm thấy tài khoản"));
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new BusinessException("Mật khẩu hiện tại không đúng");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new BusinessException("Mật khẩu mới phải khác mật khẩu hiện tại");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    }
}
