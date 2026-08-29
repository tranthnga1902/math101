package com.math10.programs.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public final class ProgramScheduleDtos {
    private ProgramScheduleDtos() {}

    public record Request(
            @NotNull Long courseId,
            @NotNull Long chapterId,
            @NotNull LocalDate startsOn,
            @NotNull LocalDate endsOn,
            String status
    ) {}

    public record Response(
            Long id,
            Long courseId,
            String courseCode,
            String courseName,
            Long chapterId,
            String chapterTitle,
            Integer chapterOrder,
            LocalDate startsOn,
            LocalDate endsOn,
            String status,
            boolean current
    ) {}
}
