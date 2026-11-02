package com.math10.lessons.service.impl;
import com.math10.chapters.entity.Chapter;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.configuration.security.SecurityService;
import com.math10.lessons.dto.LessonRequest;
import com.math10.lessons.repository.LessonRepository;
import com.math10.programs.support.CatCanhCay;
import com.math10.common.entity.PublishStatus;
import org.junit.jupiter.api.Test;
import java.util.Optional;
import static org.mockito.Mockito.*;

/**
 * Ca thứ hai ở đây — {@code resourceReadChecksLessonCourseOwnership} — đã đi cùng module
 * {@code com.math10.resources}: nó dựng thẳng {@code LessonResourceServiceImpl}, mà lớp ấy không
 * còn. Luồng nội dung mới ({@code program_resources}) hỏi quyền đọc bằng một hàm khác, nên chỗ
 * kiểm tra chủ sở hữu khóa học ở tầng bài học đang trống — đó là việc của lát "quyền sở hữu",
 * không phải của lát này. Ghi ra đây để lần sau không ai tưởng nó vẫn còn được canh.
 */
class ContentOwnershipTest {
 @Test void lessonCreateChecksParentCourseOwnership(){
  LessonRepository lessons=mock(LessonRepository.class);ChapterRepository chapters=mock(ChapterRepository.class);SecurityService security=mock(SecurityService.class);
  Chapter chapter=new Chapter();chapter.setId(4L);chapter.setCourseId(9L);when(chapters.findById(4L)).thenReturn(Optional.of(chapter));when(lessons.save(any())).thenAnswer(x->x.getArgument(0));
  new LessonServiceImpl(lessons,chapters,security,mock(CatCanhCay.class)).create(new LessonRequest(4L,"Bài","CODE","","",1,PublishStatus.DRAFT));
  verify(security).checkCourseOwnership(9L);
 }
}
