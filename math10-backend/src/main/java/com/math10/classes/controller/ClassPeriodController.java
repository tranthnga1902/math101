package com.math10.classes.controller;

import com.math10.assignments.entity.ClassPeriodProgress;
import com.math10.assignments.repository.ClassPeriodProgressRepository;
import com.math10.assignments.support.NeoBuoi;
import com.math10.audit.service.AuditService;
import com.math10.classes.service.ClassAccessGuard;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.programs.support.LuongNoiDung;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Buổi học của một lớp: đã dạy tới đâu, và chốt xong thì giao gì.
 *
 * <p>Buổi vẫn không mang ngày. {@code program_periods} nói thứ tự dạy, {@code course_weeks} nói
 * tuần nào, còn ở đây chỉ ghi một sự kiện đã xảy ra: lớp này học xong tiết kia lúc nào. Ba thứ đó
 * tách nhau vì lớp học bù thứ Bảy không được phép đẩy lịch của mọi lớp khác.
 *
 * <p>Chốt buổi là cái nút mà cả luồng giao bài chờ: nó vừa mở những bài đã neo vào tiết ấy, vừa
 * lôi ra danh sách phiếu gắn với tiết để giáo viên giao ngay tại chỗ.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes/{classId}/periods")
@PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
public class ClassPeriodController {

    private final JdbcTemplate jdbc;
    private final ClassAccessGuard guard;
    private final ClassPeriodProgressRepository progress;
    private final CurrentUserService current;
    private final NeoBuoi neoBuoi;
    private final LuongNoiDung luong;
    private final AuditService audit;

    /**
     * Các tiết của chương trình lớp đang chạy, kèm mốc đã chốt.
     *
     * <p>Đi qua {@code class_courses} nên lớp chưa gắn khóa thì trả về rỗng — đúng, chứ không phải
     * trả cả chương trình rồi để màn hình đoán tiết nào là của lớp này.
     */
    @GetMapping
    public ApiResponse<List<Map<String, Object>>> danhSach(@PathVariable Long classId) {
        guard.requireTeacher(classId);
        return ApiResponse.ok("Buổi học của lớp", jdbc.queryForList("""
                select pp.id,pp.period_no,pp.week_no,pp.term,pp.title,pp.period_kind,pp.lesson_id,
                       ps.id strand_id,ps.name strand_name,ps.order_index strand_order,
                       cw.starts_on week_starts_on,cw.ends_on week_ends_on,
                       cpp.closed_at,cpp.note,
                       (select count(*) from assignments a
                         where a.anchor_period_id=pp.id and a.class_id=? and a.deleted_at is null) so_bai_neo
                from class_courses cc
                join course_instances ci on ci.id=cc.course_instance_id and ci.deleted_at is null
                join program_templates pt on pt.id=ci.template_id and pt.deleted_at is null
                join program_strands ps on ps.program_id=pt.program_id and ps.deleted_at is null
                join program_periods pp on pp.strand_id=ps.id and pp.deleted_at is null
                left join course_weeks cw on cw.course_instance_id=ci.id and cw.week_no=pp.week_no and cw.deleted_at is null
                left join class_period_progress cpp on cpp.class_id=cc.class_id and cpp.period_id=pp.id and cpp.deleted_at is null
                where cc.class_id=? and cc.deleted_at is null
                order by pp.week_no,ps.order_index,pp.period_no
                """, classId, classId));
    }

    /**
     * Xem trước hai mốc giờ của một bài nếu neo vào tiết này — chưa ghi gì cả.
     *
     * <p>Gọi thẳng {@link NeoBuoi#tinh}, đúng cái hàm mà lúc lưu sẽ gọi, nên con số giáo viên thấy
     * trong biểu mẫu bằng đúng con số được lưu. Tự tính lại ở màn hình thì nhanh hơn một lượt gọi,
     * đổi lại có hai luật cùng trả lời "hạn là bao giờ" — và hai luật thì sớm muộn lệch nhau mà
     * không có gì báo.
     *
     * <p>{@code hanNop} rỗng kèm {@code lyDoTrong} là câu trả lời hợp lệ: màn hình phải in đúng lý
     * do ấy chứ không được hiện một ngày đoán.
     */
    @GetMapping("/{periodId}/han")
    public ApiResponse<NeoBuoi.Han> han(@PathVariable Long classId, @PathVariable Long periodId,
                                        @RequestParam(required = false) Integer demPhut) {
        guard.requireTeacher(classId);
        if (!thuocLop(classId, periodId)) throw new BusinessException("Tiết này không thuộc chương trình của lớp");
        return ApiResponse.ok("Hạn suy ra từ buổi", neoBuoi.tinh(classId, periodId, demPhut));
    }

    /**
     * Chốt một buổi: ghi mốc, mở bài đã neo, rồi gợi ý phiếu của tiết.
     *
     * <p>Ba việc trong một cửa vì với giáo viên đó là một hành động. Tách ra thì có lúc chốt xong
     * mà quên bấm mở, và bài neo nằm im — không lỗi, không báo, chỉ là học sinh không thấy bài.
     */
    @PostMapping("/{periodId}/close")
    @Transactional
    public ApiResponse<Map<String, Object>> chot(@PathVariable Long classId, @PathVariable Long periodId,
                                                 @RequestBody(required = false) ChotRequest body) {
        guard.requireTeacher(classId);
        if (!thuocLop(classId, periodId)) throw new BusinessException("Tiết này không thuộc chương trình của lớp");
        if (progress.findByClassIdAndPeriodIdAndDeletedAtIsNull(classId, periodId).isPresent())
            throw new BusinessException("Buổi này đã chốt rồi");

        ClassPeriodProgress dong = new ClassPeriodProgress();
        dong.setClassId(classId);
        dong.setPeriodId(periodId);
        // Giờ chốt nhận từ ngoài được: dạy bù tối thứ Bảy mà Chủ nhật mới bấm là chuyện thường, và
        // ghi giờ bấm thay giờ dạy sẽ đẩy giờ mở bài của cả lớp đi một ngày.
        dong.setClosedAt(body == null || body.closedAt() == null ? LocalDateTime.now() : body.closedAt());
        dong.setClosedBy(current.requireUserId());
        dong.setNote(body == null ? null : body.note());
        progress.save(dong);

        int daMo = neoBuoi.dongBoTheoTiet(classId, periodId);
        audit.record("CLOSE", "CLASS_PERIOD", periodId, null, "class=" + classId + " opened=" + daMo);
        return ApiResponse.ok("Đã chốt buổi", Map.of(
                "closedAt", dong.getClosedAt(),
                "assignmentsOpened", daMo,
                "suggestions", goiY(periodId)));
    }

    /** Bỏ chốt: chỉ xoá mốc, không đụng bài đã mở — mở rồi là học sinh đã thấy. */
    @DeleteMapping("/{periodId}/close")
    @Transactional
    public ApiResponse<Void> boChot(@PathVariable Long classId, @PathVariable Long periodId) {
        guard.requireTeacher(classId);
        ClassPeriodProgress dong = progress.findByClassIdAndPeriodIdAndDeletedAtIsNull(classId, periodId)
                .orElseThrow(() -> new BusinessException("Buổi này chưa chốt"));
        dong.markDeleted();
        audit.record("REOPEN", "CLASS_PERIOD", periodId, "class=" + classId, null);
        return ApiResponse.noContent("Đã bỏ chốt buổi");
    }

    /**
     * Phiếu bài tập gắn với bài học của tiết, lọc bằng đúng luật đọc của module phân phối.
     *
     * <p>Dùng lại {@link LuongNoiDung#docDuocDayDu} chứ không viết điều kiện thứ hai: hai luật cùng
     * trả lời "mục này ai đọc được" mà lệch nhau là cách lỗ trước đã sống lâu như vậy.
     */
    private List<Map<String, Object>> goiY(Long periodId) {
        return jdbc.queryForList("""
                select w.id worksheet_id,w.name,pr.id resource_id,l.id lesson_id,l.title lesson_name
                from program_periods pp
                join lessons l on l.id=pp.lesson_id and l.deleted_at is null
                join program_resources pr on pr.lesson_id=l.id and pr.resource_type='EXERCISE'
                """ + LuongNoiDung.NOI_NGUON + """
                where pp.id=? and pp.deleted_at is null and""" + luong.docDuocDayDu("TEACHER") + """
                 order by pr.order_index,pr.id
                """, periodId);
    }

    private boolean thuocLop(Long classId, Long periodId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                select exists(
                  select 1 from class_courses cc
                  join course_instances ci on ci.id=cc.course_instance_id and ci.deleted_at is null
                  join program_templates pt on pt.id=ci.template_id and pt.deleted_at is null
                  join program_strands ps on ps.program_id=pt.program_id and ps.deleted_at is null
                  join program_periods pp on pp.strand_id=ps.id and pp.deleted_at is null
                  where cc.class_id=? and cc.deleted_at is null and pp.id=?)
                """, Boolean.class, classId, periodId));
    }

    /** Giờ dạy thật và ghi chú buổi; cả hai đều bỏ trống được. */
    public record ChotRequest(LocalDateTime closedAt, String note) {}
}
