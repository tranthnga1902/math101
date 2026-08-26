package com.math10.classes.repository;

import com.math10.classes.entity.ClassDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassDocumentRepository extends JpaRepository<ClassDocument, Long> {

    List<ClassDocument> findByClassIdOrderByIdDesc(Long classId);

    Optional<ClassDocument> findByIdAndClassId(Long id, Long classId);

    Optional<ClassDocument> findByClassIdAndDocumentId(Long classId, Long documentId);

    boolean existsByClassIdAndDocumentId(Long classId, Long documentId);

    /** Học sinh chỉ đọc được tài liệu nếu nó đang được gắn vào một lớp em đó học. */
    boolean existsByDocumentIdAndClassIdIn(Long documentId, List<Long> classIds);

    long countByClassId(Long classId);
}
