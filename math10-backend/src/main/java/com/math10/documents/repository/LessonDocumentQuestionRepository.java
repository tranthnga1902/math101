package com.math10.documents.repository;

import com.math10.documents.entity.LessonDocumentQuestion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface LessonDocumentQuestionRepository extends JpaRepository<LessonDocumentQuestion, Long> {
    List<LessonDocumentQuestion> findByLessonDocumentIdOrderByDisplayOrderAsc(Long lessonDocumentId);

    @Query("select coalesce(max(question.displayOrder), 0) from LessonDocumentQuestion question where question.lessonDocumentId = :lessonDocumentId")
    int maxDisplayOrder(@Param("lessonDocumentId") Long lessonDocumentId);
}
