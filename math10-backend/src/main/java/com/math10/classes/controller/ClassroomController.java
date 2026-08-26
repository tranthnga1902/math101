package com.math10.classes.controller;

import com.math10.classes.dto.ClassroomRequest;
import com.math10.classes.dto.ClassroomResponse;
import com.math10.classes.entity.ClassStatus;
import com.math10.classes.service.ClassroomService;
import com.math10.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes")
public class ClassroomController {
    private final ClassroomService classroomService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Page<ClassroomResponse>> findAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) Long gradeId,
            @RequestParam(required = false) ClassStatus status,
            @PageableDefault(size = 20, sort = "name") Pageable pageable) {
        return ApiResponse.ok("Lấy danh sách lớp thành công", classroomService.findAll(search, gradeId, status, pageable));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<ClassroomResponse> create(@Valid @RequestBody ClassroomRequest request) {
        return ApiResponse.created("Tạo lớp thành công", classroomService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<ClassroomResponse> update(@PathVariable Long id, @Valid @RequestBody ClassroomRequest request) {
        return ApiResponse.ok("Cập nhật lớp thành công", classroomService.update(id, request));
    }

    @PatchMapping("/{id}/lock")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> lock(@PathVariable Long id) { classroomService.lock(id); return ApiResponse.ok("Khóa lớp thành công", null); }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> delete(@PathVariable Long id) { classroomService.softDelete(id); return ApiResponse.noContent("Xóa lớp thành công"); }
}
