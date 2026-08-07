package com.math10.users.dto;

import com.math10.users.entity.UserStatus;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UserRequest(
        @NotBlank @Size(max = 80)
        @Pattern(regexp = "^[a-zA-Z0-9._-]+$", message = "Username không hợp lệ")
        String username,
        @Email @NotBlank String email,
        @NotBlank @Size(max = 120) String fullName,
        String phone,
        @NotBlank String roleCode,
        @NotNull UserStatus status,
        @Size(min = 8, message = "Mật khẩu tối thiểu 8 ký tự") String password
) {
}
