package com.math10.configuration.staging;

import com.math10.users.entity.User;
import com.math10.users.entity.UserStatus;
import com.math10.users.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "math10.staging-seed-enabled", havingValue = "true")
public class StagingAccountSeeder implements ApplicationRunner {
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${math10.e2e-student-username:}") private String studentUsername;
    @Value("${math10.e2e-student-email:}") private String studentEmail;
    @Value("${math10.e2e-student-password}") private String studentPassword;
    @Value("${math10.e2e-teacher-username:}") private String teacherUsername;
    @Value("${math10.e2e-teacher-email:}") private String teacherEmail;
    @Value("${math10.e2e-teacher-password}") private String teacherPassword;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        String studentIdentifier = resolveIdentifier(studentUsername, studentEmail, "E2E_STUDENT_USERNAME");
        String teacherIdentifier = resolveIdentifier(teacherUsername, teacherEmail, "E2E_TEACHER_USERNAME");
        requireIdentifier(studentIdentifier, "E2E_STUDENT_USERNAME or E2E_STUDENT_EMAIL");
        requireIdentifier(teacherIdentifier, "E2E_TEACHER_USERNAME or E2E_TEACHER_EMAIL");
        requirePassword(studentPassword, "E2E_STUDENT_PASSWORD");
        requirePassword(teacherPassword, "E2E_TEACHER_PASSWORD");
        upsert(studentIdentifier, studentPassword, "Học sinh E2E", "STUDENT");
        upsert(teacherIdentifier, teacherPassword, "Giáo viên E2E", "TEACHER");
    }

    private void upsert(String identifier, String password, String fullName, String role) {
        String username = normalizeUsername(identifier);
        String email = normalizeEmail(identifier);
        User user = userRepository.findByEmail(email)
                .or(() -> userRepository.findByUsernameIgnoreCase(username))
                .orElseGet(User::new);
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(password));
        user.setFullName(fullName);
        user.setRoleCode(role);
        user.setStatus(UserStatus.ACTIVE);
        user.setDeletedAt(null);
        userRepository.save(user);
    }

    private static String resolveIdentifier(String username, String email, String fallbackName) {
        if (username != null && !username.isBlank()) {
            return username.trim();
        }
        if (email != null && !email.isBlank()) {
            return email.trim();
        }
        throw new IllegalStateException(fallbackName + " must be configured");
    }

    static String normalizeUsername(String identifier) {
        String trimmed = identifier == null ? "" : identifier.trim();
        if (trimmed.isBlank()) {
            throw new IllegalStateException("Identifier must not be blank");
        }
        if (trimmed.contains("@")) {
            return trimmed.substring(0, trimmed.indexOf('@')).replaceAll("[^a-zA-Z0-9._-]", "_");
        }
        return trimmed.replaceAll("[^a-zA-Z0-9._-]", "_");
    }

    static String normalizeEmail(String identifier) {
        String trimmed = identifier == null ? "" : identifier.trim();
        if (trimmed.isBlank()) {
            throw new IllegalStateException("Identifier must not be blank");
        }
        if (trimmed.contains("@")) {
            return trimmed.toLowerCase(Locale.ROOT);
        }
        return trimmed.toLowerCase(Locale.ROOT) + "@math10.local";
    }

    private static void requireIdentifier(String value, String variable) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(variable + " must be configured");
        }
    }

    private static void requirePassword(String value, String variable) {
        if (value == null || value.length() < 8) {
            throw new IllegalStateException(variable + " must have at least 8 characters");
        }
    }
}
