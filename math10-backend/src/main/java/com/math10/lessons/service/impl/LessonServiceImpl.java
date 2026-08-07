package com.math10.lessons.service.impl;

import com.math10.common.entity.PublishStatus;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.lessons.dto.LessonRequest;
import com.math10.lessons.dto.LessonResponse;
import com.math10.lessons.entity.Lesson;
import com.math10.lessons.repository.LessonRepository;
import com.math10.lessons.service.LessonService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.configuration.security.SecurityService;

@Service
@RequiredArgsConstructor
public class LessonServiceImpl implements LessonService {

    private final LessonRepository lessonRepository;
    private final ChapterRepository chapterRepository;
    private final SecurityService securityService;

    @Override
    @Transactional(readOnly = true)
    public List<LessonResponse> findByChapter(Long chapterId) {
        checkChapter(chapterId);
        return lessonRepository.findByChapterIdOrderByOrderIndexAsc(chapterId).stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LessonResponse findPublishedByPublicCode(String publicCode) {
        Lesson lesson = lessonRepository.findByPublicCode(publicCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài public: " + publicCode));
        if (lesson.getStatus() != PublishStatus.PUBLISHED) {
            throw new ResourceNotFoundException("Bài chưa được xuất bản");
        }
        return toResponse(lesson);
    }

    @Override
    @Transactional
    public LessonResponse create(LessonRequest request) {
        checkChapter(request.chapterId());
        ensurePublicCodeAvailable(request.publicCode());
        Lesson lesson = new Lesson();
        apply(request, lesson);
        return toResponse(lessonRepository.save(lesson));
    }

    @Override
    @Transactional
    public LessonResponse update(Long id, LessonRequest request) {
        Lesson lesson = findEntity(id);
        checkChapter(lesson.getChapterId());
        checkChapter(request.chapterId());
        if (request.publicCode() != null && !request.publicCode().equals(lesson.getPublicCode())) {
            ensurePublicCodeAvailable(request.publicCode());
        }
        apply(request, lesson);
        return toResponse(lesson);
    }

    @Override
    @Transactional
    public void softDelete(Long id) {
        Lesson lesson=findEntity(id);checkChapter(lesson.getChapterId());lesson.markDeleted();
    }

    @Override
    @Transactional
    public void reorder(ReorderRequest request) {
        for (int i = 0; i < request.ids().size(); i++) {
            Lesson lesson=findEntity(request.ids().get(i));checkChapter(lesson.getChapterId());lesson.setOrderIndex(-(i + 1));
        }
        lessonRepository.flush();
        for (int i = 0; i < request.ids().size(); i++) {
            findEntity(request.ids().get(i)).setOrderIndex(i + 1);
        }
    }

    private Lesson findEntity(Long id) {
        return lessonRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học: " + id));
    }
    private void checkChapter(Long chapterId){var chapter=chapterRepository.findById(chapterId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương: "+chapterId));securityService.checkCourseOwnership(chapter.getCourseId());}

    private void ensurePublicCodeAvailable(String publicCode) {
        if (publicCode != null && lessonRepository.existsByPublicCode(publicCode)) {
            throw new BusinessException("Public code đã tồn tại");
        }
    }

    private void apply(LessonRequest request, Lesson lesson) {
        lesson.setChapterId(request.chapterId());
        lesson.setTitle(request.title());
        lesson.setPublicCode(request.publicCode());
        lesson.setSummary(request.summary());
        lesson.setContentHtml(request.contentHtml());
        lesson.setOrderIndex(request.orderIndex());
        lesson.setStatus(request.status());
    }

    private LessonResponse toResponse(Lesson lesson) {
        return new LessonResponse(lesson.getId(), lesson.getChapterId(), lesson.getTitle(), lesson.getPublicCode(), lesson.getSummary(), lesson.getContentHtml(), lesson.getOrderIndex(), lesson.getStatus());
    }
}
