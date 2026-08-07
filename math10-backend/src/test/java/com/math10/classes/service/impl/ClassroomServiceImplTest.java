package com.math10.classes.service.impl;

import com.math10.audit.service.AuditService;
import com.math10.classes.dto.ClassroomRequest;
import com.math10.classes.entity.ClassStatus;
import com.math10.classes.entity.Classroom;
import com.math10.classes.repository.ClassroomRepository;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.entity.ClassTeacher;
import com.math10.enrollments.repository.ClassTeacherRepository;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.enrollments.repository.ClassCourseRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class ClassroomServiceImplTest {
    @Test
    void teacherCreatingClassIsAssignedAsOwnerAndAudited() {
        ClassroomRepository classrooms = mock(ClassroomRepository.class);
        ClassTeacherRepository teachers = mock(ClassTeacherRepository.class);
        CurrentUserService current = mock(CurrentUserService.class);
        AuditService audit = mock(AuditService.class);
        when(current.requireRoleCode()).thenReturn("TEACHER");
        when(current.requireUserId()).thenReturn(7L);
        when(classrooms.save(any())).thenAnswer(call -> {
            Classroom classroom = call.getArgument(0);
            classroom.setId(11L);
            return classroom;
        });

        var result = new ClassroomServiceImpl(classrooms, teachers, mock(ClassStudentRepository.class), mock(ClassCourseRepository.class), current, audit)
                .create(new ClassroomRequest("M10-A", "Lớp 10A", 2L, ClassStatus.ACTIVE));

        assertThat(result.id()).isEqualTo(11L);
        verify(teachers).save(argThat((ClassTeacher row) -> row.getClassId().equals(11L) && row.getTeacherId().equals(7L)));
        verify(audit).record(eq("CREATE"), eq("CLASS"), eq(11L), isNull(), anyString());
    }
}
