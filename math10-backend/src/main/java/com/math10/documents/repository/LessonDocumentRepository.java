package com.math10.documents.repository;

import com.math10.documents.entity.LessonDocument;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LessonDocumentRepository extends JpaRepository<LessonDocument, Long> {
    boolean existsByLessonIdAndDocumentId(Long lessonId, Long documentId);
    List<LessonDocument> findByDocumentId(Long documentId);
    List<LessonDocument> findByLessonIdOrderByDisplayOrderAsc(Long lessonId);
    Optional<LessonDocument> findByIdAndLessonId(Long id, Long lessonId);
    Optional<LessonDocument> findFirstByLessonIdAndDisplayOrderLessThanOrderByDisplayOrderDesc(Long lessonId, Integer displayOrder);
    Optional<LessonDocument> findFirstByLessonIdAndDisplayOrderGreaterThanOrderByDisplayOrderAsc(Long lessonId, Integer displayOrder);

    @Query(value = "select coalesce(max(display_order), 0) from lesson_documents where lesson_id = :lessonId", nativeQuery = true)
    int maxDisplayOrder(@Param("lessonId") Long lessonId);
}
