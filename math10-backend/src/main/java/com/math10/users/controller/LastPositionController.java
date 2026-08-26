package com.math10.users.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import com.math10.users.entity.UserLastPosition;
import com.math10.users.repository.UserLastPositionRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Vị trí học gần nhất của chính người đang đăng nhập. Luôn đọc/ghi theo id lấy từ token,
 * không nhận userId từ client, nên không có đường xem hay ghi đè vị trí của người khác.
 * Mọi vai trò đều dùng được — endpoint chỉ cần đăng nhập.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/me/last-position")
public class LastPositionController {

    private final UserLastPositionRepository positions;
    private final CurrentUserService current;

    /** Chưa từng lưu thì trả data null — phía giao diện coi như không có gì để "Học tiếp". */
    @GetMapping
    public ApiResponse<UserLastPosition> get() {
        return ApiResponse.ok("Vị trí học gần nhất", positions.findById(current.requireUserId()).orElse(null));
    }

    /** Upsert: mỗi người đúng một dòng nên ghi mới là ghi đè, dùng PUT chứ không phải POST. */
    @PutMapping
    @Transactional
    public ApiResponse<Void> save(@Valid @RequestBody LastPositionRequest request) {
        Long userId = current.requireUserId();
        UserLastPosition row = positions.findById(userId).orElseGet(UserLastPosition::new);
        row.setUserId(userId);
        row.setRoute(request.route());
        row.setContext(request.context());
        row.setUpdatedAt(LocalDateTime.now());
        positions.save(row);
        return ApiResponse.noContent("Đã lưu vị trí học");
    }

    public record LastPositionRequest(
            @NotBlank @Size(max = 512) String route,
            Map<String, Object> context
    ) {}
}
