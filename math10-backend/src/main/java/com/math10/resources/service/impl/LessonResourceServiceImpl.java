package com.math10.resources.service.impl;

import com.math10.common.exception.ResourceNotFoundException;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.resources.dto.LessonResourceRequest;
import com.math10.resources.dto.LessonResourceResponse;
import com.math10.resources.entity.LessonResource;
import com.math10.resources.repository.LessonResourceRepository;
import com.math10.resources.service.LessonResourceService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import com.math10.lessons.repository.LessonRepository;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.configuration.security.SecurityService;

@Service
@RequiredArgsConstructor
public class LessonResourceServiceImpl implements LessonResourceService {

    private final LessonResourceRepository resourceRepository;
    private final LessonRepository lessonRepository;
    private final ChapterRepository chapterRepository;
    private final SecurityService securityService;

    @Override
    @Transactional(readOnly = true)
    public List<LessonResourceResponse> findByLesson(Long lessonId) {
        checkLesson(lessonId);
        return resourceRepository.findByLessonIdOrderByOrderIndexAsc(lessonId).stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public LessonResourceResponse create(LessonResourceRequest request) {
        checkLesson(request.lessonId());
        LessonResource resource = new LessonResource();
        apply(request, resource);
        return toResponse(resourceRepository.save(resource));
    }

    @Override
    @Transactional
    public LessonResourceResponse update(Long id, LessonResourceRequest request) {
        LessonResource resource = findEntity(id);
        checkLesson(resource.getLessonId());
        checkLesson(request.lessonId());
        apply(request, resource);
        return toResponse(resource);
    }

    @Override
    @Transactional
    public void softDelete(Long id) {
        LessonResource resource=findEntity(id);checkLesson(resource.getLessonId());resource.markDeleted();
    }

    @Override
    @Transactional
    public void reorder(ReorderRequest request) {
        for (int i = 0; i < request.ids().size(); i++) {
            LessonResource resource=findEntity(request.ids().get(i));checkLesson(resource.getLessonId());resource.setOrderIndex(-(i + 1));
        }
        resourceRepository.flush();
        for (int i = 0; i < request.ids().size(); i++) {
            findEntity(request.ids().get(i)).setOrderIndex(i + 1);
        }
    }

    private LessonResource findEntity(Long id) {
        return resourceRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu: " + id));
    }
    private void checkLesson(Long lessonId){var lesson=lessonRepository.findById(lessonId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài học: "+lessonId));var chapter=chapterRepository.findById(lesson.getChapterId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương"));securityService.checkCourseOwnership(chapter.getCourseId());}

    private void apply(LessonResourceRequest request, LessonResource resource) {
        resource.setLessonId(request.lessonId());
        resource.setType(request.type());
        resource.setTitle(request.title());
        resource.setExternalUrl(request.externalUrl());
        resource.setFileAssetId(request.fileAssetId());
        resource.setTextContent(request.textContent());
        resource.setOrderIndex(request.orderIndex());
    }

    private LessonResourceResponse toResponse(LessonResource resource) {
        return new LessonResourceResponse(resource.getId(), resource.getLessonId(), resource.getType(), resource.getTitle(), resource.getExternalUrl(), resource.getFileAssetId(), resource.getTextContent(), resource.getOrderIndex());
    }
}
