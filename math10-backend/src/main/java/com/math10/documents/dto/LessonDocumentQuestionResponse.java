package com.math10.documents.dto;

public record LessonDocumentQuestionResponse(
        Long id,
        Long lessonDocumentId,
        String questionText,
        String optionA,
        String optionB,
        String optionC,
        String optionD,
        String correctOption,
        String explanation,
        Integer displayOrder
) {
}
