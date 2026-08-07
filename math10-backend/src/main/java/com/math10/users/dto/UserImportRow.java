package com.math10.users.dto;

import com.math10.users.entity.UserStatus;
import com.fasterxml.jackson.annotation.JsonIgnore;

import java.util.List;

public record UserImportRow(
        int rowNumber,
        String username,
        String email,
        String fullName,
        String phone,
        String roleCode,
        UserStatus status,
        @JsonIgnore String password,
        List<String> errors
) {
    public boolean valid() {
        return errors == null || errors.isEmpty();
    }
}
