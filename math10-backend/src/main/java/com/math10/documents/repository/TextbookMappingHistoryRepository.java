package com.math10.documents.repository;

import com.math10.documents.entity.TextbookMappingHistory;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TextbookMappingHistoryRepository extends JpaRepository<TextbookMappingHistory, Long> {

    /**
     * Lấy các bản ghi lịch sử mới nhất của user cho 1 sách, sắp xếp theo thời gian tăng dần
     * (để dựng lại stack Lên/Xuống đúng thứ tự đã đi qua).
     */
    @Query("SELECT h FROM TextbookMappingHistory h WHERE h.userId = :userId AND h.documentId = :docId " +
            "ORDER BY h.createdAt ASC, h.id ASC")
    List<TextbookMappingHistory> findStackOrdered(@Param("userId") Long userId,
                                                 @Param("docId") Long documentId,
                                                 Pageable pageable);

    /**
     * Đếm số bản ghi hiện có để cắt ring buffer khi vượt ngưỡng.
     */
    long countByUserIdAndDocumentId(Long userId, Long documentId);

    /**
     * Lấy id của các bản ghi cũ nhất cần xóa khi vượt ring buffer.
     */
    @Query("SELECT h.id FROM TextbookMappingHistory h WHERE h.userId = :userId AND h.documentId = :docId " +
            "ORDER BY h.createdAt ASC, h.id ASC")
    List<Long> findOldestIds(@Param("userId") Long userId,
                             @Param("docId") Long documentId,
                             Pageable pageable);
}
