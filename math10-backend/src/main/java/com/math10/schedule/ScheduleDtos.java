package com.math10.schedule;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

public final class ScheduleDtos {
    private ScheduleDtos() {}

    // G7: Slot tuần
    public record SlotDto(
            Long id, int dayOfWeek, LocalTime startTime,
            int durationMin, int periods
    ) {}

    // G8: Yêu cầu tính lịch
    public record CalculateRequest(
            LocalDate startDate,
            int totalPeriods,
            List<BreakPeriod> breaks
    ) {}

    public record BreakPeriod(LocalDate from, LocalDate to, String note) {}

    // G8: Kết quả tính lịch
    public record CalculateResult(
            int weeks,
            int sessions,
            LocalDate endDate,
            int lastSessionPeriods,
            List<HolidayHit> holidayHits,
            String explanation
    ) {}

    public record HolidayHit(LocalDate date, String name, int sessionNo) {}

    // G8: Tính ngược (Reverse calculate)
    public record ReverseRequest(LocalDate startDate, LocalDate endDate, int totalPeriods) {}

    public record ReverseResult(double requiredSessionsPerWeek, String explanation) {}

    // G9: Preview từng buổi
    public record SessionPreview(
            int sessionNo, LocalDate date, LocalTime startTime,
            int periods, boolean isHoliday, String holidayName
    ) {}

    // G11: Ngày lễ
    public record HolidayDto(
            Long id, LocalDate holidayDate, String name,
            boolean isDayOff, int year, String note
    ) {}

    public record HolidayUpsert(LocalDate holidayDate, String name, boolean isDayOff, int year, String note) {}
}
