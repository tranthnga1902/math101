package com.math10.chapters.service.impl;

import com.math10.chapters.dto.ChapterRequest;
import com.math10.chapters.dto.ChapterResponse;
import com.math10.chapters.entity.Chapter;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.chapters.service.ChapterService;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.SecurityService;
import com.math10.courses.dto.request.ReorderRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ChapterServiceImpl implements ChapterService {

    private final ChapterRepository chapterRepository;
    private final SecurityService securityService;

    @Override
    @Transactional(readOnly = true)
    public List<ChapterResponse> findByCourse(Long courseId) {
        securityService.checkCourseOwnership(courseId);
        return chapterRepository.findByCourseIdOrderByOrderIndexAsc(courseId).stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public ChapterResponse create(ChapterRequest request) {
        securityService.checkCourseOwnership(request.courseId());
        Chapter chapter = new Chapter();
        apply(request, chapter);
        return toResponse(chapterRepository.save(chapter));
    }

    @Override
    @Transactional
    public ChapterResponse update(Long id, ChapterRequest request) {
        Chapter chapter = findEntity(id);
        securityService.checkCourseOwnership(chapter.getCourseId());
        apply(request, chapter);
        return toResponse(chapter);
    }

    @Override
    @Transactional
    public void softDelete(Long id) {
        Chapter chapter = findEntity(id);
        securityService.checkCourseOwnership(chapter.getCourseId());
        chapter.markDeleted();
    }

    @Override
    @Transactional
    public void reorder(ReorderRequest request) {
        for (int i = 0; i < request.ids().size(); i++) {
            findEntity(request.ids().get(i)).setOrderIndex(-(i + 1));
        }
        chapterRepository.flush();
        for (int i = 0; i < request.ids().size(); i++) {
            Chapter chapter = findEntity(request.ids().get(i));
            securityService.checkCourseOwnership(chapter.getCourseId());
            chapter.setOrderIndex(i + 1);
        }
    }

    private Chapter findEntity(Long id) {
        return chapterRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương: " + id));
    }

    private void apply(ChapterRequest request, Chapter chapter) {
        chapter.setCourseId(request.courseId());
        chapter.setTitle(request.title());
        chapter.setOrderIndex(request.orderIndex());
        chapter.setStatus(request.status());
    }

    private ChapterResponse toResponse(Chapter chapter) {
        return new ChapterResponse(chapter.getId(), chapter.getCourseId(), chapter.getTitle(), chapter.getOrderIndex(), chapter.getStatus());
    }
}
