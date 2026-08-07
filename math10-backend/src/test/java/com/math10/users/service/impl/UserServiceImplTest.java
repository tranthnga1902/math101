package com.math10.users.service.impl;

import com.math10.configuration.security.CurrentUserService;
import com.math10.audit.service.AuditService;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.users.dto.ResetPasswordRequest;
import com.math10.users.entity.User;
import com.math10.users.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {
    @Mock UserRepository users;
    @Mock PasswordEncoder passwords;
    StubCurrentUserService currentUser;
    @Mock ClassStudentRepository classStudents;
    @Mock AuditService auditService;
    UserServiceImpl service;
    User student;

    @BeforeEach
    void setUp() {
        currentUser = new StubCurrentUserService();
        service = new UserServiceImpl(users, passwords, currentUser, classStudents, auditService);
        student = new User();
        student.setId(9L);
        student.setRoleCode("STUDENT");
        when(users.findById(9L)).thenReturn(Optional.of(student));
    }

    @Test
    void teacherCanResetStudentInOwnClass() {
        currentUser.role = "TEACHER";
        currentUser.userId = 3L;
        when(classStudents.existsStudentTaughtByTeacher(9L, 3L)).thenReturn(true);
        when(passwords.encode("new-pass-123")).thenReturn("hash");

        service.resetPassword(9L, new ResetPasswordRequest("new-pass-123"));

        verify(passwords).encode("new-pass-123");
    }

    @Test
    void teacherCannotResetStudentOutsideOwnClasses() {
        currentUser.role = "TEACHER";
        currentUser.userId = 3L;
        when(classStudents.existsStudentTaughtByTeacher(9L, 3L)).thenReturn(false);

        assertThatThrownBy(() -> service.resetPassword(9L, new ResetPasswordRequest("new-pass-123")))
                .isInstanceOf(AccessDeniedException.class);

        verify(passwords, never()).encode(anyString());
    }

    @Test
    void adminCanResetAnyAccount() {
        currentUser.role = "ADMIN";
        when(passwords.encode("new-pass-123")).thenReturn("hash");

        service.resetPassword(9L, new ResetPasswordRequest("new-pass-123"));

        verify(passwords).encode("new-pass-123");
    }

    static class StubCurrentUserService extends CurrentUserService {
        Long userId = 1L;
        String role = "STUDENT";

        @Override public Long requireUserId() { return userId; }
        @Override public String requireRoleCode() { return role; }
    }
}
