package com.math10.configuration.security;

import com.math10.common.exception.BusinessException;
import com.math10.users.entity.User;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {

    private static final String SECRET = "math10-test-secret-with-at-least-32-characters";

    @Test
    void createsAndParsesAccessToken() {
        JwtService service = new JwtService(SECRET, 1800);
        User user = new User();
        user.setId(42L);
        user.setEmail("student@math10.vn");
        user.setRoleCode("STUDENT");

        Math10Principal principal = service.parse(service.createAccessToken(user));

        assertThat(principal.userId()).isEqualTo(42L);
        assertThat(principal.email()).isEqualTo("student@math10.vn");
        assertThat(principal.roleCode()).isEqualTo("STUDENT");
    }

    @Test
    void rejectsInvalidSignature() {
        JwtService service = new JwtService(SECRET, 1800);
        assertThatThrownBy(() -> service.parse("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOjF9.invalid"))
                .isInstanceOf(BusinessException.class)
                .hasMessage("Invalid token signature");
    }
}
