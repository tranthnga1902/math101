package com.math10.lessons.service;

import com.math10.chapters.entity.Chapter;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.common.entity.PublishStatus;
import com.math10.common.exception.BusinessException;
import com.math10.configuration.security.SecurityService;
import com.math10.lessons.dto.LessonRequest;
import com.math10.lessons.entity.Lesson;
import com.math10.lessons.repository.LessonRepository;
import com.math10.lessons.service.impl.LessonServiceImpl;
import com.math10.programs.support.CatCanhCay;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class LessonPublicCodeTest {
    private final LessonRepository lessons = mock(LessonRepository.class);
    private final ChapterRepository chapters = mock(ChapterRepository.class);
    private final LessonServiceImpl service = new LessonServiceImpl(
            lessons, chapters, mock(SecurityService.class), mock(CatCanhCay.class));
    private Lesson lesson;

    @BeforeEach
    void setUp() {
        Chapter chapter = new Chapter();
        chapter.setCourseId(1L);
        when(chapters.findById(2L)).thenReturn(Optional.of(chapter));
        lesson = new Lesson();
        lesson.setChapterId(2L);
        lesson.setStatus(PublishStatus.DRAFT);
        when(lessons.findById(3L)).thenReturn(Optional.of(lesson));
        when(lessons.save(any(Lesson.class))).thenAnswer(call -> call.getArgument(0));
    }

    private LessonRequest request(String code) {
        return new LessonRequest(2L, "Tập hợp", code, "Tóm tắt",
                "<h2>Nội dung mới</h2>", 2, PublishStatus.DRAFT);
    }

    @Test
    void htmlUpdateWithEmptyCodeDoesNotConflictWithAnotherEmptyCode() {
        when(lessons.existsByPublicCode("")).thenReturn(true);
        var result = service.update(3L, request(""));
        assertThat(result.publicCode()).isNull();
        assertThat(result.contentHtml()).isEqualTo("<h2>Nội dung mới</h2>");
        verify(lessons, never()).existsByPublicCode(anyString());
    }

    @Test
    void blankCodesAreStoredAsNullOnCreateAndUpdate() {
        for (String code : new String[]{null, "", "  "}) {
            assertThat(service.create(request(code)).publicCode()).isNull();
            lesson.setPublicCode("");
            assertThat(service.update(3L, request(code)).publicCode()).isNull();
        }
        verify(lessons, never()).existsByPublicCode(anyString());
    }

    @Test
    void unchangedRealCodeCanBeSaved() {
        lesson.setPublicCode("BAI-2");
        assertThat(service.update(3L, request("BAI-2")).publicCode()).isEqualTo("BAI-2");
        verify(lessons, never()).existsByPublicCode(anyString());
    }

    @Test
    void duplicateRealCodesAreStillRejected() {
        when(lessons.existsByPublicCode("BAI-1")).thenReturn(true);
        assertThatThrownBy(() -> service.update(3L, request("BAI-1")))
                .isInstanceOf(BusinessException.class).hasMessage("Public code đã tồn tại");
        assertThatThrownBy(() -> service.create(request("BAI-1")))
                .isInstanceOf(BusinessException.class).hasMessage("Public code đã tồn tại");
        assertThat(lesson.getContentHtml()).isNull();
    }
}
