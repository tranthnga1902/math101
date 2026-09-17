package com.math10.programs.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * DTOs cho CourseScheduleController (lịch tiết, lịch tuần, ngày nghỉ).
 */
public class CourseScheduleDtos {

    // --- Lịch học trong tuần ---

    public record WeeklySlotInput(
            String dayOfWeek,    // MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY
            int periodCount
    ) {}

    public record WeeklySlotResponse(
            Long id,
            String dayOfWeek,
            int periodCount,
            int orderIndex
    ) {}

    // --- Ngày nghỉ ---

    public record HolidayInput(
            LocalDate startsOn,
            LocalDate endsOn,
            String name,
            String type,
            String description
    ) {}

    public record HolidayResponse(
            Long id,
            LocalDate startsOn,
            LocalDate endsOn,
            String type,
            String name,
            String description
    ) {}

    // --- Sinh lịch tiết ---

    public record GenerateRequest(
            boolean keepManual,     // giữ lại session chỉnh tay, mặc định true
            Long teachingPlanId     // override teaching_plan_id nếu muốn thay kế hoạch
    ) {}

    public record GeneratePreview(
            int totalSessions,
            LocalDate projectedEndDate,
            int totalRequired,
            int totalAvailable,
            boolean feasible,
            String warning,
            int manualSessionsPreserved,
            List<SessionRow> sessions   // null ở preview nếu quá nhiều; có ở generate
    ) {}

    public record SessionRow(
            Long id,
            long programPeriodId,
            String periodTitle,
            String strandName,
            int instructionalWeekNumber,
            LocalDate plannedDate,
            int plannedOrderOnDate,
            String status,
            boolean editedManually
    ) {}

    // --- Tiến độ lớp ---

    public record ClassProgressResponse(
            long classId,
            String className,
            long courseInstanceId,
            int completedPeriodCount,
            int plannedPeriodCount,     // số tiết theo kế hoạch tới hôm nay
            int lech,                   // |thucTe - keHoach|
            String trangThai,           // ON_TRACK / BEHIND / AHEAD
            Long lastCompletedSessionId,
            LocalDate lastCompletedDate
    ) {}
}
