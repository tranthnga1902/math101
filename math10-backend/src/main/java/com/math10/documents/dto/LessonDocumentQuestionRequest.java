package com.math10.documents.dto;

import jakarta.validation.constraints.NotBlank;

public record LessonDocumentQuestionRequest(
        @NotBlank String questionText,
        @NotBlank String optionA,
        @NotBlank String optionB,
        @NotBlank String optionC,
        @NotBlank String optionD,
        @NotBlank String correctOption,
        String explanation
) {
}
