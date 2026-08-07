package com.math10.enrollments.repository;

import com.math10.enrollments.entity.ClassTeacher;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ClassTeacherRepository extends JpaRepository<ClassTeacher, Long> {

    boolean existsByClassIdAndTeacherId(Long classId, Long teacherId);
    List<ClassTeacher> findByClassIdOrderByCreatedAtAsc(Long classId);
    List<ClassTeacher> findByTeacherId(Long teacherId);
    long countByClassId(Long classId);
}
