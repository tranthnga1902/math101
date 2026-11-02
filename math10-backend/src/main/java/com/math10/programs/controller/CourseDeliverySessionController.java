package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.programs.dto.CourseDeliverySessionDtos;
import com.math10.programs.service.CourseDeliverySessionGenerator;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * API quản lý course_delivery_sessions — buổi học của Khóa (không có ngày).
 *
 * <p>Đây là tầng Course trong mô hình 3 tầng Program → Course → Class.
 * Lịch ngày thực nằm ở ClassScheduleController.
 *
 * <p>Khi sinh buổi, Admin có thể truyền {@code unitsPerSession} (số tiết/buổi).
 * Giá trị này được lưu vào {@code course_instances.units_per_session} trước khi
 * sinh, để các lần sinh lại sau không cần nhập lại.
 *
 * <p><strong>Phân biệt</strong>: {@code units_per_session} (số tiết gộp vào một
 * buổi học) KHÁC với {@code tiet_moi_tuan} (số tiết/tuần — nhịp dạy theo lịch tuần).
 */
@RestController
@RequestMapping("/api/admin/course-instances/{courseInstanceId}/delivery-sessions")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class CourseDeliverySessionController {

    private final JdbcTemplate jdbc;
    private final CourseDeliverySessionGenerator generator;

    @GetMapping("/classes")
    public ApiResponse<List<Map<String, Object>>> classes(@PathVariable long courseInstanceId) {
        return ApiResponse.ok("Lớp sử dụng khóa", jdbc.queryForList("""
                select c.id, c.name, c.code, c.status, c.start_date,
                       (select count(*) from class_students s where s.class_id=c.id and s.deleted_at is null) student_count
                  from class_courses cc join classes c on c.id=cc.class_id and c.deleted_at is null
                 where cc.course_instance_id=? and cc.deleted_at is null order by c.name
                """, courseInstanceId));
    }



    /** Request body tuỳ chọn cho preview/generate — có thể null hoàn toàn. */
    public record GenerateRequest(Integer unitsPerSession, String splitPolicy, String assessmentPolicy) {}

    private static final java.util.Set<String> SPLIT_POLICIES = java.util.Set.of("KEEP_LESSON", "BALANCED", "FIXED_CAPACITY");
    private static final java.util.Set<String> ASSESSMENT_POLICIES = java.util.Set.of("SEPARATE", "MERGE");

    /**
     * Danh sách buổi học đã sinh của khóa, kèm thông tin cấu hình hiện tại.
     * Trả về: sessions[], unitsPerSession (cấu hình hiện tại), tietMoiTuan (nhịp tuần).
     */
    @GetMapping
    public ApiResponse<Map<String, Object>> danhSach(
            @PathVariable long courseInstanceId) {

        // strand_name: một buổi chỉ thuộc đúng một mạch (xem khacMach trong
        // CourseDeliverySessionGenerator), nên lấy mạch của tiết đầu tiên (order_in_session=1)
        // là đại diện đúng cho cả buổi.
        List<Map<String, Object>> sessions = jdbc.queryForList("""
                select cds.id,
                       cds.course_instance_id,
                       cds.seq,
                       cds.session_type,
                       cds.title,
                       cds.note,
                       cds.source,
                       cds.is_continuation,
                       (select count(*) from course_delivery_session_units u
                         where u.course_delivery_session_id = cds.id
                           and u.deleted_at is null) unit_count,
                       (select ps.name
                          from course_delivery_session_units u
                          join program_periods pp on pp.id = u.program_period_id
                          join program_strands ps on ps.id = pp.strand_id
                         where u.course_delivery_session_id = cds.id
                           and u.deleted_at is null
                         order by u.order_in_session
                         limit 1) strand_name
                  from course_delivery_sessions cds
                 where cds.course_instance_id = ?
                   and cds.deleted_at is null
                 order by cds.seq
                """, courseInstanceId);

        // Trả kèm cấu hình hiện tại để UI hiển thị số tiết/buổi + chính sách đã chọn
        Map<String, Object> config = jdbc.queryForMap("""
                select units_per_session, tiet_moi_tuan, split_policy, assessment_policy
                  from course_instances
                 where id = ? and deleted_at is null
                """, courseInstanceId);

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("sessions", sessions);
        result.put("unitsPerSession", config.get("units_per_session"));
        result.put("tietMoiTuan", config.get("tiet_moi_tuan"));
        result.put("splitPolicy", config.get("split_policy"));
        result.put("assessmentPolicy", config.get("assessment_policy"));
        return ApiResponse.ok("Buổi học của khóa", result);
    }

    /**
     * Xem trước số buổi sẽ sinh (không ghi DB).
     * Nếu truyền {@code unitsPerSession}, lưu vào DB trước để preview phản ánh đúng.
     */
    @PostMapping("/preview")
    @org.springframework.transaction.annotation.Transactional
    public ApiResponse<CourseDeliverySessionDtos.GenerateResult> preview(
            @PathVariable long courseInstanceId,
            @RequestBody(required = false) GenerateRequest req) {

        luuCauHinh(courseInstanceId, req);

        CourseDeliverySessionGenerator.KetQua kq = generator.preview(courseInstanceId);
        org.springframework.transaction.interceptor.TransactionAspectSupport.currentTransactionStatus().setRollbackOnly();
        return ApiResponse.ok("Xem trước",
                new CourseDeliverySessionDtos.GenerateResult(
                        kq.totalSessions(), true, kq.warnings(), kq.sessions()));
    }

    /**
     * Sinh chính thức. Xóa mềm các buổi GENERATED cũ rồi sinh lại.
     * Buổi MANUAL được giữ nguyên.
     * Nếu truyền {@code unitsPerSession}, lưu vào DB trước khi sinh.
     */
    @PostMapping("/generate")
    @org.springframework.transaction.annotation.Transactional
    public ApiResponse<CourseDeliverySessionDtos.GenerateResult> generate(
            @PathVariable long courseInstanceId,
            @RequestBody(required = false) GenerateRequest req) {

        luuCauHinh(courseInstanceId, req);

        CourseDeliverySessionGenerator.KetQua kq = generator.generate(courseInstanceId);
        return ApiResponse.ok("Đã sinh " + kq.totalSessions() + " buổi",
                new CourseDeliverySessionDtos.GenerateResult(
                        kq.totalSessions(), false, kq.warnings(), kq.sessions()));
    }

    /**
     * Chi tiết một buổi kèm danh sách tiết.
     */
    @GetMapping("/{sessionId}")
    public ApiResponse<Map<String, Object>> chiTiet(
            @PathVariable long courseInstanceId,
            @PathVariable long sessionId) {

        Map<String, Object> session = jdbc.queryForMap("""
                select cds.id, cds.seq, cds.session_type, cds.title, cds.note, cds.source, cds.is_continuation
                  from course_delivery_sessions cds
                 where cds.id = ? and cds.course_instance_id = ? and cds.deleted_at is null
                """, sessionId, courseInstanceId);

        List<Map<String, Object>> units = jdbc.queryForList("""
                select u.id, u.program_period_id, u.order_in_session,
                       pp.period_no, pp.week_no, pp.title, pp.period_kind, pp.lesson_id,
                       ps.name strand_name
                  from course_delivery_session_units u
                  join program_periods pp on pp.id = u.program_period_id
                  join program_strands ps on ps.id = pp.strand_id
                 where u.course_delivery_session_id = ?
                   and u.deleted_at is null
                 order by u.order_in_session
                """, sessionId);

        session.put("units", units);
        return ApiResponse.ok("Chi tiết buổi", session);
    }

    /** Request body cho thêm buổi mới. */
    public record InsertSessionRequest(Long afterSessionId, String sessionType, String title, String note) {}

    /** Request body cho sửa buổi. */
    public record UpdateSessionRequest(String title, String note, String sessionType) {}

    /**
     * Thêm một buổi trống mới vào khóa — chèn sau {@code afterSessionId} (null → đầu danh sách).
     * Buổi mới chưa có tiết nên chưa thuộc mạch nào; mạch tự khóa lại khi tiết đầu tiên được
     * chuyển vào (xem {@link CourseDeliverySessionGenerator#moveUnit}).
     */
    @PostMapping
    public ApiResponse<Map<String, Object>> themBuoi(
            @PathVariable long courseInstanceId,
            @RequestBody(required = false) InsertSessionRequest req) {

        long id = generator.insertSession(courseInstanceId,
                req != null ? req.afterSessionId() : null,
                req != null ? req.sessionType() : null,
                req != null ? req.title() : null,
                req != null ? req.note() : null);

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("id", id);
        return ApiResponse.created("Đã thêm buổi mới", result);
    }

    /** Sửa tiêu đề/ghi chú/loại của một buổi — tự chuyển sang source='MANUAL'. */
    @PatchMapping("/{sessionId}")
    public ApiResponse<Void> suaBuoi(
            @PathVariable long courseInstanceId,
            @PathVariable long sessionId,
            @RequestBody UpdateSessionRequest req) {

        generator.updateSession(courseInstanceId, sessionId, req.title(), req.note(), req.sessionType());
        return ApiResponse.ok("Đã cập nhật buổi", null);
    }

    /**
     * Xóa mềm một buổi — chặn nếu buổi còn tiết hoặc còn lớp nào đang dùng trong lịch
     * (xem {@link CourseDeliverySessionGenerator#deleteSession}).
     */
    @DeleteMapping("/{sessionId}")
    public ApiResponse<Void> xoaBuoi(
            @PathVariable long courseInstanceId,
            @PathVariable long sessionId) {

        generator.deleteSession(courseInstanceId, sessionId);
        return ApiResponse.noContent("Đã xóa buổi");
    }

    /** Request body cho chuyển tiết sang buổi khác. */
    public record MoveUnitRequest(long targetSessionId) {}

    /**
     * Chuyển một tiết sang buổi khác trong cùng khóa — cân đối thủ công.
     * Chỉ cho phép nếu buổi đích cùng mạch với tiết đang chuyển (xem
     * {@link CourseDeliverySessionGenerator#moveUnit}).
     */
    @PostMapping("/units/{unitId}/move")
    public ApiResponse<Void> chuyenTiet(
            @PathVariable long courseInstanceId,
            @PathVariable long unitId,
            @RequestBody MoveUnitRequest req) {

        generator.moveUnit(courseInstanceId, unitId, req.targetSessionId());
        return ApiResponse.ok("Đã chuyển tiết sang buổi khác", null);
    }

    private void validateUnitsPerSession(int value) {
        if (value < 1 || value > 20) {
            throw new BusinessException("Số tiết/buổi (units_per_session) phải nằm trong khoảng 1–20.");
        }
    }

    private void validateSplitPolicy(String value) {
        if (!SPLIT_POLICIES.contains(value)) {
            throw new BusinessException("split_policy không hợp lệ. Chỉ chấp nhận: " + SPLIT_POLICIES);
        }
    }

    private void validateAssessmentPolicy(String value) {
        if (!ASSESSMENT_POLICIES.contains(value)) {
            throw new BusinessException("assessment_policy không hợp lệ. Chỉ chấp nhận: " + ASSESSMENT_POLICIES);
        }
    }

    /**
     * Lưu cấu hình (nếu Admin truyền lên) vào course_instances trước khi preview/generate,
     * để lần sinh lại sau không cần nhập lại. Field nào null trong request thì giữ nguyên giá
     * trị cũ trong DB — không ghi đè bằng null.
     */
    private void luuCauHinh(long courseInstanceId, GenerateRequest req) {
        if (req == null) return;

        if (req.unitsPerSession() != null) {
            validateUnitsPerSession(req.unitsPerSession());
            jdbc.update("update course_instances set units_per_session=?, updated_at=now() where id=? and deleted_at is null",
                    req.unitsPerSession(), courseInstanceId);
        }
        if (req.splitPolicy() != null) {
            validateSplitPolicy(req.splitPolicy());
            jdbc.update("update course_instances set split_policy=?, updated_at=now() where id=? and deleted_at is null",
                    req.splitPolicy(), courseInstanceId);
        }
        if (req.assessmentPolicy() != null) {
            validateAssessmentPolicy(req.assessmentPolicy());
            jdbc.update("update course_instances set assessment_policy=?, updated_at=now() where id=? and deleted_at is null",
                    req.assessmentPolicy(), courseInstanceId);
        }
    }
}
