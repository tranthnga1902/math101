package com.math10.resources.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.resources.dto.LessonResourceRequest;
import com.math10.resources.dto.LessonResourceResponse;
import com.math10.resources.service.LessonResourceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/resources")
public class LessonResourceController {

    private final LessonResourceService resourceService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<List<LessonResourceResponse>> findByLesson(@RequestParam Long lessonId) {
        return ApiResponse.ok("Lấy danh sách tài liệu thành công", resourceService.findByLesson(lessonId));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LessonResourceResponse> create(@Valid @RequestBody LessonResourceRequest request) {
        return ApiResponse.created("Tạo tài liệu thành công", resourceService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LessonResourceResponse> update(@PathVariable Long id, @Valid @RequestBody LessonResourceRequest request) {
        return ApiResponse.ok("Cập nhật tài liệu thành công", resourceService.update(id, request));
    }

    @PatchMapping("/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> reorder(@Valid @RequestBody ReorderRequest request) {
        resourceService.reorder(request);
        return ApiResponse.ok("Sắp xếp tài liệu thành công", null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        resourceService.softDelete(id);
        return ApiResponse.noContent("Xóa tài liệu thành công");
    }
}
