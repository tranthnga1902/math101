package com.math10.enrollments.repository;

import com.math10.enrollments.entity.ClassCourse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ClassCourseRepository extends JpaRepository<ClassCourse, Long> {

    boolean existsByClassIdAndCourseInstanceId(Long classId, Long courseInstanceId);
    List<ClassCourse> findByClassIdOrderByCreatedAtAsc(Long classId);
    long countByClassId(Long classId);

    /**
     * Lớp có đang học chương trình này qua khóa nào không. Bài giao gắn vào bài học, mà bài học
     * chỉ biết chương trình của nó — còn lớp thì gắn vào khóa. Hai đầu gặp nhau ở mẫu chương trình.
     */
    @Query(value = """
            select exists(
              select 1 from class_courses cc
              join course_instances ci on ci.id=cc.course_instance_id and ci.deleted_at is null
              join program_templates pt on pt.id=ci.template_id and pt.deleted_at is null
              where cc.class_id=:classId and cc.deleted_at is null and pt.program_id=:programId
            )
            """, nativeQuery = true)
    boolean classHasProgram(@Param("classId") Long classId, @Param("programId") Long programId);
}
