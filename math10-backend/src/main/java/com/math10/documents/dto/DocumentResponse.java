package com.math10.documents.dto;

import com.math10.common.entity.ContentGroup;
import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentStatus;
import com.math10.documents.entity.DocumentType;

import java.time.LocalDateTime;

public record DocumentResponse(
        Long id,
        String title,
        DocumentType docType,
        DocumentAudience audience,
        String fileUrl,
        Long gradeId,
        Long chapterId,
        DocumentStatus status,
        Long subjectId,
        Integer totalPages,
        Integer basePageOffset,
        LocalDateTime createdAt,
        String thumbnailUrl,
        Long folderId,
        String contentMarkdown,
        Long taxonomyNodeId,
        /** Để trống khi chưa ai phân loại — màn hình hiện "Chưa phân loại", không tự suy ra nhóm nào. */
        ContentGroup contentGroup
) {
}
