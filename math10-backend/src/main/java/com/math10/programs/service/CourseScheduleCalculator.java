package com.math10.programs.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Dịch vụ tính lịch tiết học của một khóa học.
 *
 * <p>Tách logic ra khỏi Controller để:
 * (1) Xem trước và ghi thật đều đi qua cùng một thuật toán.
 * (2) Test case chạy độc lập mà không cần Spring context.
 *
 * <p><b>Nguyên tắc thiết kế:</b>
 * <ul>
 *   <li>Không đụng database. Nhận dữ liệu qua constructor, trả về kết quả qua {@link KetQua}.
 *   <li>Session có {@code editedManually=true} không bao giờ bị ghi đè.
 *   <li>Ngày nghỉ được tính đúng: chỉ bỏ qua slot rơi vào ngày nghỉ, không bỏ qua tuần.
 *   <li>Tuần nghỉ không tiêu số {@code instructionalWeekNumber}.
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class CourseScheduleCalculator {

    private final JdbcTemplate jdbc;

    // ------------------------------------------------------------------
    // Data classes (input)
    // ------------------------------------------------------------------

    public record LichTuanSlot(DayOfWeek dayOfWeek, int periodCount) {}

    public record NgayNghi(LocalDate startsOn, LocalDate endsOn) {
        public boolean covers(LocalDate date) {
            return !date.isBefore(startsOn) && !date.isAfter(endsOn);
        }
    }

    public record TeachingPlanItem(long id, int weekNumber, int orderInWeek, long programPeriodId) {}

    /**
     * Session đã tồn tại trong DB — cần để giữ lại những session chỉnh tay.
     */
    public record ExistingSession(long id, long programPeriodId, LocalDate plannedDate,
                                  int plannedOrder, boolean editedManually) {}

    // ------------------------------------------------------------------
    // Data classes (output)
    // ------------------------------------------------------------------

    public record GeneratedSession(
            Long existingId,          // null = sinh mới; non-null = cập nhật (chỉ khi !editedManually)
            long courseInstanceId,
            Long teachingPlanItemId,
            long programPeriodId,
            int instructionalWeekNumber,
            LocalDate plannedDate,
            int plannedOrderOnDate,
            boolean editedManually    // true = giữ nguyên từ DB, không ghi đè
    ) {}

    public record KetQua(
            List<GeneratedSession> sessions,
            LocalDate projectedEndDate,
            int totalRequired,
            int totalAvailable,
            boolean feasible,          // totalAvailable >= totalRequired
            String warning             // null nếu feasible và không có cảnh báo
    ) {}

    // ------------------------------------------------------------------
    // Thuật toán chính
    // ------------------------------------------------------------------

    /**
     * Sinh danh sách session theo kế hoạch giảng dạy, lịch tuần và ngày nghỉ.
     *
     * @param courseInstanceId  ID khóa học triển khai
     * @param startsOn          Ngày bắt đầu khóa học
     * @param targetEndsOn      Ngày kết thúc mục tiêu (để tính cảnh báo), có thể null
     * @param weeklySlots       Lịch học trong tuần — danh sách (thứ, số tiết), xếp theo thứ tự thứ
     * @param holidays          Danh sách kỳ nghỉ
     * @param planItems         Danh sách tiết từ kế hoạch giảng dạy, đã xếp theo (weekNumber, orderInWeek)
     * @param existing          Các session đã tồn tại trong DB (để giữ lại session chỉnh tay)
     */
    public KetQua generate(
            long courseInstanceId,
            LocalDate startsOn,
            LocalDate targetEndsOn,
            List<LichTuanSlot> weeklySlots,
            List<NgayNghi> holidays,
            List<TeachingPlanItem> planItems,
            List<ExistingSession> existing
    ) {
        // Bản đồ session đã chỉnh tay theo programPeriodId để bảo toàn chúng.
        Map<Long, ExistingSession> manualByPeriod = existing.stream()
                .filter(ExistingSession::editedManually)
                .collect(Collectors.toMap(ExistingSession::programPeriodId, s -> s, (a, b) -> a));

        // Bản đồ session không chỉnh tay theo programPeriodId để tái sử dụng ID.
        Map<Long, ExistingSession> autoByPeriod = existing.stream()
                .filter(s -> !s.editedManually())
                .collect(Collectors.toMap(ExistingSession::programPeriodId, s -> s, (a, b) -> a));

        // Sắp xếp lịch tuần theo DayOfWeek.getValue() (1=Mon .. 7=Sun)
        List<LichTuanSlot> sortedSlots = weeklySlots.stream()
                .sorted(Comparator.comparingInt(s -> s.dayOfWeek().getValue()))
                .toList();

        if (sortedSlots.isEmpty() || planItems.isEmpty()) {
            return new KetQua(List.of(), null, planItems.size(), 0, false,
                    "Chưa cấu hình lịch tuần hoặc kế hoạch giảng dạy trống.");
        }

        List<GeneratedSession> result = new ArrayList<>();
        LocalDate currentDate = startsOn;
        int remainingOnDate = 0;
        int itemsAssigned = 0;
        LocalDate projectedEnd = null;

        // Theo dõi số thứ tự trong ngày
        int orderOnDate = 0;

        // Biến quản lý slot hiện tại trong ngày
        LichTuanSlot currentSlot = null;

        for (TeachingPlanItem item : planItems) {
            // Nếu session này đã chỉnh tay, giữ nguyên ngày và thứ tự.
            ExistingSession manual = manualByPeriod.get(item.programPeriodId());
            if (manual != null) {
                result.add(new GeneratedSession(
                        manual.id(), courseInstanceId, item.id(), item.programPeriodId(),
                        item.weekNumber(), manual.plannedDate(), manual.plannedOrder(), true));
                projectedEnd = projectedEnd == null ? manual.plannedDate()
                        : (manual.plannedDate().isAfter(projectedEnd) ? manual.plannedDate() : projectedEnd);
                itemsAssigned++;
                continue;
            }

            // Nếu ngày hiện tại đã dùng hết slot, hoặc không có slot cho ngày này → tìm ngày tiếp.
            while (remainingOnDate <= 0) {
                currentDate = nextValidDate(currentDate, sortedSlots, holidays);
                currentSlot = slotFor(currentDate, sortedSlots);
                if (currentSlot != null) {
                    remainingOnDate = currentSlot.periodCount();
                    orderOnDate = 0;
                } else {
                    // Không tìm được ngày hợp lệ (lý thuyết không xảy ra do nextValidDate chắc chắn trả ngày có slot)
                    currentDate = currentDate.plusDays(1);
                }
            }

            // Gán tiết này vào currentDate
            orderOnDate++;
            remainingOnDate--;

            ExistingSession auto = autoByPeriod.get(item.programPeriodId());
            result.add(new GeneratedSession(
                    auto != null ? auto.id() : null,
                    courseInstanceId, item.id(), item.programPeriodId(),
                    item.weekNumber(), currentDate, orderOnDate, false));

            projectedEnd = projectedEnd == null ? currentDate
                    : (currentDate.isAfter(projectedEnd) ? currentDate : projectedEnd);
            itemsAssigned++;

            // Nếu hết slot trong ngày → lần vòng tiếp sẽ chuyển sang ngày mới
            if (remainingOnDate <= 0) {
                currentDate = currentDate.plusDays(1);
            }
        }

        // Tính số tiết khả dụng trong khoảng target (để cảnh báo)
        int totalAvailable = targetEndsOn != null
                ? countAvailablePeriods(startsOn, targetEndsOn, sortedSlots, holidays)
                : itemsAssigned;  // Nếu không có target, không cảnh báo thiếu

        boolean feasible = totalAvailable >= planItems.size();
        String warning = buildWarning(planItems.size(), totalAvailable, projectedEnd, targetEndsOn);

        return new KetQua(result, projectedEnd, planItems.size(), totalAvailable, feasible, warning);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    /**
     * Tìm ngày hợp lệ tiếp theo (có trong weeklySlots và không phải ngày nghỉ).
     */
    private LocalDate nextValidDate(LocalDate from, List<LichTuanSlot> slots, List<NgayNghi> holidays) {
        LocalDate candidate = from;
        for (int guard = 0; guard < 1000; guard++) {
            if (slotFor(candidate, slots) != null && !isHoliday(candidate, holidays)) {
                return candidate;
            }
            candidate = candidate.plusDays(1);
        }
        // An toàn: không bao giờ tới đây trong điều kiện bình thường.
        return from.plusDays(1000);
    }

    /** Trả về slot của ngày này nếu có trong cấu hình, ngược lại null. */
    private LichTuanSlot slotFor(LocalDate date, List<LichTuanSlot> slots) {
        DayOfWeek dow = date.getDayOfWeek();
        return slots.stream().filter(s -> s.dayOfWeek() == dow).findFirst().orElse(null);
    }

    /** Kiểm tra ngày có nằm trong bất kỳ kỳ nghỉ nào không. */
    private boolean isHoliday(LocalDate date, List<NgayNghi> holidays) {
        return holidays.stream().anyMatch(h -> h.covers(date));
    }

    /**
     * Đếm số tiết khả dụng (slots) trong khoảng [from, to] sau khi loại ngày nghỉ.
     */
    private int countAvailablePeriods(LocalDate from, LocalDate to,
                                      List<LichTuanSlot> slots, List<NgayNghi> holidays) {
        int count = 0;
        LocalDate d = from;
        while (!d.isAfter(to)) {
            LichTuanSlot slot = slotFor(d, slots);
            if (slot != null && !isHoliday(d, holidays)) {
                count += slot.periodCount();
            }
            d = d.plusDays(1);
        }
        return count;
    }

    /** Xây dựng thông báo cảnh báo/thông tin. */
    private String buildWarning(int required, int available,
                                LocalDate projectedEnd, LocalDate targetEnd) {
        if (available < required) {
            return String.format(
                    "Lịch hiện tại không đủ để hoàn thành chương trình. " +
                    "Yêu cầu: %d tiết. Khả dụng: %d tiết. Thiếu: %d tiết.",
                    required, available, required - available);
        }
        if (targetEnd != null && projectedEnd != null) {
            long daysDiff = targetEnd.toEpochDay() - projectedEnd.toEpochDay();
            if (daysDiff > 3) {
                return String.format("Dự kiến hoàn thành %s, sớm hơn ngày kết thúc mục tiêu %s khoảng %d ngày.",
                        projectedEnd, targetEnd, daysDiff);
            }
            if (daysDiff < -3) {
                return String.format("Dự kiến hoàn thành %s, muộn hơn ngày kết thúc mục tiêu %s khoảng %d ngày.",
                        projectedEnd, targetEnd, -daysDiff);
            }
        }
        return null;
    }

    // ------------------------------------------------------------------
    // Tính tiến độ lớp: BEHIND / ON_TRACK / AHEAD
    // ------------------------------------------------------------------

    public enum TrangThaiTienDo { ON_TRACK, BEHIND, AHEAD }

    public record TienDo(TrangThaiTienDo trangThai, int lech, int theoKeHoach, int thucTe) {}

    /**
     * Tính tiến độ của một lớp so với kế hoạch triển khai của khóa hôm nay.
     *
     * @param courseInstanceId  ID khóa học
     * @param classId           ID lớp
     * @param asOf              Ngày tham chiếu (thường là hôm nay)
     */
    public TienDo tinhTienDo(long courseInstanceId, long classId, LocalDate asOf) {
        // Số tiết theo kế hoạch đến ngày này (sessions có planned_date <= asOf)
        Integer theoKeHoach = jdbc.queryForObject("""
                select count(*)
                from course_sessions
                where course_instance_id = ? and planned_date <= ? and deleted_at is null
                """, Integer.class, courseInstanceId, java.sql.Date.valueOf(asOf));
        theoKeHoach = theoKeHoach == null ? 0 : theoKeHoach;

        // Số tiết lớp đã chốt thực tế (class_period_progress)
        Integer thucTe = jdbc.queryForObject("""
                select count(*)
                from class_period_progress
                where class_id = ? and deleted_at is null
                  and period_id in (
                      select program_period_id from course_sessions
                      where course_instance_id = ? and deleted_at is null
                  )
                """, Integer.class, classId, courseInstanceId);
        thucTe = thucTe == null ? 0 : thucTe;

        int lech = thucTe - theoKeHoach;
        TrangThaiTienDo trangThai = lech == 0 ? TrangThaiTienDo.ON_TRACK
                : lech > 0 ? TrangThaiTienDo.AHEAD : TrangThaiTienDo.BEHIND;
        return new TienDo(trangThai, Math.abs(lech), theoKeHoach, thucTe);
    }
}
