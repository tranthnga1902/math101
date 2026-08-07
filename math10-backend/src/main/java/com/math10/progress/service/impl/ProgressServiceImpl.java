package com.math10.progress.service.impl;

import com.math10.progress.dto.ProgressRequest;
import com.math10.progress.dto.ProgressResponse;
import com.math10.progress.entity.LearningProgress;
import com.math10.progress.repository.LearningProgressRepository;
import com.math10.progress.service.ProgressService;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import org.springframework.security.access.AccessDeniedException;
import com.math10.lessons.repository.LessonRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.math10.common.exception.BusinessException;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ProgressServiceImpl implements ProgressService {

    private final LearningProgressRepository progressRepository;
    private final CurrentUserService currentUserService;
    private final ClassStudentRepository classStudentRepository;
    private final LessonRepository lessonRepository;

    @Override
    @Transactional
    public ProgressResponse markOpened(ProgressRequest request) {
        LearningProgress progress = findOrCreate(request);
        if (progress.getOpenedAt() == null) {
            progress.setOpenedAt(LocalDateTime.now());
        }
        progress.setCompletionPercent(Math.max(progress.getCompletionPercent(), 10));
        progress.setStatus("IN_PROGRESS");
        return toResponse(progressRepository.save(progress));
    }

    @Override
    @Transactional
    public ProgressResponse markCompleted(ProgressRequest request) {
        LearningProgress progress = findOrCreate(request);
        LocalDateTime now = LocalDateTime.now();
        if (progress.getOpenedAt() == null) {
            progress.setOpenedAt(now);
            progressRepository.save(progress);
            throw new BusinessException("Can hoc bai toi thieu 1 phut truoc khi hoan thanh");
        }
        if (Duration.between(progress.getOpenedAt(), now).toSeconds() < 60) {
            throw new BusinessException("Can hoc bai toi thieu 1 phut truoc khi hoan thanh");
        }
        progress.setCompletedAt(now);
        progress.setCompletionPercent(100);
        progress.setStatus("COMPLETED");
        return toResponse(progressRepository.save(progress));
    }

    @Override
    @Transactional(readOnly = true)
    public List<ProgressResponse> findByStudent(Long studentId) {
        if ("TEACHER".equals(currentUserService.requireRoleCode())
                && !classStudentRepository.existsStudentTaughtByTeacher(studentId, currentUserService.requireUserId())) {
            throw new AccessDeniedException("Học sinh không thuộc lớp giáo viên phụ trách");
        }
        return progressRepository.findAll((root, query, cb) -> cb.equal(root.get("studentId"), studentId), PageRequest.of(0, 200))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private LearningProgress findOrCreate(ProgressRequest request) {
        if ("STUDENT".equals(currentUserService.requireRoleCode())
                && !lessonRepository.studentCanAccess(request.lessonId(), request.studentId())) {
            throw new AccessDeniedException("Bài học chưa được gán cho lớp của bạn");
        }
        return progressRepository.findByStudentIdAndLessonId(request.studentId(), request.lessonId())
                .orElseGet(() -> {
                    LearningProgress progress = new LearningProgress();
                    progress.setStudentId(request.studentId());
                    progress.setLessonId(request.lessonId());
                    return progress;
                });
    }

    private ProgressResponse toResponse(LearningProgress progress) {
        return new ProgressResponse(progress.getId(), progress.getStudentId(), progress.getLessonId(), progress.getWorksheetId(), progress.getStatus(), progress.getOpenedAt(), progress.getCompletedAt(), progress.getCompletionPercent());
    }
}
