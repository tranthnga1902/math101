package com.math10.courses.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.courses.dto.request.CourseRequest;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.courses.dto.response.CourseResponse;
import com.math10.courses.service.CourseService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/courses")
public class CourseController {

    private final CourseService courseService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<Page<CourseResponse>> findAll(Pageable pageable) {
        return ApiResponse.ok("Lấy danh sách khóa học thành công", courseService.findAll(pageable));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<CourseResponse> findById(@PathVariable Long id) {
        return ApiResponse.ok("Lấy khóa học thành công", courseService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<CourseResponse> create(@Valid @RequestBody CourseRequest request) {
        return ApiResponse.created("Tạo khóa học thành công", courseService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<CourseResponse> update(@PathVariable Long id, @Valid @RequestBody CourseRequest request) {
        return ApiResponse.ok("Cập nhật khóa học thành công", courseService.update(id, request));
    }

    @PatchMapping("/reorder")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<Void> reorder(@Valid @RequestBody ReorderRequest request) {
        courseService.reorder(request);
        return ApiResponse.ok("Sắp xếp khóa học thành công", null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        courseService.softDelete(id);
        return ApiResponse.noContent("Xóa khóa học thành công");
    }
}
