package com.math10.users.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record MyProfileUpdateRequest(
        @NotBlank @Size(max = 120) String fullName,
        @NotBlank @Email @Size(max = 180) String email,
        @Size(max = 30) String phone,
        LocalDate dateOfBirth,
        @Size(max = 20) String gender,
        @Size(max = 3_000_000) String avatarUrl
) {}
