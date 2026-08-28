package com.math10.authentication.service.impl;

import com.math10.authentication.dto.ChangePasswordRequest;
import com.math10.authentication.dto.LoginRequest;
import com.math10.authentication.dto.RefreshTokenRequest;
import com.math10.authentication.dto.TokenResponse;
import com.math10.authentication.entity.RefreshToken;
import com.math10.authentication.repository.RefreshTokenRepository;
import com.math10.authentication.service.AuthService;
import com.math10.common.exception.BusinessException;
import com.math10.configuration.security.JwtService;
import com.math10.users.entity.User;
import com.math10.users.entity.UserStatus;
import com.math10.users.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
public class AuthServiceImpl implements AuthService {

    /** Thông điệp duy nhất cho mọi lý do refresh hỏng: không cho client dò xem token có tồn tại hay không. */
    private static final String PHIEN_HONG = "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại";

    private static final SecureRandom NGAU_NHIEN = new SecureRandom();
    private static final Base64.Encoder MA_HOA = Base64.getUrlEncoder().withoutPadding();

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final long refreshExpiresInSeconds;

    public AuthServiceImpl(
            UserRepository userRepository,
            RefreshTokenRepository refreshTokens,
            PasswordEncoder passwordEncoder,
            JwtService jwtService,
            @Value("${math10.refresh-expiration}") long refreshExpiresInSeconds
    ) {
        if (refreshExpiresInSeconds <= 0) {
            throw new IllegalStateException("math10.refresh-expiration tính bằng GIÂY và phải lớn hơn 0");
        }
        this.userRepository = userRepository;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.refreshExpiresInSeconds = refreshExpiresInSeconds;
    }

    @Override
    @Transactional
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
        return capToken(user);
    }

    /**
     * noRollbackFor: nhánh phát hiện token bị dùng lại vừa ghi thu hồi vừa ném lỗi. Mặc định
     * Spring cuốn ngược giao dịch khi gặp RuntimeException, tức là việc thu hồi sẽ bị xoá sạch
     * và biện pháp phòng vệ thành vô nghĩa. Ở đây lỗi chỉ để trả thông điệp cho client.
     */
    @Override
    @Transactional(noRollbackFor = BusinessException.class)
    public TokenResponse refresh(RefreshTokenRequest request) {
        String xuatTrinh = request.refreshToken() == null ? "" : request.refreshToken().trim();
        if (xuatTrinh.isEmpty()) {
            throw new BusinessException(PHIEN_HONG);
        }
        RefreshToken token = refreshTokens.findByTokenHash(bam(xuatTrinh))
                .orElseThrow(() -> new BusinessException(PHIEN_HONG));

        // Token đã thu hồi mà vẫn có người cầm đi đổi: hoặc là bản sao bị đánh cắp, hoặc là
        // bản cũ bị phát lại. Không phân biệt được nên xử lý theo hướng an toàn: cắt sạch
        // mọi phiên của tài khoản này, buộc đăng nhập lại.
        if (token.getRevokedAt() != null) {
            refreshTokens.revokeAllByUserId(token.getUserId(), LocalDateTime.now());
            throw new BusinessException(PHIEN_HONG);
        }
        if (token.getExpiresAt().isBefore(LocalDateTime.now())) {
            throw new BusinessException(PHIEN_HONG);
        }

        User user = userRepository.findById(token.getUserId())
                .orElseThrow(() -> new BusinessException(PHIEN_HONG));
        if (user.getStatus() != UserStatus.ACTIVE) {
            // Khoá tài khoản mà refresh token cũ vẫn đổi được thì khoá thành vô nghĩa.
            refreshTokens.revokeAllByUserId(user.getId(), LocalDateTime.now());
            throw new BusinessException("Tài khoản không hoạt động");
        }

        token.setRevokedAt(LocalDateTime.now());
        return capToken(user);
    }

    @Override
    @Transactional
    public void logout(RefreshTokenRequest request) {
        String xuatTrinh = request == null || request.refreshToken() == null ? "" : request.refreshToken().trim();
        if (xuatTrinh.isEmpty()) {
            return;
        }
        refreshTokens.findByTokenHashAndRevokedAtIsNull(bam(xuatTrinh))
                .ifPresent(token -> token.setRevokedAt(LocalDateTime.now()));
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
        // Đổi mật khẩu là để cắt đuôi người khác đang dùng ké; còn refresh token cũ thì không cắt được.
        refreshTokens.revokeAllByUserId(userId, LocalDateTime.now());
    }

    private TokenResponse capToken(User user) {
        return new TokenResponse(
                jwtService.createAccessToken(user),
                phatRefreshToken(user.getId()),
                jwtService.expiresInSeconds(),
                user.getId(),
                user.getEmail(),
                user.getRoleCode()
        );
    }

    /**
     * Refresh token là chuỗi ngẫu nhiên 256 bit, không phải JWT: nó phải thu hồi được,
     * mà JWT tự xác thực thì không thu hồi được. Chỉ bản băm nằm trong CSDL, nên đọc
     * trộm bảng refresh_tokens cũng không dựng lại được token.
     */
    private String phatRefreshToken(Long userId) {
        byte[] thoc = new byte[32];
        NGAU_NHIEN.nextBytes(thoc);
        String token = MA_HOA.encodeToString(thoc);

        RefreshToken ban = new RefreshToken();
        ban.setUserId(userId);
        ban.setTokenHash(bam(token));
        ban.setExpiresAt(LocalDateTime.now().plusSeconds(refreshExpiresInSeconds));
        refreshTokens.save(ban);
        return token;
    }

    private static String bam(String token) {
        try {
            MessageDigest sha = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(sha.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("Thiếu thuật toán SHA-256", ex);
        }
    }
}
