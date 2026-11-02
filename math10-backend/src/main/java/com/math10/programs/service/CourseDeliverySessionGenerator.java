package com.math10.programs.service;

import com.math10.common.exception.BusinessException;
import com.math10.programs.dto.CourseDeliverySessionDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.ArrayList;

/**
 * Sinh course_delivery_sessions từ program_periods của một course_instance.
 *
 * <p>Course sở hữu cách chia nội dung thành các buổi — không có ngày. Hai lớp cùng
 * course_instance dùng chung bảng này; lịch ngày thực của từng lớp nằm ở class_schedule.
 *
 * <p><strong>units_per_session</strong>: số tiết (program_period) gộp vào một buổi học.
 * Đọc từ {@code course_instances.units_per_session}. Nếu NULL, fallback về
 * {@code course_instances.tiet_moi_tuan} để tương thích ngược với dữ liệu cũ.
 * Nếu cả hai đều NULL, mặc định 1 (mỗi tiết là một buổi riêng).
 *
 * <p><strong>Lưu ý phân biệt</strong>: {@code tiet_moi_tuan} là nhịp dạy tiết/tuần
 * (dùng bởi CourseWeekController để tính số tuần cần dạy), KHÔNG PHẢI units/session.
 * Tuyệt đối không hard-code số này trong code.
 */
@Service
@RequiredArgsConstructor
public class CourseDeliverySessionGenerator {

    private final JdbcTemplate jdbc;

    /**
     * Kết quả sinh buổi học.
     *
     * @param totalSessions  tổng số buổi đã sinh
     * @param warnings       cảnh báo (nếu có — ví dụ: khóa đã có lớp dùng buổi cũ)
     * @param sessions       chi tiết từng buổi kèm tiết bên trong — dùng cho preview lẫn kết quả sinh chính thức
     */
    public record KetQua(
            int totalSessions,
            List<String> warnings,
            List<CourseDeliverySessionDtos.SessionRow> sessions
    ) {}

    /**
     * Xem trước: tính số buổi sẽ sinh mà không ghi vào DB.
     *
     * @param courseInstanceId ID của course_instance
     * @return KetQua với totalSessions và warnings
     */
    public KetQua preview(long courseInstanceId) {
        return doGenerate(courseInstanceId, /* dryRun= */ true);
    }

    /**
     * Sinh chính thức: xóa các buổi GENERATED cũ rồi sinh lại.
     * Buổi có {@code source='MANUAL'} được giữ nguyên.
     *
     * @param courseInstanceId ID của course_instance
     * @return KetQua sau khi ghi xong
     */
    @Transactional
    public KetQua generate(long courseInstanceId) {
        List<String> preWarnings = new ArrayList<>();
        int lopDangDung = demLopDangDungBuoi(courseInstanceId);
        if (lopDangDung > 0) {
            throw new BusinessException("Khóa đang được " + lopDangDung
                    + " lớp sử dụng trong lịch học. Hãy tạo khóa mới để thay đổi cách chia buổi và giữ nguyên lịch sử lớp.");
        }

        // Xóa mềm các tiết thuộc buổi máy sinh cũ trước — nếu không, lần sinh lại sau sẽ
        // đụng unique index (course_instance_id, program_period_id) vì tiết cũ vẫn còn "sống".
        jdbc.update("""
                update course_delivery_session_units
                   set deleted_at = now(), updated_at = now()
                 where course_instance_id = ?
                   and deleted_at is null
                   and course_delivery_session_id in (
                       select id from course_delivery_sessions
                        where course_instance_id = ? and source = 'GENERATED'
                   )
                """, courseInstanceId, courseInstanceId);

        // Xóa mềm các buổi máy sinh cũ (GENERATED), giữ MANUAL
        jdbc.update("""
                update course_delivery_sessions
                   set deleted_at = now(), updated_at = now()
                 where course_instance_id = ?
                   and source = 'GENERATED'
                   and deleted_at is null
                """, courseInstanceId);

        KetQua ketQua = doGenerate(courseInstanceId, /* dryRun= */ false);
        if (preWarnings.isEmpty()) {
            return ketQua;
        }
        List<String> merged = new ArrayList<>(preWarnings);
        merged.addAll(ketQua.warnings());
        return new KetQua(ketQua.totalSessions(), merged, ketQua.sessions());
    }

    /**
     * Đếm số lớp đang có class_schedule trỏ vào buổi hiện tại (chưa xóa) của khóa này.
     * Dùng để cảnh báo trước khi regenerate, tránh âm thầm làm mồ côi lịch của lớp.
     */
    private int demLopDangDungBuoi(long courseInstanceId) {
        Integer count = jdbc.queryForObject("""
                select count(distinct cs.class_id)
                  from class_schedule cs
                  join course_delivery_sessions cds on cds.id = cs.course_delivery_session_id
                 where cds.course_instance_id = ?
                   and cds.deleted_at is null
                   and cs.deleted_at is null
                """, Integer.class, courseInstanceId);
        return count == null ? 0 : count;
    }

    /**
     * Chuyển một tiết (course_delivery_session_unit) sang buổi khác — cân đối thủ công.
     *
     * <p>Chỉ cho phép chuyển vào buổi đích CÙNG MẠCH với tiết đang chuyển — nếu không, thao tác
     * thủ công sẽ tự tay tái tạo đúng lỗi trộn mạch mà {@link #khacMach} đang ngăn khi sinh tự
     * động. Buổi nguồn và buổi đích đều chuyển sang {@code source='MANUAL'} sau khi chuyển, để
     * lần "Sinh lại buổi học" sau không ghi đè chỉnh sửa này. Buổi nguồn hết tiết sau khi chuyển
     * sẽ bị xóa mềm luôn thay vì để lại buổi rỗng.
     *
     * @param courseInstanceId khóa hiện tại — dùng để xác nhận tiết và buổi đích cùng khóa
     * @param unitId           id của course_delivery_session_units cần chuyển
     * @param targetSessionId  id buổi đích
     */
    @Transactional
    public void moveUnit(long courseInstanceId, long unitId, long targetSessionId) {
        if (demLopDangDungBuoi(courseInstanceId) > 0)
            throw new BusinessException("Khóa đã có lịch lớp. Không thể chuyển tiết làm thay đổi nội dung lịch sử.");
        Map<String, Object> unit;
        try {
            unit = jdbc.queryForMap("""
                    select u.course_delivery_session_id source_session_id, u.course_instance_id,
                           pp.strand_id
                      from course_delivery_session_units u
                      join program_periods pp on pp.id = u.program_period_id
                     where u.id = ? and u.deleted_at is null
                    """, unitId);
        } catch (org.springframework.dao.EmptyResultDataAccessException e) {
            throw new BusinessException("Không tìm thấy tiết cần chuyển.");
        }

        long sourceInstanceId = ((Number) unit.get("course_instance_id")).longValue();
        if (sourceInstanceId != courseInstanceId) {
            throw new BusinessException("Tiết không thuộc khóa này.");
        }
        long sourceSessionId = ((Number) unit.get("source_session_id")).longValue();
        if (sourceSessionId == targetSessionId) {
            throw new BusinessException("Tiết đã ở buổi này rồi.");
        }
        Object sourceStrandId = unit.get("strand_id");

        List<Map<String, Object>> target = jdbc.queryForList("""
                select id from course_delivery_sessions
                 where id = ? and course_instance_id = ? and deleted_at is null
                """, targetSessionId, courseInstanceId);
        if (target.isEmpty()) {
            throw new BusinessException("Không tìm thấy buổi đích trong khóa này.");
        }

        List<Map<String, Object>> targetStrandRows = jdbc.queryForList("""
                select pp.strand_id
                  from course_delivery_session_units u
                  join program_periods pp on pp.id = u.program_period_id
                 where u.course_delivery_session_id = ? and u.deleted_at is null
                 limit 1
                """, targetSessionId);
        if (!targetStrandRows.isEmpty()) {
            Object targetStrandId = targetStrandRows.get(0).get("strand_id");
            if (!java.util.Objects.equals(sourceStrandId, targetStrandId)) {
                throw new BusinessException("Không thể chuyển tiết khác mạch vào buổi này — buổi đích thuộc mạch khác.");
            }
        }

        Integer maxOrder = jdbc.queryForObject("""
                select coalesce(max(order_in_session), 0)
                  from course_delivery_session_units
                 where course_delivery_session_id = ? and deleted_at is null
                """, Integer.class, targetSessionId);
        int newOrder = (maxOrder == null ? 0 : maxOrder) + 1;

        jdbc.update("""
                update course_delivery_session_units
                   set course_delivery_session_id = ?, order_in_session = ?, updated_at = now()
                 where id = ?
                """, targetSessionId, newOrder, unitId);

        reindexSession(sourceSessionId);
        recomputeSessionTypeAndSource(sourceSessionId, /* xoaMemNeuRong= */ true);
        recomputeSessionTypeAndSource(targetSessionId, /* xoaMemNeuRong= */ false);
    }

    /**
     * Dồn lại order_in_session 1..N cho các tiết còn sống trong một buổi — không để hở số sau
     * khi một tiết bị chuyển đi. Update tăng dần theo thứ tự cũ để không đụng unique index
     * (course_delivery_session_id, order_in_session).
     */
    private void reindexSession(long sessionId) {
        List<Map<String, Object>> remaining = jdbc.queryForList("""
                select id, order_in_session from course_delivery_session_units
                 where course_delivery_session_id = ? and deleted_at is null
                 order by order_in_session
                """, sessionId);
        int expected = 1;
        for (Map<String, Object> row : remaining) {
            long id = ((Number) row.get("id")).longValue();
            int current = ((Number) row.get("order_in_session")).intValue();
            if (current != expected) {
                jdbc.update("update course_delivery_session_units set order_in_session=?, updated_at=now() where id=?",
                        expected, id);
            }
            expected++;
        }
    }

    /**
     * Sau khi chuyển tiết: tính lại session_type của một buổi từ các tiết còn sống, và đánh dấu
     * MANUAL. Nếu {@code xoaMemNeuRong} và buổi hết sạch tiết → xóa mềm buổi luôn thay vì để lại
     * buổi rỗng (chấp nhận seq có khoảng hở, không renumber các buổi sau).
     */
    private void recomputeSessionTypeAndSource(long sessionId, boolean xoaMemNeuRong) {
        List<Map<String, Object>> units = jdbc.queryForList("""
                select pp.period_kind
                  from course_delivery_session_units u
                  join program_periods pp on pp.id = u.program_period_id
                 where u.course_delivery_session_id = ? and u.deleted_at is null
                """, sessionId);

        if (units.isEmpty()) {
            if (xoaMemNeuRong) {
                jdbc.update("update course_delivery_sessions set deleted_at=now(), updated_at=now() where id=?", sessionId);
            }
            return;
        }

        String sessionType = resolveSessionType(units);
        jdbc.update("""
                update course_delivery_sessions
                   set source = 'MANUAL', session_type = ?, updated_at = now()
                 where id = ?
                """, sessionType, sessionId);
    }

    private static final java.util.Set<String> SESSION_TYPES =
            java.util.Set.of("TEACHING", "REVIEW", "EXAM", "ACTIVITY");

    /**
     * Thêm một buổi trống mới vào khóa — cho phép Admin chèn buổi thủ công sau khi đã sinh
     * (vd. thêm buổi ôn tập, buổi dự phòng...). Buổi mới không có tiết nào nên chưa thuộc mạch
     * nào; mạch sẽ tự khóa lại khi tiết đầu tiên được {@link #moveUnit} vào.
     *
     * @param courseInstanceId khóa hiện tại
     * @param afterSessionId   id buổi neo — buổi mới chèn ngay sau buổi này; null → chèn đầu danh sách
     * @param sessionType      loại buổi (TEACHING/REVIEW/EXAM/ACTIVITY); null/rỗng → mặc định TEACHING
     * @param title            tiêu đề tuỳ chọn
     * @param note             ghi chú tuỳ chọn
     * @return id buổi vừa tạo
     */
    @Transactional
    public long insertSession(long courseInstanceId, Long afterSessionId, String sessionType,
            String title, String note) {
        int newSeq;
        if (afterSessionId == null) {
            newSeq = 1;
        } else {
            List<Map<String, Object>> anchor = jdbc.queryForList("""
                    select seq from course_delivery_sessions
                     where id = ? and course_instance_id = ? and deleted_at is null
                    """, afterSessionId, courseInstanceId);
            if (anchor.isEmpty()) {
                throw new BusinessException("Không tìm thấy buổi neo trong khóa này.");
            }
            newSeq = ((Number) anchor.get(0).get("seq")).intValue() + 1;
        }

        String type = (sessionType == null || sessionType.isBlank()) ? "TEACHING" : sessionType;
        if (!SESSION_TYPES.contains(type)) {
            throw new BusinessException("session_type không hợp lệ. Chỉ chấp nhận: " + SESSION_TYPES);
        }

        // Dồn seq của các buổi từ vị trí chèn trở đi lên 1 — update tuần tự từ seq lớn nhất
        // xuống để không đụng unique index (course_instance_id, seq).
        List<Map<String, Object>> toShift = jdbc.queryForList("""
                select id, seq from course_delivery_sessions
                 where course_instance_id = ? and seq >= ? and deleted_at is null
                 order by seq desc
                """, courseInstanceId, newSeq);
        for (Map<String, Object> row : toShift) {
            long id = ((Number) row.get("id")).longValue();
            int seq = ((Number) row.get("seq")).intValue();
            jdbc.update("update course_delivery_sessions set seq=?, updated_at=now() where id=?", seq + 1, id);
        }

        String titleTrim = (title == null || title.isBlank()) ? null : title.trim();
        String noteTrim = (note == null || note.isBlank()) ? null : note.trim();

        return jdbc.queryForObject("""
                insert into course_delivery_sessions
                    (course_instance_id, seq, session_type, title, note, source, is_continuation, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'MANUAL', false, now(), now())
                returning id
                """, Long.class, courseInstanceId, newSeq, type, titleTrim, noteTrim);
    }

    /**
     * Sửa tiêu đề/ghi chú/loại của một buổi — luôn chuyển buổi sang {@code source='MANUAL'}
     * để lần "Sinh lại buổi học" sau không ghi đè.
     */
    @Transactional
    public void updateSession(long courseInstanceId, long sessionId, String title, String note, String sessionType) {
        List<Map<String, Object>> existing = jdbc.queryForList("""
                select id from course_delivery_sessions
                 where id = ? and course_instance_id = ? and deleted_at is null
                """, sessionId, courseInstanceId);
        if (existing.isEmpty()) {
            throw new BusinessException("Không tìm thấy buổi trong khóa này.");
        }
        if (!SESSION_TYPES.contains(sessionType)) {
            throw new BusinessException("session_type không hợp lệ. Chỉ chấp nhận: " + SESSION_TYPES);
        }

        String titleTrim = (title == null || title.isBlank()) ? null : title.trim();
        String noteTrim = (note == null || note.isBlank()) ? null : note.trim();

        jdbc.update("""
                update course_delivery_sessions
                   set title = ?, note = ?, session_type = ?, source = 'MANUAL', updated_at = now()
                 where id = ?
                """, titleTrim, noteTrim, sessionType, sessionId);
    }

    /**
     * Xóa mềm một buổi. Chặn nếu buổi còn tiết sống (phải chuyển hết tiết đi trước) hoặc nếu
     * còn lớp nào đang tham chiếu buổi này trong class_schedule (FK NOT NULL, không cascade) —
     * xóa trong hai trường hợp đó sẽ để lại lịch mồ côi hoặc vi phạm ràng buộc khóa ngoại.
     * Không renumber các buổi sau — chấp nhận seq có khoảng hở, cùng cách buổi hết tiết trong
     * {@link #moveUnit} đang xử lý.
     */
    @Transactional
    public void deleteSession(long courseInstanceId, long sessionId) {
        List<Map<String, Object>> existing = jdbc.queryForList("""
                select id from course_delivery_sessions
                 where id = ? and course_instance_id = ? and deleted_at is null
                """, sessionId, courseInstanceId);
        if (existing.isEmpty()) {
            throw new BusinessException("Không tìm thấy buổi trong khóa này.");
        }

        Integer unitCount = jdbc.queryForObject("""
                select count(*) from course_delivery_session_units
                 where course_delivery_session_id = ? and deleted_at is null
                """, Integer.class, sessionId);
        if (unitCount != null && unitCount > 0) {
            throw new BusinessException("Buổi còn " + unitCount
                    + " tiết — hãy chuyển hết tiết sang buổi khác trước khi xóa.");
        }

        Integer classCount = jdbc.queryForObject("""
                select count(distinct class_id) from class_schedule
                 where course_delivery_session_id = ? and deleted_at is null
                """, Integer.class, sessionId);
        if (classCount != null && classCount > 0) {
            throw new BusinessException(classCount + " lớp đang dùng buổi này trong lịch — không thể xóa.");
        }

        jdbc.update("update course_delivery_sessions set deleted_at=now(), updated_at=now() where id=?", sessionId);
    }

    // ------------------------------------------------------------------
    // Private helpers
    // ------------------------------------------------------------------

    private KetQua doGenerate(long courseInstanceId, boolean dryRun) {
        List<String> warnings = new ArrayList<>();

        // 1. units_per_session: số tiết gộp vào một buổi học.
        //    Đọc từ units_per_session trước (đúng semantic), fallback về tiet_moi_tuan
        //    để tương thích ngược với dữ liệu cũ, cuối cùng fallback về 1 (không gộp).
        //    NULL cả hai là trạng thái hợp lệ — không phải lỗi.
        Map<String, Object> instanceRow = jdbc.queryForMap("""
                select units_per_session, tiet_moi_tuan from course_instances
                 where id = ? and deleted_at is null
                """, courseInstanceId);

        Integer unitsPerSessionRaw = instanceRow.get("units_per_session") == null
                ? null : ((Number) instanceRow.get("units_per_session")).intValue();
        Integer tietMoiTuanRaw = instanceRow.get("tiet_moi_tuan") == null
                ? null : ((Number) instanceRow.get("tiet_moi_tuan")).intValue();

        int unitsPerSession;
        if (unitsPerSessionRaw != null) {
            unitsPerSession = unitsPerSessionRaw;
        } else if (tietMoiTuanRaw != null) {
            // Tương thích ngược: dữ liệu cũ dùng tiet_moi_tuan làm units_per_session
            unitsPerSession = tietMoiTuanRaw;
            warnings.add("Khóa chưa đặt units_per_session riêng — đang dùng tiet_moi_tuan ("
                    + tietMoiTuanRaw + " tiết/buổi) làm giá trị tạm. "
                    + "Hãy vào tab 'Buổi học' và chọn lại số tiết/buổi để tránh nhầm lẫn với nhịp dạy tuần.");
        } else {
            unitsPerSession = 1;
            warnings.add("Khóa chưa đặt số tiết/buổi (units_per_session) — dùng mặc định 1 tiết/buổi (không gộp).");
        }

        // 1b. split_policy / assessment_policy — cách chia nội dung của khóa.
        //     Cột NOT NULL DEFAULT nên luôn có giá trị; guard null chỉ để phòng dữ liệu lạ.
        Map<String, Object> policyRow = jdbc.queryForMap("""
                select split_policy, assessment_policy from course_instances
                 where id = ? and deleted_at is null
                """, courseInstanceId);
        String splitPolicy = policyRow.get("split_policy") == null
                ? "KEEP_LESSON" : (String) policyRow.get("split_policy");
        String assessmentPolicy = policyRow.get("assessment_policy") == null
                ? "SEPARATE" : (String) policyRow.get("assessment_policy");

        // 2. Tiết chuẩn của chương trình — đọc từ DB theo thứ tự chuẩn, kèm tên bài (lesson)
        //    để buildTitle nối tên bài khi một buổi trải nhiều lesson.
        List<Map<String, Object>> periods = jdbc.queryForList("""
                select pp.id,
                       pp.period_no,
                       pp.week_no,
                       pp.lesson_id,
                       pp.period_kind,
                       pp.title,
                       l.title        lesson_title,
                       pp.strand_id,
                       ps.order_index strand_order,
                       ps.name        strand_name
                  from course_instances ci
                  join program_templates pt  on pt.id = ci.template_id  and pt.deleted_at is null
                  join courses c             on c.id = pt.program_id    and c.deleted_at is null
                  join program_strands ps    on ps.program_id = c.id    and ps.deleted_at is null
                  join program_periods pp    on pp.strand_id = ps.id    and pp.deleted_at is null
                  left join lessons l        on l.id = pp.lesson_id     and l.deleted_at is null
                 where ci.id = ? and ci.deleted_at is null
                   and (not exists(select 1 from program_template_chapters scope
                                    where scope.template_id=pt.id and scope.deleted_at is null)
                        or exists(select 1 from program_template_chapters scope
                                   where scope.template_id=pt.id and scope.chapter_id=l.chapter_id and scope.deleted_at is null))
                 order by pp.week_no, ps.order_index, pp.period_no
                """, courseInstanceId);

        if (periods.isEmpty()) {
            warnings.add("Chương trình của khóa học chưa có tiết nào.");
            return new KetQua(0, warnings, List.of());
        }

        // 3. Gom tiết thành buổi theo policy, rồi tính cờ "tiếp nối buổi trước"
        List<List<Map<String, Object>>> sessions =
                groupPeriods(periods, unitsPerSession, splitPolicy, assessmentPolicy);
        List<Boolean> continuationFlags = computeContinuationFlags(sessions);

        // 4. Ghi (nếu không phải dry-run) và dựng chi tiết trả về cho cả 2 trường hợp
        List<CourseDeliverySessionDtos.SessionRow> rows =
                buildRows(courseInstanceId, sessions, continuationFlags, dryRun);

        return new KetQua(sessions.size(), warnings, rows);
    }

    /**
     * Gom danh sách tiết thành các buổi theo nhịp dạy và {@code splitPolicy}.
     *
     * <p>Quy tắc gom, áp dụng theo thứ tự:
     * <ul>
     *   <li>Đổi mạch (strand_id) → luôn cắt buổi mới ngay, bất kể đã đủ nhịp hay chưa. Các mạch
     *       (Đại số / Hình học / Chuyên đề...) chạy song song theo tuần — xem
     *       V202609020900__mach_va_tiet_cua_chuong_trinh.sql — nên {@code periods} dù đã sắp theo
     *       {@code (week_no, strand.order_index, period_no)} vẫn xen kẽ tiết của nhiều mạch khác
     *       nhau trong cùng một tuần. Một buổi dạy thực tế chỉ thuộc đúng một mạch; không có quy
     *       tắc này, buổi sẽ gộp lẫn ví dụ "Bài tập cuối chương I" (Đại số) với "Bài 6. Hệ thức
     *       lượng" (Hình học) vào chung một buổi.</li>
     *   <li>KIEM_TRA → buổi riêng, trừ khi {@code assessmentPolicy=MERGE} thì gộp như tiết
     *       thường.</li>
     *   <li>Khi buổi hiện tại đã đủ {@code unitsPerSession} tiết, quyết định có cắt buổi hay
     *       không phụ thuộc {@code splitPolicy}:
     *     <ul>
     *       <li>{@code KEEP_LESSON} — không cắt nếu tiết kế tiếp cùng lesson_id với tiết cuối
     *           buổi hiện tại (overflow không giới hạn để giữ nguyên bài).</li>
     *       <li>{@code BALANCED} — chỉ cho overflow đúng 1 tiết, và chỉ khi tiết kế tiếp là
     *           tiết CUỐI CÙNG của lesson đó (tránh để buổi sau chỉ còn đúng 1 tiết mồ côi).
     *           Ngoài trường hợp đó, cắt đúng ranh giới dù đang giữa lesson.</li>
     *       <li>{@code FIXED_CAPACITY} — luôn cắt đúng ranh giới, không bao giờ overflow.</li>
     *     </ul>
     *   </li>
     * </ul>
     */
    private List<List<Map<String, Object>>> groupPeriods(
            List<Map<String, Object>> periods, int unitsPerSession,
            String splitPolicy, String assessmentPolicy) {

        List<List<Map<String, Object>>> sessions = new ArrayList<>();
        List<Map<String, Object>> current = new ArrayList<>();

        for (int idx = 0; idx < periods.size(); idx++) {
            Map<String, Object> period = periods.get(idx);
            String kind = (String) period.get("period_kind");

            if (!current.isEmpty() && khacMach(current, period)) {
                sessions.add(current);
                current = new ArrayList<>();
            }

            boolean tachRieng = "KIEM_TRA".equals(kind) && !"MERGE".equals(assessmentPolicy);
            if (tachRieng) {
                if (!current.isEmpty()) {
                    sessions.add(current);
                    current = new ArrayList<>();
                }
                sessions.add(new ArrayList<>(List.of(period)));
                continue;
            }

            if (current.size() >= unitsPerSession) {
                boolean choOverflow = switch (splitPolicy) {
                    case "FIXED_CAPACITY" -> false;
                    case "BALANCED" -> coTheOverflowCanBang(current, period, periods, idx);
                    default -> cungLesson(current, period); // KEEP_LESSON
                };

                if (!choOverflow) {
                    sessions.add(current);
                    current = new ArrayList<>();
                }
                // Nếu cho overflow → thêm vào buổi hiện tại dù đã đủ nhịp
            }

            current.add(period);
        }

        if (!current.isEmpty()) {
            sessions.add(current);
        }

        return sessions;
    }

    /**
     * true nếu tiết kế tiếp thuộc mạch (strand) khác với tiết cuối cùng của buổi đang gom.
     * Mạch chạy song song theo tuần nên không thể suy ra từ lesson_id — phải so trực tiếp
     * strand_id.
     */
    private boolean khacMach(List<Map<String, Object>> current, Map<String, Object> next) {
        Object lastStrand = current.get(current.size() - 1).get("strand_id");
        Object nextStrand = next.get("strand_id");
        return !java.util.Objects.equals(lastStrand, nextStrand);
    }

    private boolean cungLesson(List<Map<String, Object>> current, Map<String, Object> next) {
        Object lastLesson = current.get(current.size() - 1).get("lesson_id");
        Object nextLesson = next.get("lesson_id");
        return lastLesson != null && lastLesson.equals(nextLesson);
    }

    /**
     * BALANCED: cho overflow đúng 1 tiết nếu tiết kế tiếp là tiết CUỐI CÙNG của lesson hiện tại
     * — tránh để buổi sau chỉ còn đúng 1 tiết mồ côi. Nếu lesson còn nhiều hơn 1 tiết phía sau,
     * cắt đúng ranh giới ngay (chấp nhận chia lesson qua nhiều buổi).
     */
    private boolean coTheOverflowCanBang(
            List<Map<String, Object>> current, Map<String, Object> next,
            List<Map<String, Object>> allPeriods, int nextIdx) {
        if (!cungLesson(current, next)) return false;
        boolean laTietCuoiCuaLesson = nextIdx + 1 >= allPeriods.size()
                || !java.util.Objects.equals(allPeriods.get(nextIdx + 1).get("lesson_id"), next.get("lesson_id"));
        return laTietCuoiCuaLesson;
    }

    /**
     * Cờ "tiếp nối buổi trước": buổi thứ i là true nếu tiết đầu tiên của nó cùng lesson_id
     * với tiết cuối cùng của buổi (i-1) — tức lesson bị cắt qua ranh giới hai buổi.
     * Buổi đầu tiên luôn false.
     */
    private List<Boolean> computeContinuationFlags(List<List<Map<String, Object>>> sessions) {
        List<Boolean> flags = new ArrayList<>();
        for (int i = 0; i < sessions.size(); i++) {
            if (i == 0) {
                flags.add(false);
                continue;
            }
            List<Map<String, Object>> prev = sessions.get(i - 1);
            List<Map<String, Object>> cur = sessions.get(i);
            Object prevLastLesson = prev.get(prev.size() - 1).get("lesson_id");
            Object curFirstLesson = cur.get(0).get("lesson_id");
            flags.add(prevLastLesson != null && prevLastLesson.equals(curFirstLesson));
        }
        return flags;
    }

    /**
     * Dựng chi tiết từng buổi (kèm tiết bên trong) cho preview lẫn kết quả sinh chính thức.
     * Khi {@code dryRun=false}, đồng thời ghi vào DB — id trong SessionRow/UnitRow là id thật.
     * Khi {@code dryRun=true}, không ghi gì — id để null (chưa tồn tại).
     */
    private List<CourseDeliverySessionDtos.SessionRow> buildRows(
            long courseInstanceId,
            List<List<Map<String, Object>>> sessions,
            List<Boolean> continuationFlags,
            boolean dryRun) {

        List<CourseDeliverySessionDtos.SessionRow> rows = new ArrayList<>();

        for (int i = 0; i < sessions.size(); i++) {
            List<Map<String, Object>> units = sessions.get(i);
            int seq = i + 1;
            boolean continuation = continuationFlags.get(i);

            // Phân loại buổi dựa vào nội dung
            String sessionType = resolveSessionType(units);

            // Sinh tiêu đề tự động
            String title = buildTitle(units, seq);

            Long sessionId = null;
            if (!dryRun) {
                sessionId = jdbc.queryForObject("""
                        insert into course_delivery_sessions
                            (course_instance_id, seq, session_type, title, source, is_continuation, created_at, updated_at)
                        values (?, ?, ?, ?, 'GENERATED', ?, now(), now())
                        returning id
                        """, Long.class,
                        courseInstanceId, seq, sessionType, title, continuation);
            }

            List<CourseDeliverySessionDtos.UnitRow> unitRows = new ArrayList<>();
            for (int j = 0; j < units.size(); j++) {
                Map<String, Object> unit = units.get(j);
                long periodId = ((Number) unit.get("id")).longValue();
                int orderInSession = j + 1;

                Long unitId = null;
                if (!dryRun) {
                    unitId = jdbc.queryForObject("""
                            insert into course_delivery_session_units
                                (course_delivery_session_id, course_instance_id, program_period_id,
                                 order_in_session, created_at, updated_at)
                            values (?, ?, ?, ?, now(), now())
                            returning id
                            """, Long.class, sessionId, courseInstanceId, periodId, orderInSession);
                }

                Object lessonId = unit.get("lesson_id");
                unitRows.add(new CourseDeliverySessionDtos.UnitRow(
                        unitId,
                        periodId,
                        orderInSession,
                        ((Number) unit.get("period_no")).intValue(),
                        ((Number) unit.get("week_no")).intValue(),
                        (String) unit.get("title"),
                        (String) unit.get("period_kind"),
                        lessonId != null ? ((Number) lessonId).longValue() : null,
                        (String) unit.get("strand_name")
                ));
            }

            // Buổi đã được đảm bảo chỉ thuộc đúng một mạch (xem khacMach trong groupPeriods),
            // nên lấy strand_name từ tiết đầu tiên là đủ đại diện cho cả buổi.
            String strandName = (String) units.get(0).get("strand_name");

            rows.add(new CourseDeliverySessionDtos.SessionRow(
                    sessionId, courseInstanceId, seq, sessionType, title, null, "GENERATED", continuation, strandName, unitRows));
        }

        return rows;
    }

    /**
     * Phân loại buổi. Buổi chứa BẤT KỲ tiết KIEM_TRA nào → EXAM, kể cả khi
     * {@code assessment_policy=MERGE} gộp chung với tiết khác — bài kiểm tra vẫn phải nổi bật
     * trên UI dù nằm chung buổi. Ngoài ra, buổi 1 tiết theo period_kind của tiết đó;
     * buổi nhiều tiết không kiểm tra mặc định TEACHING.
     */
    private String resolveSessionType(List<Map<String, Object>> units) {
        boolean coKiemTra = units.stream()
                .anyMatch(u -> "KIEM_TRA".equals(u.get("period_kind")));
        if (coKiemTra) return "EXAM";

        if (units.size() == 1) {
            String kind = (String) units.get(0).get("period_kind");
            return switch (kind == null ? "" : kind) {
                case "ON_TAP"    -> "REVIEW";
                case "THUC_HANH" -> "ACTIVITY";
                default          -> "TEACHING";
            };
        }
        return "TEACHING";
    }

    /**
     * Sinh tiêu đề tự động từ tên các lesson có trong buổi (không phải tên tiết):
     * 1 lesson → tên lesson đó; 2 lesson → "A · B"; 3+ lesson → "A · B + N nội dung".
     * Buổi 1 tiết không có lesson (vd tiết ôn tập tự do) fallback về title của tiết.
     */
    private String buildTitle(List<Map<String, Object>> units, int seq) {
        if (units.isEmpty()) return "Buổi " + seq;

        if (units.size() == 1) {
            Object lessonTitle = units.get(0).get("lesson_title");
            if (lessonTitle != null) return (String) lessonTitle;
            Object title = units.get(0).get("title");
            return title != null ? (String) title : "Buổi " + seq;
        }

        java.util.LinkedHashSet<String> lessonTitles = new java.util.LinkedHashSet<>();
        for (Map<String, Object> unit : units) {
            Object lessonTitle = unit.get("lesson_title");
            if (lessonTitle != null) lessonTitles.add((String) lessonTitle);
        }

        if (lessonTitles.isEmpty()) return "Buổi " + seq;
        if (lessonTitles.size() == 1) return lessonTitles.iterator().next();

        java.util.Iterator<String> it = lessonTitles.iterator();
        String first = it.next();
        String second = it.next();
        if (lessonTitles.size() == 2) return first + " · " + second;
        return first + " · " + second + " + " + (lessonTitles.size() - 2) + " nội dung";
    }
}
