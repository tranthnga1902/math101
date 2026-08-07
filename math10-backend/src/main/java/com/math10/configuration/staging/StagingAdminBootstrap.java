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
@ConditionalOnProperty(name = "math10.staging-admin-seed-enabled", havingValue = "true")
public class StagingAdminBootstrap implements ApplicationRunner {
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;

    @Value("${math10.e2e-admin-username:}") private String username;
    @Value("${math10.e2e-admin-email:}") private String email;
    @Value("${math10.e2e-admin-password}") private String password;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        validate();
        String effectiveEmail = resolveEmail(email, username);
        User admin = users.findByEmail(effectiveEmail).orElseGet(User::new);
        if (admin.getId() != null && !"ADMIN".equals(admin.getRoleCode())) {
            throw new IllegalStateException("Refusing to elevate an existing non-Admin account");
        }
        users.findByUsernameIgnoreCase(username)
                .filter(existing -> admin.getId() == null || !existing.getId().equals(admin.getId()))
                .ifPresent(existing -> {
                    throw new IllegalStateException("E2E_ADMIN_USERNAME already belongs to another account");
                });
        admin.setUsername(username);
        admin.setEmail(effectiveEmail.toLowerCase(Locale.ROOT));
        admin.setPasswordHash(passwordEncoder.encode(password));
        admin.setFullName("Quản trị viên Staging");
        admin.setRoleCode("ADMIN");
        admin.setStatus(UserStatus.ACTIVE);
        admin.setDeletedAt(null);
        users.save(admin);
    }

    private String resolveEmail(String configuredEmail, String configuredUsername) {
        if (configuredEmail != null && !configuredEmail.isBlank()) {
            return configuredEmail.trim();
        }
        return configuredUsername.trim().toLowerCase(Locale.ROOT) + "@math10.local";
    }

    private void validate() {
        if (username == null || !username.matches("^[a-zA-Z0-9._-]{3,80}$")) {
            throw new IllegalStateException("E2E_ADMIN_USERNAME is invalid");
        }
        if (password == null || password.length() < 16) {
            throw new IllegalStateException("E2E_ADMIN_PASSWORD must have at least 16 characters");
        }
    }
}
