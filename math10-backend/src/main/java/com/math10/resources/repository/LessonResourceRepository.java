package com.math10.resources.repository;

import com.math10.resources.entity.LessonResource;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LessonResourceRepository extends JpaRepository<LessonResource, Long>, JpaSpecificationExecutor<LessonResource> {

    List<LessonResource> findByLessonIdOrderByOrderIndexAsc(Long lessonId);

    @Query(value = """
            select exists(
              select 1 from lesson_resources r
              join lessons l on l.id=r.lesson_id and l.deleted_at is null
              join chapters ch on ch.id=l.chapter_id and ch.deleted_at is null
              join class_courses cc on cc.course_id=ch.course_id and cc.deleted_at is null
              join class_students cs on cs.class_id=cc.class_id and cs.deleted_at is null
              where r.file_asset_id=:fileId and r.deleted_at is null and cs.student_id=:studentId
            )
            """, nativeQuery = true)
    boolean studentCanAccessFile(@Param("fileId") Long fileId, @Param("studentId") Long studentId);
}
