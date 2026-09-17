package com.math10.documents.dto;

import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentType;

public record LessonDocumentResponse(
        Long id,
        Long lessonId,
        Long documentId,
        String title,
        DocumentType docType,
        DocumentAudience audience,
        String fileUrl,
        boolean required,
        String teacherNote,
        Integer startPage,
        Integer displayOrder,
        String thumbnailUrl
) {
    public LessonDocumentResponse(Long id, Long lessonId, Long documentId, String title, DocumentType docType,
                                  DocumentAudience audience, String fileUrl, boolean required,
                                  String teacherNote, Integer startPage, Integer displayOrder) {
        this(id, lessonId, documentId, title, docType, audience, fileUrl, required, teacherNote, startPage, displayOrder, null);
    }
}
