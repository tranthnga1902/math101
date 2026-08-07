package com.math10.enrollments.repository;

import com.math10.enrollments.entity.ClassStudent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;

public interface ClassStudentRepository extends JpaRepository<ClassStudent, Long> {

    boolean existsByClassIdAndStudentId(Long classId, Long studentId);
    List<ClassStudent> findByClassIdOrderByCreatedAtAsc(Long classId);
    List<ClassStudent> findByStudentId(Long studentId);
    long countByClassId(Long classId);

    @Query("""
            select case when count(cs) > 0 then true else false end
            from ClassStudent cs
            where cs.studentId = :studentId
              and exists (
                select ct.id from ClassTeacher ct
                where ct.classId = cs.classId and ct.teacherId = :teacherId
              )
            """)
    boolean existsStudentTaughtByTeacher(@Param("studentId") Long studentId, @Param("teacherId") Long teacherId);
}
