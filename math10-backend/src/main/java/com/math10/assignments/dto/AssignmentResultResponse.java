package com.math10.assignments.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

public record AssignmentResultResponse(Long assignmentId, Long studentId, String gradingStatus,
        Integer completionPercent, LocalDateTime submittedAt, LocalDateTime gradedAt, LocalDateTime returnedAt,
        BigDecimal score, BigDecimal maxScore, Integer correctCount, Integer totalQuestions,
        String teacherFeedback, Map<Long,String> answers) {}
