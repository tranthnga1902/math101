package com.math10.schedule;

import com.math10.common.exception.BusinessException;
import com.math10.schedule.ScheduleDtos.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ScheduleCalculatorService {

    private final JdbcTemplate jdbc;

    /**
     * Tính toán tiến độ lịch học (G8).
     */
    public CalculateResult calculate(long classId, CalculateRequest req) {
        List<SlotDto> slots = loadSlots(classId);
        if (slots.isEmpty()) {
            throw new BusinessException("Lớp chưa được cấu hình mẫu lịch tuần (slots). Vui lòng thêm ít nhất 1 slot học");
        }

        // Đọc danh sách ngày lễ
        List<HolidayDto> holidays = loadHolidays(req.startDate().getYear(), req.startDate().getYear() + 2);

        return compute(slots, req.startDate(), req.totalPeriods(), req.breaks(), holidays);
    }

    /**
     * Logic tính toán thuần (Pure Calculation), tách rời để dễ unit test mà không cần DB.
     */
    public static CalculateResult compute(
            List<SlotDto> slots,
            LocalDate startDate,
            int totalPeriods,
            List<BreakPeriod> breaks,
            List<HolidayDto> holidays
    ) {
        if (slots.isEmpty()) throw new BusinessException("Danh sách slot rỗng");
        if (totalPeriods <= 0) throw new BusinessException("Tổng số tiết phải lớn hơn 0");

        // Sắp xếp slot theo thứ trong tuần và giờ bắt đầu
        List<SlotDto> sortedSlots = slots.stream()
                .sorted(Comparator.comparingInt(SlotDto::dayOfWeek).thenComparing(SlotDto::startTime))
                .toList();

        int periodsPerWeek = sortedSlots.stream().mapToInt(SlotDto::periods).sum();
        if (periodsPerWeek <= 0) throw new BusinessException("Tổng số tiết mỗi tuần phải lớn hơn 0");

        int weeks = (int) Math.ceil((double) totalPeriods / periodsPerWeek);
        int lastSessionPeriods = totalPeriods % periodsPerWeek;

        // Neo về Thứ Hai của tuần bắt đầu
        LocalDate monday = startDate.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        List<BreakPeriod> safeBreaks = breaks == null ? List.of() : breaks;

        List<HolidayHit> holidayHits = new ArrayList<>();
        Map<LocalDate, String> holidayMap = new HashMap<>();
        if (holidays != null) {
            for (HolidayDto h : holidays) {
                if (h.isDayOff()) holidayMap.put(h.holidayDate(), h.name());
            }
        }

        int completedPeriods = 0;
        int sessionCount = 0;
        LocalDate currentMonday = monday;
        LocalDate lastSessionDate = startDate;

        while (completedPeriods < totalPeriods) {
            // Kiểm tra xem cả tuần có rơi vào kỳ nghỉ không
            LocalDate endOfWeek = currentMonday.plusDays(6);
            if (isFullWeekBreak(currentMonday, endOfWeek, safeBreaks)) {
                currentMonday = currentMonday.plusWeeks(1);
                continue;
            }

            for (SlotDto slot : sortedSlots) {
                if (completedPeriods >= totalPeriods) break;

                LocalDate sessionDate = currentMonday.plusDays(slot.dayOfWeek() - 1);
                // Nếu buổi học trước ngày bắt đầu thực tế thì bỏ qua
                if (sessionDate.isBefore(startDate)) continue;

                // Nếu buổi học rơi vào kỳ nghỉ thì bỏ qua (dồn buổi xuống)
                if (isDateInBreak(sessionDate, safeBreaks)) continue;

                sessionCount++;
                int sessionPeriods = Math.min(slot.periods(), totalPeriods - completedPeriods);
                completedPeriods += sessionPeriods;
                lastSessionDate = sessionDate;

                // Kiểm tra trùng ngày lễ
                if (holidayMap.containsKey(sessionDate)) {
                    holidayHits.add(new HolidayHit(sessionDate, holidayMap.get(sessionDate), sessionCount));
                }
            }
            currentMonday = currentMonday.plusWeeks(1);
        }

        String note = startDate.getDayOfWeek() != DayOfWeek.MONDAY
                ? "Khóa học bắt đầu vào " + startDate.getDayOfWeek() + "; tuần đầu neo từ thứ Hai " + monday
                : "Khóa học bắt đầu đúng đầu tuần";

        return new CalculateResult(weeks, sessionCount, lastSessionDate, lastSessionPeriods, holidayHits, note);
    }

    /**
     * Tính ngược số buổi/tuần cần thiết để hoàn thành khóa học trước endDate (G8 reverse).
     */
    public ReverseResult calculateReverse(ReverseRequest req) {
        if (req.endDate().isBefore(req.startDate())) {
            throw new BusinessException("Ngày kết thúc phải sau ngày bắt đầu");
        }
        long days = java.time.temporal.ChronoUnit.DAYS.between(req.startDate(), req.endDate());
        double weeks = Math.max(1.0, Math.ceil(days / 7.0));
        double periodsPerWeek = req.totalPeriods() / weeks;
        double sessionsPerWeek = periodsPerWeek / 2.0; // giả định 2 tiết/buổi

        String explanation = String.format(
                "Để hoàn thành %d tiết trong %.0f tuần (từ %s đến %s), cần trung bình %.1f tiết/tuần (khoảng %.1f buổi 2 tiết/tuần).",
                req.totalPeriods(), weeks, req.startDate(), req.endDate(), periodsPerWeek, sessionsPerWeek);

        return new ReverseResult(sessionsPerWeek, explanation);
    }

    // ==================== DB Loaders ====================

    public List<SlotDto> loadSlots(long classId) {
        return jdbc.query("""
            select id, day_of_week, start_time, duration_min, periods
            from class_schedule_slots
            where class_id = ?
            order by day_of_week, start_time
            """, (rs, n) -> new SlotDto(
                rs.getLong("id"),
                rs.getInt("day_of_week"),
                rs.getTime("start_time").toLocalTime(),
                rs.getInt("duration_min"),
                rs.getInt("periods")
        ), classId);
    }

    public List<HolidayDto> loadHolidays(int fromYear, int toYear) {
        return jdbc.query("""
            select id, holiday_date, name, is_day_off, year, coalesce(note, '') note
            from holidays
            where year between ? and ?
            order by holiday_date
            """, (rs, n) -> new HolidayDto(
                rs.getLong("id"),
                rs.getDate("holiday_date").toLocalDate(),
                rs.getString("name"),
                rs.getBoolean("is_day_off"),
                rs.getInt("year"),
                rs.getString("note")
        ), fromYear, toYear);
    }

    private static boolean isFullWeekBreak(LocalDate mon, LocalDate sun, List<BreakPeriod> breaks) {
        for (BreakPeriod b : breaks) {
            if (!mon.isBefore(b.from()) && !sun.isAfter(b.to())) return true;
        }
        return false;
    }

    private static boolean isDateInBreak(LocalDate date, List<BreakPeriod> breaks) {
        for (BreakPeriod b : breaks) {
            if (!date.isBefore(b.from()) && !date.isAfter(b.to())) return true;
        }
        return false;
    }
}
