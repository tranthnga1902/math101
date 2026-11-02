package com.math10.documents.repository;

import com.math10.documents.entity.Document;
import com.math10.documents.entity.DocumentAudience;
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

    List<Document> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);
    List<Document> findByOwnerIdIsNullOrderByCreatedAtDesc();
    List<Document> findByFolderId(Long folderId);

    @Query("select d from Document d where d.status <> com.math10.documents.entity.DocumentStatus.HIDDEN " +
            "and (d.ownerId is null or d.ownerId = :ownerId) order by d.createdAt desc")
    List<Document> findLibraryForTeacher(@Param("ownerId") Long ownerId);

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

    @Query("select d from Document d where d.audience = com.math10.documents.entity.DocumentAudience.STUDENT_ALLOWED " +
            "and d.docType not in :excludedTypes and d.status <> com.math10.documents.entity.DocumentStatus.HIDDEN " +
            "order by d.createdAt desc")
    List<Document> findStudentVisibleDocuments(@Param("excludedTypes") List<DocumentType> excludedTypes);

    List<Document> findByDocTypeAndAudienceAndStatusNotOrderByCreatedAtDesc(
            DocumentType docType, DocumentAudience audience, DocumentStatus excludedStatus);

    List<Document> findByTaxonomyNodeIdOrderByCreatedAtDesc(Long taxonomyNodeId);

    long countByTaxonomyNodeId(Long taxonomyNodeId);

    /** Đếm tài liệu theo từng mục trong một truy vấn — tránh N+1 khi dựng cả cây phân loại. */
    @Query("select d.taxonomyNodeId, count(d) from Document d where d.taxonomyNodeId is not null group by d.taxonomyNodeId")
    List<Object[]> countGroupedByTaxonomyNode();

    /** Số tài liệu nằm trực tiếp trong từng thư mục của thư viện dùng chung, một truy vấn cho cả cây. */
    @Query("select d.folderId, count(d) from Document d where d.ownerId is null and d.folderId is not null group by d.folderId")
    List<Object[]> countSharedGroupedByFolder();

    List<Document> findByOwnerIdIsNullAndFolderIdIn(java.util.Collection<Long> folderIds);
}
