package com.math10.resources.service;

import com.math10.courses.dto.request.ReorderRequest;
import com.math10.resources.dto.LessonResourceRequest;
import com.math10.resources.dto.LessonResourceResponse;

import java.util.List;

public interface LessonResourceService {

    List<LessonResourceResponse> findByLesson(Long lessonId);

    LessonResourceResponse create(LessonResourceRequest request);

    LessonResourceResponse update(Long id, LessonResourceRequest request);

    void softDelete(Long id);

    void reorder(ReorderRequest request);
}
