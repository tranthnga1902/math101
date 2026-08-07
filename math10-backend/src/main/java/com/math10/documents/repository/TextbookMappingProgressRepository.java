package com.math10.documents.repository;

import com.math10.documents.entity.TextbookMappingProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface TextbookMappingProgressRepository extends JpaRepository<TextbookMappingProgress, Long> {

    Optional<TextbookMappingProgress> findByUserIdAndDocumentId(Long userId, Long documentId);
}
