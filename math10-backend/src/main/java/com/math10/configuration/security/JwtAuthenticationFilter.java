package com.math10.configuration.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** Phiên xem hộ chỉ được phép đọc; mọi phương thức khác đều có thể đổi dữ liệu. */
    private static final Set<String> CHI_DOC = Set.of("GET", "HEAD", "OPTIONS");

    private final JwtService jwtService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.startsWith("Bearer ")) {
            Math10Principal principal;
            try {
                principal = jwtService.parse(authorization.substring(7));
            } catch (RuntimeException ex) {
                SecurityContextHolder.clearContext();
                response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid bearer token");
                return;
            }

            // Vai trò cấp ở đây vẫn là vai của học viên bị xem: đó chính là mục đích, để mọi
            // cổng đọc chạy y như khi học viên tự đăng nhập. Rào chắn nằm ở dòng dưới.
            if (principal.dangXemHo() && !CHI_DOC.contains(request.getMethod())) {
                SecurityContextHolder.clearContext();
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "Phiên xem hộ chỉ được đọc");
                return;
            }

            UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(
                    principal,
                    null,
                    List.of(new SimpleGrantedAuthority("ROLE_" + principal.roleCode()))
            );
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }
        filterChain.doFilter(request, response);
    }
}
