package com.math10.documents.repository;

import com.math10.documents.entity.DocumentFolder;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DocumentFolderRepository extends JpaRepository<DocumentFolder,Long> {
    List<DocumentFolder> findByOwnerIdOrderByNameAsc(Long ownerId);
    boolean existsByOwnerIdAndNameIgnoreCaseAndIdNot(Long ownerId,String name,Long id);

    /** Thư mục của thư viện dùng chung. */
    List<DocumentFolder> findByOwnerIdIsNullOrderByNameAsc();
    List<DocumentFolder> findByOwnerIdIsNullAndParentId(Long parentId);
}
