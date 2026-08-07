package com.math10.configuration.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

@Service
public class CurrentUserService {

    public Long requireUserId() {
        return requirePrincipal().userId();
    }

    public String requireRoleCode() {
        return requirePrincipal().roleCode();
    }

    private Math10Principal requirePrincipal() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Math10Principal principal)) {
            throw new org.springframework.security.access.AccessDeniedException("Unauthenticated");
        }
        return principal;
    }
}
