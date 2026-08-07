package com.math10.configuration.security;

public record Math10Principal(
        Long userId,
        String email,
        String roleCode
) {
}
