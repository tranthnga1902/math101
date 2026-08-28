package com.math10.authentication.service.impl;

import com.math10.authentication.dto.ChangePasswordRequest;
import com.math10.authentication.dto.LoginRequest;
import com.math10.authentication.repository.RefreshTokenRepository;
import com.math10.common.exception.BusinessException;
import com.math10.configuration.security.JwtService;
import com.math10.users.entity.User;
import com.math10.users.entity.UserStatus;
import com.math10.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {
    @Mock UserRepository users;
    @Mock RefreshTokenRepository refreshTokens;
    @Mock PasswordEncoder passwords;
    @Mock JwtService jwt;
    AuthServiceImpl service;
    User user;

    @BeforeEach
    void setUp() {
        service = new AuthServiceImpl(users, refreshTokens, passwords, jwt, 2_592_000L);
        user = new User();
        user.setId(1L);
        user.setUsername("student01");
        user.setEmail("student@math10.vn");
        user.setPasswordHash("old-hash");
        user.setStatus(UserStatus.ACTIVE);
        user.setRoleCode("STUDENT");
    }

    @Test
    void logsInWithUsernameAndReturnsUserRole() {
        when(users.findByUsernameIgnoreCase("student01")).thenReturn(Optional.of(user));
        when(passwords.matches("secret123", "old-hash")).thenReturn(true);
        when(jwt.createAccessToken(user)).thenReturn("token");
        when(jwt.expiresInSeconds()).thenReturn(3600L);

        var response = service.login(new LoginRequest("student01", "secret123"));

        assertThat(response.accessToken()).isEqualTo("token");
        assertThat(response.userId()).isEqualTo(1L);
        assertThat(response.email()).isEqualTo("student@math10.vn");
        assertThat(response.roleCode()).isEqualTo("STUDENT");
        verify(jwt).createAccessToken(user);
    }

    @Test
    void blocksInactiveAccount() {
        user.setStatus(UserStatus.INACTIVE);
        when(users.findByEmail("student@math10.vn")).thenReturn(Optional.of(user));
        when(passwords.matches("secret123", "old-hash")).thenReturn(true);

        assertThatThrownBy(() -> service.login(new LoginRequest("student@math10.vn", "secret123")))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Tài khoản không hoạt động");
    }

    @Test
    void changesPasswordAfterVerifyingCurrentPassword() {
        when(users.findById(1L)).thenReturn(Optional.of(user));
        when(passwords.matches("old-password", "old-hash")).thenReturn(true);
        when(passwords.matches("new-password", "old-hash")).thenReturn(false);
        when(passwords.encode("new-password")).thenReturn("new-hash");

        service.changePassword(1L, new ChangePasswordRequest("old-password", "new-password", "new-password"));

        verify(passwords).encode("new-password");
    }
}
