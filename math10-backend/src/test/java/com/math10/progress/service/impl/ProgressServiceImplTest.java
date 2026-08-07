package com.math10.progress.service.impl;

import com.math10.progress.dto.ProgressRequest;
import com.math10.progress.entity.LearningProgress;
import com.math10.progress.repository.LearningProgressRepository;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.lessons.repository.LessonRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProgressServiceImplTest {

    @Mock
    private LearningProgressRepository repository;
    @Mock private CurrentUserService currentUserService;
    @Mock private ClassStudentRepository classStudentRepository;
    @Mock private LessonRepository lessonRepository;

    @InjectMocks
    private ProgressServiceImpl service;

    @Test
    void marksNewLessonOpenedAtTenPercent() {
        when(repository.findByStudentIdAndLessonId(7L, 9L)).thenReturn(Optional.empty());
        when(repository.save(any(LearningProgress.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.markOpened(new ProgressRequest(7L, 9L));

        assertThat(result.studentId()).isEqualTo(7L);
        assertThat(result.lessonId()).isEqualTo(9L);
        assertThat(result.openedAt()).isNotNull();
        assertThat(result.completionPercent()).isEqualTo(10);
    }

    @Test
    void marksExistingLessonCompleted() {
        LearningProgress progress = new LearningProgress();
        progress.setStudentId(7L);
        progress.setLessonId(9L);
        progress.setOpenedAt(LocalDateTime.now().minusMinutes(2));
        progress.setCompletionPercent(40);
        when(repository.findByStudentIdAndLessonId(7L, 9L)).thenReturn(Optional.of(progress));
        when(repository.save(progress)).thenReturn(progress);

        var result = service.markCompleted(new ProgressRequest(7L, 9L));

        assertThat(result.openedAt()).isNotNull();
        assertThat(result.completedAt()).isNotNull();
        assertThat(result.completionPercent()).isEqualTo(100);
    }
}
