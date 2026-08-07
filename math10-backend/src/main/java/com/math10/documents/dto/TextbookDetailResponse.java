package com.math10.documents.dto;

import java.util.List;
import java.util.Map;

public record TextbookDetailResponse(
        Long id,
        String title,
        String docType,
        String audience,
        Long gradeId,
        Long subjectId,
        String status,
        Integer totalPages,
        Integer basePageOffset,
        String fileUrl,
        List<PageMappingEntry> pageMappings
) {
    public record PageMappingEntry(
            Integer pdfPage,
            String bookPageLabel,
            String pageType,
            String chapterTitle,
            String lessonTitle
    ) {
    }
}
