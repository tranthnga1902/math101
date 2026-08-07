package com.math10.documents.dto;

import jakarta.validation.constraints.Pattern;

public record MoveLessonDocumentRequest(
        @Pattern(regexp = "UP|DOWN", message = "Hướng di chuyển phải là UP hoặc DOWN")
        String direction
) {
}
