package com.math10.configuration.security;

import com.math10.common.exception.BusinessException;
import com.math10.users.entity.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class JwtService {

    private static final Base64.Encoder URL_ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder URL_DECODER = Base64.getUrlDecoder();

    private final String jwtSecret;
    private final long expiresInSeconds;

    /** Access token không thu hồi được, nên đời nó phải ngắn. Quá ngưỡng này là cấu hình sai. */
    private static final long TOI_DA_GIAY = 24 * 60 * 60;

    public JwtService(
            @Value("${math10.jwt-secret}") String jwtSecret,
            @Value("${math10.jwt-expiration}") long expiresInSeconds
    ) {
        if (expiresInSeconds <= 0 || expiresInSeconds > TOI_DA_GIAY) {
            throw new IllegalStateException(
                    "math10.jwt-expiration tính bằng GIÂY và phải trong khoảng 1..%d, đang nhận %d."
                            .formatted(TOI_DA_GIAY, expiresInSeconds));
        }
        this.jwtSecret = jwtSecret;
        this.expiresInSeconds = expiresInSeconds;
    }

    public long expiresInSeconds() {
        return expiresInSeconds;
    }

    public String createAccessToken(User user) {
        requireConfiguredSecret();
        long now = Instant.now().getEpochSecond();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("sub", user.getId());
        payload.put("email", user.getEmail());
        payload.put("role", user.getRoleCode());
        payload.put("iat", now);
        payload.put("exp", now + expiresInSeconds);

        String header = URL_ENCODER.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String body = URL_ENCODER.encodeToString(toJson(payload).getBytes(StandardCharsets.UTF_8));
        return header + "." + body + "." + sign(header + "." + body);
    }

    public Math10Principal parse(String token) {
        requireConfiguredSecret();
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new BusinessException("Invalid token");
        }
        String signedContent = parts[0] + "." + parts[1];
        if (!constantTimeEquals(sign(signedContent), parts[2])) {
            throw new BusinessException("Invalid token signature");
        }

        String payload = new String(URL_DECODER.decode(parts[1]), StandardCharsets.UTF_8);
        long expiresAt = longField(payload, "exp");
        if (expiresAt < Instant.now().getEpochSecond()) {
            throw new BusinessException("Token expired");
        }
        return new Math10Principal(
                longField(payload, "sub"),
                stringField(payload, "email"),
                stringField(payload, "role")
        );
    }

    private void requireConfiguredSecret() {
        if (jwtSecret == null || jwtSecret.length() < 32) {
            throw new BusinessException("JWT_SECRET must be configured with at least 32 characters");
        }
    }

    private String sign(String content) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(jwtSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return URL_ENCODER.encodeToString(mac.doFinal(content.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception ex) {
            throw new BusinessException("Could not sign JWT");
        }
    }

    private static boolean constantTimeEquals(String expected, String actual) {
        byte[] left = expected.getBytes(StandardCharsets.UTF_8);
        byte[] right = actual.getBytes(StandardCharsets.UTF_8);
        if (left.length != right.length) {
            return false;
        }
        int result = 0;
        for (int i = 0; i < left.length; i++) {
            result |= left[i] ^ right[i];
        }
        return result == 0;
    }

    private static String toJson(Map<String, Object> values) {
        StringBuilder builder = new StringBuilder("{");
        boolean first = true;
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            if (!first) {
                builder.append(',');
            }
            first = false;
            builder.append('"').append(entry.getKey()).append('"').append(':');
            if (entry.getValue() instanceof Number number) {
                builder.append(number);
            } else {
                builder.append('"').append(String.valueOf(entry.getValue()).replace("\"", "\\\"")).append('"');
            }
        }
        return builder.append('}').toString();
    }

    private static String stringField(String json, String field) {
        Matcher matcher = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*\"([^\"]*)\"").matcher(json);
        if (!matcher.find()) {
            throw new BusinessException("Token field is missing: " + field);
        }
        return matcher.group(1);
    }

    private static long longField(String json, String field) {
        Matcher matcher = Pattern.compile("\"" + Pattern.quote(field) + "\"\\s*:\\s*(\\d+)").matcher(json);
        if (!matcher.find()) {
            throw new BusinessException("Token field is missing: " + field);
        }
        return Long.parseLong(matcher.group(1));
    }
}
