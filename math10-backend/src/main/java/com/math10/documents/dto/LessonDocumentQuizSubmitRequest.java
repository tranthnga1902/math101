package com.math10.documents.dto;

import java.util.Map;

public record LessonDocumentQuizSubmitRequest(Map<Long, String> answers) {
}
