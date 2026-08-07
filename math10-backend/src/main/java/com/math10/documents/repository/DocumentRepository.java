package com.math10.documents.repository;

import com.math10.documents.entity.Document;
import com.math10.documents.entity.DocumentStatus;
import com.math10.documents.entity.DocumentType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findAllByOrderByCreatedAtDesc();

    List<Document> findByDocTypeInAndStatusOrderByCreatedAtDesc(List<DocumentType> types, DocumentStatus status);

    List<Document> findByDocTypeInAndStatusAndGradeIdOrderByCreatedAtDesc(
            List<DocumentType> types, DocumentStatus status, Long gradeId);

    List<Document> findByDocTypeInAndStatusAndSubjectIdOrderByCreatedAtDesc(
            List<DocumentType> types, DocumentStatus status, Long subjectId);

    List<Document> findByDocTypeInAndStatusAndGradeIdAndSubjectIdOrderByCreatedAtDesc(
            List<DocumentType> types, DocumentStatus status, Long gradeId, Long subjectId);

    List<Document> findByDocTypeInOrderByCreatedAtDesc(List<DocumentType> types);

    @Query("SELECT d FROM Document d WHERE d.docType IN :types ORDER BY d.createdAt DESC")
    List<Document> findAllTextbooks(@Param("types") List<DocumentType> types);

    List<Document> findByThumbnailUrlIsNull();
}
