package com.math10.lessons.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.lessons.dto.LessonRequest;
import com.math10.lessons.dto.LessonResponse;
import com.math10.lessons.service.LessonService;
import com.math10.progress.dto.ProgressRequest;
import com.math10.progress.dto.ProgressResponse;
import com.math10.progress.service.ProgressService;
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
@RequestMapping("/api/lessons")
public class LessonController {

    private final LessonService lessonService;
    private final ProgressService progressService;
    private final CurrentUserService currentUserService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<List<LessonResponse>> findByChapter(@RequestParam Long chapterId) {
        return ApiResponse.ok("Lesson list loaded", lessonService.findByChapter(chapterId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<LessonResponse> findById(@PathVariable Long id) {
        return ApiResponse.ok("Lesson loaded", lessonService.findById(id));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LessonResponse> create(@Valid @RequestBody LessonRequest request) {
        return ApiResponse.created("Lesson created", lessonService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<LessonResponse> update(@PathVariable Long id, @Valid @RequestBody LessonRequest request) {
        return ApiResponse.ok("Lesson updated", lessonService.update(id, request));
    }

    @PatchMapping("/reorder")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> reorder(@Valid @RequestBody ReorderRequest request) {
        lessonService.reorder(request);
        return ApiResponse.ok("Lessons reordered", null);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        lessonService.softDelete(id);
        return ApiResponse.noContent("Lesson deleted");
    }

    @PatchMapping("/{id}/progress")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<ProgressResponse> progress(@PathVariable Long id, @RequestBody LessonProgressRequest request) {
        ProgressRequest progressRequest = new ProgressRequest(currentUserService.requireUserId(), id);
        if ("COMPLETED".equalsIgnoreCase(request.status())) {
            return ApiResponse.ok("Lesson completed", progressService.markCompleted(progressRequest));
        }
        return ApiResponse.ok("Lesson opened", progressService.markOpened(progressRequest));
    }

    public record LessonProgressRequest(String status) {
    }
}
