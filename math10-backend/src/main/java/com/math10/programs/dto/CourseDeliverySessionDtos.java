package com.math10.programs.dto;

import java.util.List;

/** DTOs cho course_delivery_sessions API. */
public class CourseDeliverySessionDtos {

    private CourseDeliverySessionDtos() {}

    /**
     * Một buổi học — không có ngày.
     *
     * @param id null khi đây là kết quả preview (chưa ghi DB nên chưa có id thật)
     * @param strandName tên mạch (Đại số / Hình học / Chuyên đề...) của buổi — lấy từ tiết đầu
     *                    tiên, vì một buổi chỉ thuộc đúng một mạch
     */
    public record SessionRow(
            Long id,
            long courseInstanceId,
            int seq,
            String sessionType,
            String title,
            String note,
            String source,
            boolean continuation,
            String strandName,
            List<UnitRow> units
    ) {}

    /**
     * Một tiết trong buổi.
     *
     * @param id null khi đây là kết quả preview (chưa ghi DB nên chưa có id thật)
     */
    public record UnitRow(
            Long id,
            long programPeriodId,
            int orderInSession,
            int periodNo,
            int weekNo,
            String title,
            String periodKind,
            Long lessonId,
            String strandName
    ) {}

    /** Kết quả preview / generate. */
    public record GenerateResult(
            int totalSessions,
            boolean dryRun,
            List<String> warnings,
            List<SessionRow> sessions
    ) {}
}
