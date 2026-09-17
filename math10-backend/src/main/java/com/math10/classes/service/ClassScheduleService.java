package com.math10.classes.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;

/**
 * Orchestrator cho các thao tác trên class_schedule:
 * complete, postpone, tính tiến độ (ON_TRACK / BEHIND / AHEAD).
 *
 * <p>Tất cả số liệu (planned_seq, actual_seq) đều tính từ DB.
 * Không hard-code bất kỳ ngưỡng hay con số nghiệp vụ nào.
 */
@Service
@RequiredArgsConstructor
public class ClassScheduleService {

    private final JdbcTemplate jdbc;

    // ------------------------------------------------------------------
    // Complete
    // ------------------------------------------------------------------

    /**
     * Giáo viên xác nhận hoàn thành một buổi.
     * Ngày đã qua nhưng chưa bấm vẫn là PLANNED — không tự thành COMPLETED.
     */
    @Transactional
    public void complete(long classId, long scheduleId, long teacherId) {
        int affected = jdbc.update("""
                update class_schedule
                   set status           = 'COMPLETED',
                       completed_at     = now(),
                       completed_source = 'TEACHER_ACTION',
                       taught_by        = ?,
                       updated_at       = now()
                 where id = ?
                   and class_id = ?
                   and status in ('PLANNED', 'POSTPONED')
                   and deleted_at is null
                """, teacherId, scheduleId, classId);

        if (affected == 0) {
            throw new com.math10.common.exception.BusinessException(
                    "Buổi không tồn tại, không thuộc lớp này, hoặc đã không còn ở trạng thái PLANNED.");
        }
    }

    // ------------------------------------------------------------------
    // Postpone
    // ------------------------------------------------------------------

    /** Hoãn một buổi học. */
    @Transactional
    public void postpone(long classId, long scheduleId, String note) {
        int affected = jdbc.update("""
                update class_schedule
                   set status     = 'POSTPONED',
                       note       = coalesce(?, note),
                       updated_at = now()
                 where id = ?
                   and class_id = ?
                   and status   = 'PLANNED'
                   and deleted_at is null
                """, note, scheduleId, classId);

        if (affected == 0) {
            throw new com.math10.common.exception.BusinessException(
                    "Buổi không tồn tại, không thuộc lớp này, hoặc không thể hoãn.");
        }
    }

    // ------------------------------------------------------------------
    // Progress
    // ------------------------------------------------------------------

    /**
     * Tính tiến độ lớp.
     *
     * <p>{@code planned_seq} = seq lớn nhất có scheduled_date ≤ hôm nay.<br>
     * {@code actual_seq} = seq lớn nhất có status = COMPLETED.<br>
     * {@code delta} = actual - planned: âm → BEHIND, dương → AHEAD, 0 → ON_TRACK.
     */
    public TienDo tinhTienDo(long classId) {
        LocalDate today = LocalDate.now(java.time.ZoneId.of("Asia/Ho_Chi_Minh"));

        // Count distinct sessions due; a makeup must not inflate progress.
        Integer plannedSeq = jdbc.queryForObject("""
                select count(distinct course_delivery_session_id) from class_schedule
                 where class_id = ?
                   and scheduled_date <= ?
                   and status <> 'CANCELLED'
                   and deleted_at is null
                """, Integer.class, classId, today);

        // Only explicitly completed sessions count, even when taught out of order.
        Integer actualSeq = jdbc.queryForObject("""
                select count(distinct course_delivery_session_id) from class_schedule
                 where class_id = ?
                   and status = 'COMPLETED'
                   and deleted_at is null
                """, Integer.class, classId);

        // Tổng số buổi của khóa
        Integer totalSessions = jdbc.queryForObject("""
                select count(distinct cds.id)
                  from class_schedule cs
                  join course_delivery_sessions cds
                    on cds.id = cs.course_delivery_session_id
                 where cs.class_id = ?
                   and cs.deleted_at is null
                """, Integer.class, classId);

        int planned = plannedSeq != null ? plannedSeq : 0;
        int actual  = actualSeq  != null ? actualSeq  : 0;
        int total   = totalSessions != null ? totalSessions : 0;

        int delta = actual - planned;
        String trangThai = delta == 0 ? "ON_TRACK" : (delta < 0 ? "BEHIND" : "AHEAD");

        return new TienDo(trangThai, planned, actual, delta, total,
                delta < 0); // canhBao = true khi BEHIND
    }

    /** Tiến độ lớp. */
    public record TienDo(
            String trangThai,       // ON_TRACK | BEHIND | AHEAD
            int theoKeHoach,        // planned_seq
            int thucTe,             // actual_seq
            int lech,               // actual - planned (signed)
            int tongBuoi,           // tổng buổi trong khóa
            boolean canhBao         // true khi BEHIND
    ) {}

    /**
     * projected_end_date = MAX(scheduled_date) của lớp.
     * Tính động sau khi sinh lịch.
     */
    public LocalDate projectedEndDate(long classId) {
        return jdbc.queryForObject("""
                select max(scheduled_date) from class_schedule
                 where class_id = ? and deleted_at is null
                """, LocalDate.class, classId);
    }
}
