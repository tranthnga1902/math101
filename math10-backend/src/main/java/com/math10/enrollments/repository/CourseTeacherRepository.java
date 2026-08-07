package com.math10.enrollments.repository;

import com.math10.enrollments.entity.CourseTeacher;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface CourseTeacherRepository extends JpaRepository<CourseTeacher, Long> {

    boolean existsByCourseIdAndTeacherId(Long courseId, Long teacherId);
    List<CourseTeacher> findByTeacherId(Long teacherId);
}
