package com.math10.lessons.service.impl;
import com.math10.chapters.entity.Chapter;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.configuration.security.SecurityService;
import com.math10.lessons.dto.LessonRequest;
import com.math10.lessons.entity.Lesson;
import com.math10.lessons.repository.LessonRepository;
import com.math10.resources.repository.LessonResourceRepository;
import com.math10.resources.service.impl.LessonResourceServiceImpl;
import com.math10.common.entity.PublishStatus;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.mockito.Mockito.*;
class ContentOwnershipTest {
 @Test void lessonCreateChecksParentCourseOwnership(){
  LessonRepository lessons=mock(LessonRepository.class);ChapterRepository chapters=mock(ChapterRepository.class);SecurityService security=mock(SecurityService.class);
  Chapter chapter=new Chapter();chapter.setId(4L);chapter.setCourseId(9L);when(chapters.findById(4L)).thenReturn(Optional.of(chapter));when(lessons.save(any())).thenAnswer(x->x.getArgument(0));
  new LessonServiceImpl(lessons,chapters,security).create(new LessonRequest(4L,"Bài","CODE","","",1,PublishStatus.DRAFT));
  verify(security).checkCourseOwnership(9L);
 }
 @Test void resourceReadChecksLessonCourseOwnership(){
  LessonResourceRepository resources=mock(LessonResourceRepository.class);LessonRepository lessons=mock(LessonRepository.class);ChapterRepository chapters=mock(ChapterRepository.class);SecurityService security=mock(SecurityService.class);
  Lesson lesson=new Lesson();lesson.setId(5L);lesson.setChapterId(4L);Chapter chapter=new Chapter();chapter.setId(4L);chapter.setCourseId(9L);
  when(lessons.findById(5L)).thenReturn(Optional.of(lesson));when(chapters.findById(4L)).thenReturn(Optional.of(chapter));
  new LessonResourceServiceImpl(resources,lessons,chapters,security).findByLesson(5L);
  verify(security).checkCourseOwnership(9L);
 }
}
