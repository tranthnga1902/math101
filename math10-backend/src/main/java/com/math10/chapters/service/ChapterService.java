package com.math10.chapters.service;

import com.math10.chapters.dto.ChapterRequest;
import com.math10.chapters.dto.ChapterResponse;
import com.math10.courses.dto.request.ReorderRequest;

import java.util.List;

public interface ChapterService {

    List<ChapterResponse> findByCourse(Long courseId);

    ChapterResponse create(ChapterRequest request);

    ChapterResponse update(Long id, ChapterRequest request);

    void softDelete(Long id);

    void reorder(ReorderRequest request);
}
