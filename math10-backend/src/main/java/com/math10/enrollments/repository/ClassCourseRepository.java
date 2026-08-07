package com.math10.enrollments.repository;

import com.math10.enrollments.entity.ClassCourse;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ClassCourseRepository extends JpaRepository<ClassCourse, Long> {

    boolean existsByClassIdAndCourseId(Long classId, Long courseId);
    List<ClassCourse> findByClassIdOrderByCreatedAtAsc(Long classId);
    long countByClassId(Long classId);
}
