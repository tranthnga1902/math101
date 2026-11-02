package com.math10.classes.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.*;

/**
 * Sinh class_schedule — lịch ngày thực của Lớp.
 *
 * <p><b>Mô hình 3 tầng:</b> Class sở hữu toàn bộ lịch thực tế. Hai lớp cùng
 * course_instance có class_schedule hoàn toàn khác nhau.
 *
 * <p><b>Input (toàn bộ đọc từ DB, không hard-code):</b>
 * <ul>
 *   <li>{@code classes.start_date} — ngày khai giảng</li>
 *   <li>{@code class_schedule_slots} — lịch tuần: thứ + giờ + số tiết</li>
 *   <li>{@code course_delivery_sessions} — buổi học của khóa theo seq</li>
 *   <li>{@code academic_breaks} — kỳ nghỉ của khóa</li>
 *   <li>{@code holidays} — ngày lễ system-wide</li>
 * </ul>
 *
 * <p><b>Bảo toàn edited_manually:</b> Khi regenerate, các dòng
 * {@code edited_manually=true} không bị ghi đè; session tương ứng được giữ nguyên.
 */
@Service
@RequiredArgsConstructor
public class ClassScheduleGenerator {

    private final JdbcTemplate jdbc;

    /** Kết quả sinh lịch. */
    public record KetQua(
            int totalScheduled,
            LocalDate projectedEndDate,
            int keptManual,
            List<String> warnings
    ) {}

    /** Xem trước: tính mà không ghi DB. */
    public KetQua preview(long classId) {
        return doGenerate(classId, /* dryRun= */ true);
    }

    /**
     * Sinh chính thức. Xóa các dòng PLANNED (không edited_manually) rồi sinh lại.
     * Dòng edited_manually=true hoặc status=COMPLETED/POSTPONED được giữ nguyên.
     */
    @Transactional
    public KetQua generate(long classId) {
        // Validate before replacing any rows. Preview and write use the same retained rows.
        KetQua checked = preview(classId);
        if (!checked.warnings().isEmpty()) {
            throw new com.math10.common.exception.BusinessException(String.join(" ", checked.warnings()));
        }
        // Xóa mềm các dòng PLANNED chưa chỉnh tay
        jdbc.update("""
                update class_schedule
                   set deleted_at = now(), updated_at = now()
                 where class_id = ?
                   and status = 'PLANNED'
                   and edited_manually = false
                   and is_makeup = false
                   and deleted_at is null
                """, classId);

        return doGenerate(classId, /* dryRun= */ false);
    }

    // ------------------------------------------------------------------
    // Core algorithm
    // ------------------------------------------------------------------

    private KetQua doGenerate(long classId, boolean dryRun) {
        List<String> warnings = new ArrayList<>();

        // 1. Ngày bắt đầu — đọc từ DB
        LocalDate startDate = jdbc.queryForObject("""
                select start_date from classes where id = ? and deleted_at is null
                """, LocalDate.class, classId);

        if (startDate == null) {
            warnings.add("Lớp chưa có ngày khai giảng (start_date). Không thể sinh lịch.");
            return new KetQua(0, null, 0, warnings);
        }

        // 2. course_instance_id qua class_courses
        List<Long> courses = jdbc.queryForList("""
                select course_instance_id from class_courses
                 where class_id = ? and deleted_at is null order by created_at, id
                """, Long.class, classId);
        if (courses.size() > 1) {
            warnings.add("Lớp đang gán nhiều khóa. Chỉ giữ một khóa triển khai trước khi sinh lịch.");
            return new KetQua(0, null, 0, warnings);
        }
        Long courseInstanceId = courses.isEmpty() ? null : courses.get(0);
        if (courseInstanceId == null) {
            warnings.add("Lớp chưa gắn vào khóa học nào.");
            return new KetQua(0, null, 0, warnings);
        }

        // 3. Lịch tuần — đọc từ class_schedule_slots, không hard-code thứ
        //    day_of_week: int 1=Thứ Hai … 7=Chủ nhật (ISO)
        List<Map<String, Object>> slots = jdbc.queryForList("""
                select day_of_week, start_time, periods
                  from class_schedule_slots
                 where class_id = ?
                 order by day_of_week, start_time
                """, classId);

        if (slots.isEmpty()) {
            warnings.add("Lớp chưa có lịch học trong tuần (class_schedule_slots).");
            return new KetQua(0, null, 0, warnings);
        }

        // Map: ISO day value (1=Mon..7=Sun) → slot
        Map<Integer, Map<String, Object>> slotByDow = new LinkedHashMap<>();
        for (Map<String, Object> slot : slots) {
            slotByDow.putIfAbsent(((Number) slot.get("day_of_week")).intValue(), slot);
        }

        // 4. Buổi học cần xếp (course_delivery_sessions)
        List<Map<String, Object>> sessions = jdbc.queryForList("""
                select id, seq, session_type, title
                  from course_delivery_sessions
                 where course_instance_id = ? and deleted_at is null
                 order by seq
                """, courseInstanceId);

        if (sessions.isEmpty()) {
            warnings.add("Khóa học chưa sinh buổi học. Vui lòng chạy 'Sinh buổi' trước.");
            return new KetQua(0, null, 0, warnings);
        }

        // 5. Tập ngày đã giữ lại (edited_manually)
        Set<Long> keptSessionIds = new HashSet<>();
        List<Map<String, Object>> retained = jdbc.queryForList("""
                select course_delivery_session_id, scheduled_date, start_time from class_schedule
                 where class_id=? and deleted_at is null
                   and (edited_manually=true or status <> 'PLANNED' or is_makeup=true)
                """, classId);
        Map<Long, LocalDate> keptDates = new HashMap<>();
        Set<String> occupied = new HashSet<>();
        for (Map<String, Object> row : retained) {
            long id = ((Number) row.get("course_delivery_session_id")).longValue();
            LocalDate date = ((java.sql.Date) row.get("scheduled_date")).toLocalDate();
            keptSessionIds.add(id);
            keptDates.put(id, date);
            occupied.add(date + "#" + row.get("start_time"));
        }

        // 6. Tải ngày nghỉ vào Set<LocalDate> — không hard-code ngày nào
        Set<LocalDate> offDays = loadOffDays(courseInstanceId, classId);

        // 7. Sinh lịch
        LocalDate currentDate = startDate;
        int scheduled = 0;
        LocalDate lastDate = keptDates.values().stream().max(LocalDate::compareTo).orElse(null);

        for (Map<String, Object> session : sessions) {
            long sessionId = ((Number) session.get("id")).longValue();
            int seq = ((Number) session.get("seq")).intValue();

            if (keptSessionIds.contains(sessionId)) {
                LocalDate keptDate = keptDates.get(sessionId);
                if (keptDate.isAfter(currentDate)) currentDate = keptDate;
                continue; // giữ nguyên
            }

            // Tìm ngày hợp lệ tiếp theo
            LocalDate assignDate = nextValidDate(currentDate, slotByDow, offDays);
            Map<String, Object> slot = null;
            for (int attempts = 0; attempts < 3660 && slot == null; attempts++) {
                for (Map<String, Object> candidate : slots) {
                    if (((Number) candidate.get("day_of_week")).intValue() == assignDate.getDayOfWeek().getValue()
                            && !occupied.contains(assignDate + "#" + candidate.get("start_time"))) {
                        slot = candidate;
                        break;
                    }
                }
                if (slot == null) assignDate = nextValidDate(assignDate.plusDays(1), slotByDow, offDays);
            }
            if (slot == null) throw new IllegalStateException("Không tìm được giờ học còn trống.");
            occupied.add(assignDate + "#" + slot.get("start_time"));

            if (!dryRun) {
                Object startTime = slot.get("start_time");
                jdbc.update("""
                        insert into class_schedule
                            (class_id, course_delivery_session_id, seq, scheduled_date,
                             start_time, status, edited_manually, is_makeup,
                             created_at, updated_at)
                        values (?, ?, ?, ?, ?, 'PLANNED', false, false, now(), now())
                        """,
                        classId, sessionId, seq, assignDate,
                        startTime);
            }

            scheduled++;
            if (lastDate == null || assignDate.isAfter(lastDate)) lastDate = assignDate;
            currentDate = assignDate;
        }

        int keptCount = keptSessionIds.size();
        return new KetQua(scheduled + keptCount, lastDate, keptCount, warnings);
    }

    /**
     * Tìm ngày hợp lệ tiếp theo từ {@code from}:
     * phải có slot lịch tuần VÀ không phải ngày nghỉ.
     */
    private LocalDate nextValidDate(LocalDate from,
                                    Map<Integer, Map<String, Object>> slotByDow,
                                    Set<LocalDate> offDays) {
        LocalDate d = from;
        for (int limit = 0; limit < 365; limit++) {
            int dow = d.getDayOfWeek().getValue(); // 1=Mon..7=Sun
            if (slotByDow.containsKey(dow) && !offDays.contains(d)) {
                return d;
            }
            d = d.plusDays(1);
        }
        throw new IllegalStateException(
                "Không tìm được ngày học hợp lệ trong vòng 365 ngày kể từ " + from);
    }

    /**
     * Tải tất cả ngày nghỉ vào Set — đọc từ 2 bảng:
     * {@code holidays} (system-wide) và {@code academic_breaks} (per khóa).
     * Mở rộng range ngày thành từng ngày riêng lẻ.
     */
    private Set<LocalDate> loadOffDays(long courseInstanceId, long classId) {
        Set<LocalDate> off = new HashSet<>();

        // System-wide holidays
        List<LocalDate> holidays = jdbc.queryForList("""
                select holiday_date from holidays where is_day_off = true
                """, LocalDate.class);
        off.addAll(holidays);

        // Kỳ nghỉ của khóa
        List<Map<String, Object>> breaks = jdbc.queryForList("""
                select starts_on, ends_on from academic_breaks
                 where course_instance_id = ? and deleted_at is null
                union all
                select starts_on, ends_on from class_days_off where class_id=?
                """, courseInstanceId, classId);

        for (Map<String, Object> b : breaks) {
            LocalDate s = ((java.sql.Date) b.get("starts_on")).toLocalDate();
            LocalDate e = ((java.sql.Date) b.get("ends_on")).toLocalDate();
            LocalDate d = s;
            while (!d.isAfter(e)) {
                off.add(d);
                d = d.plusDays(1);
            }
        }

        return off;
    }
}
