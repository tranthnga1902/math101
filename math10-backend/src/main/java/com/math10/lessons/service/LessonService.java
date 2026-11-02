package com.math10.lessons.service;

import com.math10.courses.dto.request.ReorderRequest;
import com.math10.lessons.dto.LessonRequest;
import com.math10.lessons.dto.LessonResponse;

import java.util.List;

public interface LessonService {

    List<LessonResponse> findByChapter(Long chapterId);

    LessonResponse findById(Long id);

    LessonResponse findPublishedByPublicCode(String publicCode);

    LessonResponse create(LessonRequest request);

    LessonResponse update(Long id, LessonRequest request);

    void softDelete(Long id);

    void reorder(ReorderRequest request);
}
