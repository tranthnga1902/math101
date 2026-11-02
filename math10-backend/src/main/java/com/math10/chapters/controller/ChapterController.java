package com.math10.chapters.controller;

import com.math10.chapters.dto.ChapterRequest;
import com.math10.chapters.dto.ChapterResponse;
import com.math10.chapters.service.ChapterService;
import com.math10.common.dto.ApiResponse;
import com.math10.courses.dto.request.ReorderRequest;
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
@RequestMapping("/api/chapters")
public class ChapterController {

    private final ChapterService chapterService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<List<ChapterResponse>> findByCourse(@RequestParam Long courseId) {
        return ApiResponse.ok("Lấy danh sách chương thành công", chapterService.findByCourse(courseId));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ChapterResponse> create(@Valid @RequestBody ChapterRequest request) {
        return ApiResponse.created("Tạo chương thành công", chapterService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<ChapterResponse> update(@PathVariable Long id, @Valid @RequestBody ChapterRequest request) {
        return ApiResponse.ok("Cập nhật chương thành công", chapterService.update(id, request));
    }

    @PatchMapping("/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> reorder(@Valid @RequestBody ReorderRequest request) {
        chapterService.reorder(request);
        return ApiResponse.ok("Sắp xếp chương thành công", null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        chapterService.softDelete(id);
        return ApiResponse.noContent("Xóa chương thành công");
    }
}
