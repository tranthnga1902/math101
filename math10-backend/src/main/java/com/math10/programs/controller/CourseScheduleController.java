package com.math10.programs.controller;

import com.math10.audit.service.AuditService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.programs.dto.CourseScheduleDtos;
import com.math10.programs.service.CourseScheduleCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Quản lý lịch tiết của Khóa học triển khai.
 *
 * <p><b>Phân cấp trách nhiệm:</b>
 * <ul>
 *   <li>{@code course_weekly_schedule} — cấu hình lịch tuần (thứ nào, mấy tiết).
 *   <li>{@code course_holidays} — ngày nghỉ của khóa này.
 *   <li>{@code course_sessions} — lịch tiết đã sinh ra từ kế hoạch + lịch tuần + ngày nghỉ.
 *   <li>{@code class_course_progress} — tiến độ thực tế của từng lớp (riêng biệt).
 * </ul>
 *
 * <p>Lịch tiết (course_sessions) là tài sản chung của tất cả các lớp học cùng khóa.
 * Không clone session cho từng lớp.
 */
@RestController
@RequiredArgsConstructor
public class CourseScheduleController {

    private final JdbcTemplate jdbc;
    private final CourseScheduleCalculator calculator;
    private final AuditService audit;

    // ==========================================================================
    // Lịch học trong tuần (course_weekly_schedule)
    // ==========================================================================

    @GetMapping("/api/admin/course-instances/{khoaId}/weekly-schedule")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<CourseScheduleDtos.WeeklySlotResponse>> getWeeklySchedule(
            @PathVariable Long khoaId) {
        requireInstance(khoaId);
        return ApiResponse.ok("Lịch tuần của khóa", readWeeklySlots(khoaId));
    }

    /**
     * Lưu cấu hình lịch tuần (thay thế toàn bộ, không merge).
     * Admin chọn những thứ muốn dạy và số tiết từng thứ.
     */
    @PutMapping("/api/admin/course-instances/{khoaId}/weekly-schedule")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<List<CourseScheduleDtos.WeeklySlotResponse>> saveWeeklySchedule(
            @PathVariable Long khoaId,
            @RequestBody List<CourseScheduleDtos.WeeklySlotInput> slots) {
        requireInstance(khoaId);
        if (slots == null || slots.isEmpty()) throw new BusinessException("Phải chọn ít nhất 1 ngày học trong tuần");

        Set<String> validDays = Set.of("MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY");
        for (CourseScheduleDtos.WeeklySlotInput s : slots) {
            if (!validDays.contains(s.dayOfWeek()))
                throw new BusinessException("Thứ không hợp lệ: " + s.dayOfWeek());
            if (s.periodCount() < 1 || s.periodCount() > 10)
                throw new BusinessException("Số tiết phải trong khoảng 1–10");
        }

        // Xóa mềm tất cả slot cũ, thêm mới
        jdbc.update("update course_weekly_schedule set deleted_at=now(), updated_at=now() where course_instance_id=? and deleted_at is null", khoaId);
        int order = 0;
        for (CourseScheduleDtos.WeeklySlotInput s : slots) {
            jdbc.update("""
                    insert into course_weekly_schedule
                        (course_instance_id, day_of_week, period_count, order_index, created_at, updated_at)
                    values (?,?,?,?,now(),now())
                    """, khoaId, s.dayOfWeek(), s.periodCount(), order++);
        }
        audit.record("UPDATE", "COURSE_WEEKLY_SCHEDULE", khoaId, null,
                slots.stream().map(s -> s.dayOfWeek() + "=" + s.periodCount()).collect(Collectors.joining(",")));
        return ApiResponse.ok("Đã lưu lịch tuần", readWeeklySlots(khoaId));
    }

    // ==========================================================================
    // Ngày nghỉ (course_holidays)
    // ==========================================================================

    @GetMapping("/api/admin/course-instances/{khoaId}/holidays")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String, Object>>> getHolidays(@PathVariable Long khoaId) {
        requireInstance(khoaId);
        return ApiResponse.ok("Ngày nghỉ của khóa",
                jdbc.queryForList("""
                        select * from course_holidays
                        where course_instance_id = ? and deleted_at is null
                        order by starts_on
                        """, khoaId));
    }

    @PostMapping("/api/admin/course-instances/{khoaId}/holidays")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Map<String, Object>> addHoliday(
            @PathVariable Long khoaId,
            @RequestBody CourseScheduleDtos.HolidayInput x) {
        requireInstance(khoaId);
        if (x.startsOn() == null || x.endsOn() == null) throw new BusinessException("Phải có ngày bắt đầu và kết thúc");
        if (x.endsOn().isBefore(x.startsOn())) throw new BusinessException("Ngày kết thúc phải sau ngày bắt đầu");
        if (x.name() == null || x.name().isBlank()) throw new BusinessException("Phải có tên ngày nghỉ");
        String type = (x.type() == null || x.type().isBlank()) ? "HOLIDAY" : x.type();

        Long id = jdbc.queryForObject("""
                insert into course_holidays
                    (course_instance_id, starts_on, ends_on, type, name, description, created_at, updated_at)
                values (?,?,?,?,?,?,now(),now()) returning id
                """, Long.class, khoaId, x.startsOn(), x.endsOn(), type, x.name().trim(), x.description());
        return ApiResponse.created("Đã thêm ngày nghỉ",
                jdbc.queryForMap("select * from course_holidays where id=?", id));
    }

    @DeleteMapping("/api/admin/course-holidays/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Void> removeHoliday(@PathVariable Long id) {
        int n = jdbc.update("update course_holidays set deleted_at=now(), updated_at=now() where id=? and deleted_at is null", id);
        if (n == 0) throw new ResourceNotFoundException("Không tìm thấy ngày nghỉ");
        return ApiResponse.noContent("Đã gỡ ngày nghỉ");
    }

    // ==========================================================================
    // Preview lịch tiết (không ghi gì)
    // ==========================================================================

    @GetMapping("/api/admin/course-instances/{khoaId}/sessions/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<CourseScheduleDtos.GeneratePreview> preview(
            @PathVariable Long khoaId,
            @RequestParam(required = false) Long teachingPlanId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startsOn) {
        Map<String, Object> khoa = requireInstance(khoaId);
        LocalDate start = startsOn != null ? startsOn
                : ((java.sql.Date) khoa.get("starts_on")).toLocalDate();
        LocalDate targetEnd = khoa.get("target_ends_on") != null
                ? ((java.sql.Date) khoa.get("target_ends_on")).toLocalDate()
                : ((java.sql.Date) khoa.get("ends_on")).toLocalDate();
        Long planId = resolvePlanId(khoaId, teachingPlanId);

        CourseScheduleCalculator.KetQua kq = runCalculation(khoaId, planId, start, targetEnd, List.of());
        int manualCount = kq.sessions().stream().filter(CourseScheduleCalculator.GeneratedSession::editedManually).mapToInt(x -> 1).sum();

        // Trả về tối đa 300 dòng trong preview để tránh payload quá lớn
        List<CourseScheduleDtos.SessionRow> rows = kq.sessions().stream()
                .limit(300)
                .map(this::toRow)
                .toList();

        return ApiResponse.ok("Xem trước lịch tiết",
                new CourseScheduleDtos.GeneratePreview(
                        kq.sessions().size(), kq.projectedEndDate(),
                        kq.totalRequired(), kq.totalAvailable(),
                        kq.feasible(), kq.warning(), manualCount, rows));
    }

    // ==========================================================================
    // Sinh lịch tiết (ghi vào DB)
    // ==========================================================================

    @PostMapping("/api/admin/course-instances/{khoaId}/sessions/generate")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<CourseScheduleDtos.GeneratePreview> generate(
            @PathVariable Long khoaId,
            @RequestBody(required = false) CourseScheduleDtos.GenerateRequest req) {
        Map<String, Object> khoa = requireInstance(khoaId);
        LocalDate start = ((java.sql.Date) khoa.get("starts_on")).toLocalDate();
        LocalDate targetEnd = khoa.get("target_ends_on") != null
                ? ((java.sql.Date) khoa.get("target_ends_on")).toLocalDate()
                : ((java.sql.Date) khoa.get("ends_on")).toLocalDate();
        Long planId = resolvePlanId(khoaId, req != null ? req.teachingPlanId() : null);

        // Đọc các session đã có (để bảo toàn edited_manually)
        List<CourseScheduleCalculator.ExistingSession> existing = jdbc.query("""
                select id, program_period_id, planned_date, planned_order_on_date, edited_manually
                from course_sessions
                where course_instance_id = ? and deleted_at is null
                """, (rs, i) -> new CourseScheduleCalculator.ExistingSession(
                rs.getLong("id"), rs.getLong("program_period_id"),
                rs.getDate("planned_date").toLocalDate(),
                rs.getInt("planned_order_on_date"), rs.getBoolean("edited_manually")), khoaId);

        CourseScheduleCalculator.KetQua kq = runCalculation(khoaId, planId, start, targetEnd, existing);
        int manualCount = (int) kq.sessions().stream().filter(CourseScheduleCalculator.GeneratedSession::editedManually).count();

        // Xóa mềm tất cả session KHÔNG chỉnh tay
        jdbc.update("""
                update course_sessions set deleted_at=now(), updated_at=now()
                where course_instance_id=? and deleted_at is null and edited_manually=false
                """, khoaId);

        // Insert hoặc update session mới
        for (CourseScheduleCalculator.GeneratedSession s : kq.sessions()) {
            if (s.editedManually()) continue; // Bỏ qua, giữ nguyên dòng cũ

            if (s.existingId() != null) {
                // Khôi phục dòng đã xóa mềm ở bước trên (nếu có) — thực ra đã xóa rồi, nên insert mới.
            }
            jdbc.update("""
                    insert into course_sessions
                        (course_instance_id, teaching_plan_item_id, program_period_id,
                         instructional_week_number, planned_date, planned_order_on_date,
                         status, edited_manually, created_at, updated_at)
                    values (?,?,?,?,?,?,'PLANNED',false,now(),now())
                    """, khoaId, s.teachingPlanItemId(), s.programPeriodId(),
                    s.instructionalWeekNumber(), java.sql.Date.valueOf(s.plannedDate()),
                    s.plannedOrderOnDate());
        }

        // Cập nhật target_ends_on nếu projectedEndDate khác
        if (kq.projectedEndDate() != null) {
            jdbc.update("update course_instances set target_ends_on=?, updated_at=now() where id=?",
                    java.sql.Date.valueOf(kq.projectedEndDate()), khoaId);
        }

        audit.record("GENERATE", "COURSE_SESSIONS", khoaId, null,
                "sessions=" + kq.sessions().size() + " manual=" + manualCount + " feasible=" + kq.feasible());

        return ApiResponse.ok("Đã sinh lịch tiết",
                new CourseScheduleDtos.GeneratePreview(
                        kq.sessions().size(), kq.projectedEndDate(),
                        kq.totalRequired(), kq.totalAvailable(),
                        kq.feasible(), kq.warning(), manualCount, null));
    }

    // ==========================================================================
    // Xem lịch tiết đã sinh
    // ==========================================================================

    @GetMapping("/api/course-instances/{khoaId}/sessions")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<CourseScheduleDtos.SessionRow>> getSessions(
            @PathVariable Long khoaId,
            @RequestParam(required = false) Integer weekNumber) {
        requireInstance(khoaId);
        String sql = """
                select cs.id, cs.program_period_id, pp.title period_title, ps.name strand_name,
                       cs.instructional_week_number, cs.planned_date, cs.planned_order_on_date,
                       cs.status, cs.edited_manually
                from course_sessions cs
                join program_periods pp on pp.id = cs.program_period_id
                join program_strands ps on ps.id = pp.strand_id
                where cs.course_instance_id = ? and cs.deleted_at is null
                """ + (weekNumber != null ? " and cs.instructional_week_number = " + weekNumber : "")
                + " order by cs.planned_date, cs.planned_order_on_date";
        List<CourseScheduleDtos.SessionRow> rows = jdbc.query(sql,
                (rs, i) -> new CourseScheduleDtos.SessionRow(
                        rs.getLong("id"), rs.getLong("program_period_id"),
                        rs.getString("period_title"), rs.getString("strand_name"),
                        rs.getInt("instructional_week_number"),
                        rs.getDate("planned_date").toLocalDate(),
                        rs.getInt("planned_order_on_date"),
                        rs.getString("status"), rs.getBoolean("edited_manually")),
                khoaId);
        return ApiResponse.ok("Lịch tiết của khóa", rows);
    }

    // ==========================================================================
    // Tiến độ lớp học
    // ==========================================================================

    @GetMapping("/api/course-instances/{khoaId}/class-progress")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<CourseScheduleDtos.ClassProgressResponse>> classProgress(
            @PathVariable Long khoaId) {
        requireInstance(khoaId);
        LocalDate today = LocalDate.now();

        // Số tiết theo kế hoạch đến hôm nay
        Integer plannedCount = jdbc.queryForObject("""
                select count(*) from course_sessions
                where course_instance_id=? and planned_date<=? and deleted_at is null
                """, Integer.class, khoaId, java.sql.Date.valueOf(today));
        int planned = plannedCount == null ? 0 : plannedCount;

        List<Map<String, Object>> classes = jdbc.queryForList("""
                select cl.id class_id, cl.name class_name,
                       coalesce(ccp.completed_period_count, 0) completed,
                       ccp.last_completed_session_id,
                       cs.planned_date last_completed_date
                from class_courses cc
                join classes cl on cl.id = cc.class_id and cl.deleted_at is null
                left join class_course_progress ccp on ccp.class_id = cc.class_id and ccp.course_instance_id = cc.course_instance_id
                left join course_sessions cs on cs.id = ccp.last_completed_session_id
                where cc.course_instance_id=? and cc.deleted_at is null
                order by cl.name
                """, khoaId);

        List<CourseScheduleDtos.ClassProgressResponse> result = new ArrayList<>();
        for (Map<String, Object> row : classes) {
            int completed = ((Number) row.get("completed")).intValue();
            int lech = Math.abs(completed - planned);
            String trangThai;
            if (completed < planned) trangThai = "BEHIND";
            else if (completed > planned) trangThai = "AHEAD";
            else trangThai = "ON_TRACK";

            result.add(new CourseScheduleDtos.ClassProgressResponse(
                    ((Number) row.get("class_id")).longValue(),
                    (String) row.get("class_name"),
                    khoaId, completed, planned, lech, trangThai,
                    row.get("last_completed_session_id") != null
                            ? ((Number) row.get("last_completed_session_id")).longValue() : null,
                    row.get("last_completed_date") != null
                            ? ((java.sql.Date) row.get("last_completed_date")).toLocalDate() : null
            ));
        }
        return ApiResponse.ok("Tiến độ các lớp", result);
    }

    // ==========================================================================
    // Helpers
    // ==========================================================================

    private Map<String, Object> requireInstance(Long khoaId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select * from course_instances where id=? and deleted_at is null", khoaId);
        if (rows.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy khóa học");
        return rows.get(0);
    }

    /** Tìm teaching_plan_id ưu tiên: tham số > course_instances.teaching_plan_id > teaching_plan có template_id của instance. */
    private Long resolvePlanId(Long khoaId, Long override) {
        if (override != null) return override;
        Map<String, Object> khoa = requireInstance(khoaId);
        if (khoa.get("teaching_plan_id") != null) return ((Number) khoa.get("teaching_plan_id")).longValue();
        // Fallback: tìm qua template_id
        if (khoa.get("template_id") != null) {
            List<Long> plans = jdbc.queryForList("""
                    select id from teaching_plans
                    where template_id = ? and deleted_at is null order by id limit 1
                    """, Long.class, khoa.get("template_id"));
            if (!plans.isEmpty()) return plans.get(0);
        }
        throw new BusinessException("Khóa học chưa gắn kế hoạch giảng dạy. Vui lòng chọn kế hoạch trước khi sinh lịch.");
    }

    private List<CourseScheduleDtos.WeeklySlotResponse> readWeeklySlots(Long khoaId) {
        return jdbc.query("""
                select id, day_of_week, period_count, order_index
                from course_weekly_schedule
                where course_instance_id=? and deleted_at is null
                order by order_index, day_of_week
                """, (rs, i) -> new CourseScheduleDtos.WeeklySlotResponse(
                rs.getLong("id"), rs.getString("day_of_week"),
                rs.getInt("period_count"), rs.getInt("order_index")), khoaId);
    }

    private CourseScheduleCalculator.KetQua runCalculation(
            Long khoaId, Long planId, LocalDate start, LocalDate targetEnd,
            List<CourseScheduleCalculator.ExistingSession> existing) {

        // Đọc lịch tuần
        List<CourseScheduleCalculator.LichTuanSlot> slots = jdbc.query("""
                select day_of_week, period_count from course_weekly_schedule
                where course_instance_id=? and deleted_at is null
                order by order_index
                """, (rs, i) -> new CourseScheduleCalculator.LichTuanSlot(
                DayOfWeek.valueOf(rs.getString("day_of_week")), rs.getInt("period_count")), khoaId);

        if (slots.isEmpty()) throw new BusinessException("Chưa cấu hình lịch học trong tuần");

        // Đọc ngày nghỉ
        List<CourseScheduleCalculator.NgayNghi> holidays = jdbc.query("""
                select starts_on, ends_on from course_holidays
                where course_instance_id=? and deleted_at is null
                order by starts_on
                """, (rs, i) -> new CourseScheduleCalculator.NgayNghi(
                rs.getDate("starts_on").toLocalDate(), rs.getDate("ends_on").toLocalDate()), khoaId);

        // Đọc teaching_plan_items
        List<CourseScheduleCalculator.TeachingPlanItem> items = jdbc.query("""
                select tpi.id, tpi.week_number, tpi.order_in_week, tpi.program_period_id
                from teaching_plan_items tpi
                where tpi.teaching_plan_id = ? and tpi.deleted_at is null
                order by tpi.week_number, tpi.order_in_week
                """, (rs, i) -> new CourseScheduleCalculator.TeachingPlanItem(
                rs.getLong("id"), rs.getInt("week_number"), rs.getInt("order_in_week"),
                rs.getLong("program_period_id")), planId);

        if (items.isEmpty()) throw new BusinessException("Kế hoạch giảng dạy chưa có tiết nào được phân phối");

        return calculator.generate(khoaId, start, targetEnd, slots, holidays, items, existing);
    }

    private CourseScheduleDtos.SessionRow toRow(CourseScheduleCalculator.GeneratedSession s) {
        return new CourseScheduleDtos.SessionRow(
                s.existingId(), s.programPeriodId(), null, null,
                s.instructionalWeekNumber(), s.plannedDate(), s.plannedOrderOnDate(),
                "PLANNED", s.editedManually());
    }
}
