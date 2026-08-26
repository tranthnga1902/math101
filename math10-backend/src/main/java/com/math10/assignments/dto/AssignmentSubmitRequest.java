package com.math10.assignments.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.Map;

public record AssignmentSubmitRequest(@NotEmpty Map<Long, String> answers) {}
