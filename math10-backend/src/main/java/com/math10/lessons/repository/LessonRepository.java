package com.math10.lessons.repository;

import com.math10.lessons.entity.Lesson;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LessonRepository extends JpaRepository<Lesson, Long>, JpaSpecificationExecutor<Lesson> {

    List<Lesson> findByChapterIdOrderByOrderIndexAsc(Long chapterId);

    Optional<Lesson> findByPublicCode(String publicCode);

    boolean existsByPublicCode(String publicCode);
    @Query(value = """
      select exists(select 1 from lessons l join chapters ch on ch.id=l.chapter_id and ch.deleted_at is null
      join class_courses cc on cc.course_id=ch.course_id and cc.deleted_at is null
      join class_students cs on cs.class_id=cc.class_id and cs.deleted_at is null
      where l.id=:lessonId and l.deleted_at is null and cs.student_id=:studentId)
      """,nativeQuery=true)
    boolean studentCanAccess(@Param("lessonId") Long lessonId,@Param("studentId") Long studentId);
}
