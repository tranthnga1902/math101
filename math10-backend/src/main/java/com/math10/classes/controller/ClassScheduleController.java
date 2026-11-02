package com.math10.classes.controller;

import com.math10.classes.service.ClassAccessGuard;
import com.math10.classes.service.ClassScheduleGenerator;
import com.math10.classes.service.ClassScheduleService;
import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/**
 * API cho class_schedule — lịch ngày thực của Lớp.
 *
 * <p>Đây là tầng Class trong mô hình 3 tầng Program → Course → Class.
 * Course Delivery Sessions (không có ngày) nằm ở CourseDeliverySessionController.
 */
@RestController
@RequestMapping("/api/classes/{classId}/schedule")
@RequiredArgsConstructor
public class ClassScheduleController {

    private final JdbcTemplate jdbc;
    private final ClassScheduleGenerator generator;
    private final ClassScheduleService service;
    private final CurrentUserService current;
    private final ClassAccessGuard guard;

    public record DayOffInput(LocalDate startsOn, LocalDate endsOn, String reason) {}

    @GetMapping("/days-off")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<Map<String,Object>>> daysOff(@PathVariable long classId) {
        guard.requireTeacher(classId);
        return ApiResponse.ok("Ngày nghỉ của lớp", jdbc.queryForList(
                "select id, starts_on, ends_on, reason from class_days_off where class_id=? order by starts_on", classId));
    }

    @PostMapping("/days-off")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> addDayOff(@PathVariable long classId, @RequestBody DayOffInput input) {
        guard.requireTeacher(classId);
        if (input.startsOn()==null || input.endsOn()==null || input.endsOn().isBefore(input.startsOn()))
            throw new com.math10.common.exception.BusinessException("Khoảng ngày nghỉ không hợp lệ.");
        if (input.reason()!=null && input.reason().length()>500)
            throw new com.math10.common.exception.BusinessException("Lý do tối đa 500 ký tự.");
        jdbc.update("insert into class_days_off(class_id,starts_on,ends_on,reason) values(?,?,?,?)",
                classId,input.startsOn(),input.endsOn(),input.reason());
        return ApiResponse.ok("Đã thêm ngày nghỉ",null);
    }

    @DeleteMapping("/days-off/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> removeDayOff(@PathVariable long classId,@PathVariable long id) {
        guard.requireTeacher(classId);
        if(jdbc.update("delete from class_days_off where id=? and class_id=?",id,classId)==0)
            throw new com.math10.common.exception.ResourceNotFoundException("Không tìm thấy ngày nghỉ.");
        return ApiResponse.noContent("Đã gỡ ngày nghỉ");
    }

    private Map<String, Object> generated(ClassScheduleGenerator.KetQua result) {
        Map<String, Object> data = new java.util.LinkedHashMap<>();
        data.put("totalScheduled", result.totalScheduled());
        data.put("projectedEndDate", result.projectedEndDate());
        data.put("keptManual", result.keptManual());
        data.put("warnings", result.warnings());
        return data;
    }

    // ------------------------------------------------------------------
    // Đọc lịch
    // ------------------------------------------------------------------

    /**
     * Danh sách lịch học của lớp, sắp xếp theo ngày tăng dần.
     * Kèm thông tin buổi (seq, session_type, title) và tiến độ.
     */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<List<Map<String, Object>>> danhSach(@PathVariable long classId) {
        guard.requireMember(classId);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select cs.id,
                       cs.seq,
                       cs.scheduled_date,
                       cs.start_time,
                       cs.status,
                       cs.taught_by,
                       cs.completed_at,
                       cs.edited_manually,
                       cs.is_makeup,
                       cs.note,
                       cds.session_type,
                       coalesce(nullif(trim(cds.title), ''),
                         (select string_agg(distinct nullif(trim(pp.title), ''), ' · ' order by nullif(trim(pp.title), ''))
                            from course_delivery_session_units u
                            join program_periods pp on pp.id = u.program_period_id
                           where u.course_delivery_session_id = cds.id and u.deleted_at is null)) session_title,
                       (select min(pp.period_no) from course_delivery_session_units u
                         join program_periods pp on pp.id=u.program_period_id
                        where u.course_delivery_session_id=cds.id and u.deleted_at is null) period_from,
                       (select max(pp.period_no) from course_delivery_session_units u
                         join program_periods pp on pp.id=u.program_period_id
                        where u.course_delivery_session_id=cds.id and u.deleted_at is null) period_to
                  from class_schedule cs
                  join course_delivery_sessions cds
                    on cds.id = cs.course_delivery_session_id
                 where cs.class_id = ?
                   and cs.deleted_at is null
                 order by cs.seq, cs.scheduled_date
                """, classId);

        return ApiResponse.ok("Lịch học của lớp", rows);
    }

    /** Mẫu lịch tuần của lớp cho màn chi tiết (chỉ đọc). */
    @GetMapping("/slots")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<List<Map<String, Object>>> slots(@PathVariable long classId) {
        guard.requireMember(classId);
        return ApiResponse.ok("Lịch hằng tuần", jdbc.queryForList("""
                select id, day_of_week, start_time, duration_min, periods
                  from class_schedule_slots
                 where class_id=?
                 order by day_of_week, start_time
                """, classId));
    }

    // ------------------------------------------------------------------
    // Sinh lịch
    // ------------------------------------------------------------------

    /** Xem trước lịch sẽ sinh (không ghi DB). */
    @PostMapping("/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Map<String, Object>> preview(@PathVariable long classId) {
        ClassScheduleGenerator.KetQua kq = generator.preview(classId);
        return ApiResponse.ok("Xem trước lịch", generated(kq));
    }

    /** Sinh lịch chính thức lần đầu. */
    @PostMapping("/generate")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Map<String, Object>> generate(@PathVariable long classId) {
        ClassScheduleGenerator.KetQua kq = generator.generate(classId);
        return ApiResponse.ok("Đã sinh " + kq.totalScheduled() + " buổi", generated(kq));
    }

    /**
     * Sinh lại lịch (khi đổi lịch tuần, ngày nghỉ...).
     * Cảnh báo nếu có dòng edited_manually.
     */
    @PostMapping("/regenerate")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Map<String, Object>> regenerate(@PathVariable long classId) {
        ClassScheduleGenerator.KetQua kq = generator.generate(classId);
        String msg = kq.keptManual() > 0
                ? "Đã sinh lại. Giữ " + kq.keptManual() + " buổi đã chỉnh tay."
                : "Đã sinh lại " + kq.totalScheduled() + " buổi.";
        return ApiResponse.ok(msg, generated(kq));
    }

    // ------------------------------------------------------------------
    // Complete / Postpone
    // ------------------------------------------------------------------

    /**
     * Giáo viên xác nhận hoàn thành một buổi.
     * Ngày đã qua nhưng chưa bấm vẫn là PLANNED — không tự thành COMPLETED.
     */
    @PostMapping("/{scheduleId}/complete")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> complete(@PathVariable long classId,
                                      @PathVariable long scheduleId) {
        guard.requireTeacher(classId);
        long teacherId = current.requireUserId();
        service.complete(classId, scheduleId, teacherId);
        return ApiResponse.ok("Đã hoàn thành buổi học", null);
    }

    /** Hoãn một buổi học. */
    @PostMapping("/{scheduleId}/postpone")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> postpone(@PathVariable long classId,
                                      @PathVariable long scheduleId,
                                      @RequestBody(required = false) Map<String, String> body) {
        guard.requireTeacher(classId);
        String note = body != null ? body.get("note") : null;
        service.postpone(classId, scheduleId, note);
        return ApiResponse.ok("Đã hoãn buổi học", null);
    }

    public record UpdateSessionInput(
            LocalDate scheduledDate,
            String startTime,
            String status,
            String note,
            Boolean isMakeup
    ) {}

    public record CreateSessionInput(
            Long courseDeliverySessionId,
            Integer seq,
            LocalDate scheduledDate,
            String startTime,
            String note,
            Boolean isMakeup
    ) {}

    /**
     * Chỉnh sửa thông tin một buổi học cụ thể của lớp (ngày, giờ, trạng thái, ghi chú, bù).
     * Đánh dấu edited_manually = true để không bị đè khi sinh lại lịch.
     */
    @PatchMapping("/{scheduleId}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> updateSession(@PathVariable long classId,
                                           @PathVariable long scheduleId,
                                           @RequestBody UpdateSessionInput input) {
        guard.requireTeacher(classId);
        StringBuilder sql = new StringBuilder("update class_schedule set edited_manually = true, updated_at = now()");
        List<Object> args = new java.util.ArrayList<>();
        if (input.scheduledDate() != null) {
            sql.append(", scheduled_date = ?");
            args.add(input.scheduledDate());
        }
        if (input.startTime() != null) {
            sql.append(", start_time = ?::time");
            args.add(input.startTime().isBlank() ? null : input.startTime());
        }
        if (input.status() != null && !input.status().isBlank()) {
            sql.append(", status = ?");
            args.add(input.status());
            if ("COMPLETED".equals(input.status())) {
                sql.append(", completed_at = coalesce(completed_at, now()), completed_source = 'TEACHER_ACTION', taught_by = coalesce(taught_by, ?)");
                args.add(current.requireUserId());
            } else {
                sql.append(", completed_at = null, completed_source = null, taught_by = null");
            }
        }
        if (input.note() != null) {
            sql.append(", note = ?");
            args.add(input.note().isBlank() ? null : input.note());
        }
        if (input.isMakeup() != null) {
            sql.append(", is_makeup = ?");
            args.add(input.isMakeup());
        }
        sql.append(" where id = ? and class_id = ? and deleted_at is null");
        args.add(scheduleId);
        args.add(classId);

        int updated = jdbc.update(sql.toString(), args.toArray());
        if (updated == 0) {
            throw new com.math10.common.exception.ResourceNotFoundException("Không tìm thấy buổi học trong lớp.");
        }
        return ApiResponse.ok("Đã cập nhật buổi học", null);
    }

    /**
     * Thêm buổi học mới / buổi học bù cho riêng lớp.
     */
    @PostMapping("/sessions")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Map<String, Object>> addSession(@PathVariable long classId,
                                                        @RequestBody CreateSessionInput input) {
        guard.requireTeacher(classId);
        if (input.scheduledDate() == null) {
            throw new com.math10.common.exception.BusinessException("Ngày học là bắt buộc.");
        }

        Long deliverySessionId = input.courseDeliverySessionId();
        if (deliverySessionId == null) {
            List<Long> available = jdbc.queryForList("""
                    select cds.id
                      from class_courses cc
                      join course_delivery_sessions cds on cds.course_instance_id = cc.course_instance_id and cds.deleted_at is null
                     where cc.class_id = ? and cc.deleted_at is null
                     order by cds.seq limit 1
                    """, Long.class, classId);
            if (!available.isEmpty()) {
                deliverySessionId = available.get(0);
            } else {
                List<Long> any = jdbc.queryForList("select id from course_delivery_sessions where deleted_at is null order by id limit 1", Long.class);
                if (any.isEmpty()) {
                    throw new com.math10.common.exception.BusinessException("Lớp chưa được gán khóa học nào có buổi dạy.");
                }
                deliverySessionId = any.get(0);
            }
        }

        int seq = input.seq() != null ? input.seq() :
                (jdbc.queryForObject("select coalesce(max(seq), 0) + 1 from class_schedule where class_id = ? and deleted_at is null", Integer.class, classId));

        boolean isMakeup = input.isMakeup() != null ? input.isMakeup() : true;

        Long newId = jdbc.queryForObject("""
                insert into class_schedule(class_id, course_delivery_session_id, seq, scheduled_date, start_time, status,
                                           edited_manually, is_makeup, note, created_at, updated_at)
                values (?, ?, ?, ?, ?::time, 'PLANNED', true, ?, ?, now(), now())
                returning id
                """, Long.class,
                classId, deliverySessionId, seq, input.scheduledDate(),
                input.startTime() != null && !input.startTime().isBlank() ? input.startTime() : null,
                isMakeup, input.note());

        return ApiResponse.created("Đã thêm buổi học mới", Map.of("id", newId, "seq", seq));
    }

    /**
     * Xóa một buổi học khỏi lịch của lớp.
     */
    @DeleteMapping("/{scheduleId}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> deleteSession(@PathVariable long classId,
                                           @PathVariable long scheduleId) {
        guard.requireTeacher(classId);
        int deleted = jdbc.update(
                "update class_schedule set deleted_at = now(), updated_at = now() where id = ? and class_id = ? and deleted_at is null",
                scheduleId, classId);
        if (deleted == 0) {
            throw new com.math10.common.exception.ResourceNotFoundException("Không tìm thấy buổi học.");
        }
        return ApiResponse.noContent("Đã xóa buổi học khỏi lịch lớp");
    }

    // ------------------------------------------------------------------
    // Tiến độ
    // ------------------------------------------------------------------

    /**
     * Tiến độ lớp: planned_seq vs actual_seq → ON_TRACK / BEHIND / AHEAD.
     * projected_end_date = MAX(scheduled_date).
     */
    @GetMapping("/progress")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<Map<String, Object>> progress(@PathVariable long classId) {
        guard.requireMember(classId);
        ClassScheduleService.TienDo td = service.tinhTienDo(classId);
        LocalDate end = service.projectedEndDate(classId);
        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("trangThai", td.trangThai());
        result.put("theoKeHoach", td.theoKeHoach());
        result.put("thucTe", td.thucTe());
        result.put("lech", td.lech());
        result.put("tongBuoi", td.tongBuoi());
        result.put("canhBao", td.canhBao());
        result.put("projectedEndDate", end != null ? end.toString() : null);
        return ApiResponse.ok("Tiến độ lớp", result);
    }
}
