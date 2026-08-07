package com.math10.documents.repository;

import com.math10.documents.entity.DocumentPageMapping;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DocumentPageMappingRepository extends JpaRepository<DocumentPageMapping, Long> {

    List<DocumentPageMapping> findByDocumentIdOrderByPdfPageNumberAsc(Long documentId);

    Optional<DocumentPageMapping> findByDocumentIdAndPdfPageNumber(Long documentId, Integer pdfPageNumber);

    @Query("SELECT m FROM DocumentPageMapping m WHERE m.documentId = :docId AND m.pdfPageNumber <= :pdfPage ORDER BY m.pdfPageNumber DESC LIMIT 1")
    Optional<DocumentPageMapping> findLastMappingBeforePdfPage(@Param("docId") Long documentId, @Param("pdfPage") Integer pdfPage);

    @Query("SELECT COUNT(m) FROM DocumentPageMapping m WHERE m.documentId = :docId AND m.pdfPageNumber BETWEEN :from AND :to")
    long countMappingsInRange(@Param("docId") Long documentId, @Param("from") Integer from, @Param("to") Integer to);

    void deleteByDocumentId(Long documentId);
}
