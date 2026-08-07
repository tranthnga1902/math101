package com.math10.progress.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.progress.dto.ProgressRequest;
import com.math10.progress.dto.ProgressResponse;
import com.math10.progress.service.ProgressService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/progress")
public class ProgressController {

    private final ProgressService progressService;

    @PatchMapping("/opened")
    @PreAuthorize("hasRole('STUDENT') and #request.studentId == authentication.principal.userId")
    public ApiResponse<ProgressResponse> markOpened(@Valid @RequestBody ProgressRequest request) {
        return ApiResponse.ok("Đã ghi nhận mở bài", progressService.markOpened(request));
    }

    @PatchMapping("/completed")
    @PreAuthorize("hasRole('STUDENT') and #request.studentId == authentication.principal.userId")
    public ApiResponse<ProgressResponse> markCompleted(@Valid @RequestBody ProgressRequest request) {
        return ApiResponse.ok("Đã ghi nhận hoàn thành bài", progressService.markCompleted(request));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER') or (hasRole('STUDENT') and #studentId == authentication.principal.userId)")
    public ApiResponse<List<ProgressResponse>> findByStudent(@RequestParam("studentId") Long studentId) {
        return ApiResponse.ok("Lấy tiến độ học tập thành công", progressService.findByStudent(studentId));
    }
}
