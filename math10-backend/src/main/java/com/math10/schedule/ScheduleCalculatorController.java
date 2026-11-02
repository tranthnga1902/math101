package com.math10.schedule;

import com.math10.common.dto.ApiResponse;
import com.math10.schedule.ScheduleDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/classes/{classId}/schedule")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ScheduleCalculatorController {

    private final ScheduleCalculatorService service;

    @PostMapping("/calculate")
    public ApiResponse<CalculateResult> calculate(@PathVariable long classId, @RequestBody CalculateRequest request) {
        return ApiResponse.ok("Đã tính toán tiến độ lịch học", service.calculate(classId, request));
    }

    @PostMapping("/calculate-reverse")
    public ApiResponse<ReverseResult> calculateReverse(@PathVariable long classId, @RequestBody ReverseRequest request) {
        return ApiResponse.ok("Đã tính toán số buổi cần thiết", service.calculateReverse(request));
    }

    @GetMapping("/preview")
    public ApiResponse<List<SessionPreview>> preview(@PathVariable long classId) {
        // G9 stub
        return ApiResponse.ok("Bản xem trước lịch trải (G9)", List.of());
    }

    @PostMapping("/generate")
    public ApiResponse<String> generate(@PathVariable long classId) {
        // G9 stub
        return ApiResponse.ok("Chức năng sinh lịch đang xây dựng (G9)", "OK");
    }
}
