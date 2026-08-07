package com.math10.publicapi.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.lessons.dto.LessonResponse;
import com.math10.lessons.service.LessonService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/public/lessons")
public class PublicLessonController {

    private final LessonService lessonService;

    @GetMapping("/{publicCode}")
    public ApiResponse<LessonResponse> findByPublicCode(@PathVariable String publicCode) {
        return ApiResponse.ok("Lấy bài học public thành công", lessonService.findPublishedByPublicCode(publicCode));
    }
}
