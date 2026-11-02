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

    /**
     * {@code current} là "hôm nay đang học chương này", nên trong kỳ nghỉ nó phải là false: không
     * ai đang học. {@code onBreak} nói vì sao false, để màn hình không nhầm ngày nghỉ với khóa
     * chưa xếp lịch — hai chuyện đó nhìn giống hệt nhau nếu chỉ có mỗi một cờ.
     */
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
            boolean current,
            boolean onBreak,
            String breakReason,
            LocalDate breakEndsOn
    ) {
        /** Ngày nghỉ mà lịch không xếp chương nào: vẫn phải trả lời được, chứ không trả về rỗng. */
        public static Response onBreak(String reason, LocalDate breakEndsOn) {
            return new Response(null, null, null, null, null, null, null, null, null, null,
                    false, true, reason, breakEndsOn);
        }
    }
}
