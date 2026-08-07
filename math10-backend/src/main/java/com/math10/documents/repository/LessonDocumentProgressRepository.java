package com.math10.documents.repository;

import com.math10.documents.entity.LessonDocumentProgress;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LessonDocumentProgressRepository extends JpaRepository<LessonDocumentProgress, Long> {
    Optional<LessonDocumentProgress> findByLessonDocumentIdAndStudentId(Long lessonDocumentId, Long studentId);
    List<LessonDocumentProgress> findByLessonDocumentIdInAndStudentId(List<Long> lessonDocumentIds, Long studentId);
}
