package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.programs.dto.TeachingPlanDtos;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Kế hoạch giảng dạy (teaching_plans + teaching_plan_items).
 *
 * <p>Kế hoạch trả lời: "tiết N của chương trình này được bố trí ở tuần mấy, thứ tự nào?"
 * nhưng <b>không chứa ngày tháng</b>. Ngày tháng thuộc về Khóa học triển khai (course_instances).
 *
 * <p>API được thiết kế song song với program_templates hiện có để tương thích ngược.
 * Admin có thể tiếp tục dùng program_templates hoặc chuyển sang teaching_plans — cả hai đều được.
 */
@RestController
@RequiredArgsConstructor
public class TeachingPlanController {

    private final JdbcTemplate jdbc;

    // ------------------------------------------------------------------
    // Danh sách kế hoạch giảng dạy
    // ------------------------------------------------------------------

    @GetMapping("/api/admin/teaching-plans")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String, Object>>> list(
            @RequestParam(required = false) Long courseId) {
        if (courseId != null) {
            return ApiResponse.ok("Kế hoạch giảng dạy theo chương trình",
                    jdbc.queryForList("""
                            select tp.*, c.name course_name,
                                   (select count(*) from teaching_plan_items tpi
                                    where tpi.teaching_plan_id = tp.id and tpi.deleted_at is null) item_count
                            from teaching_plans tp
                            join courses c on c.id = tp.course_id
                            where tp.course_id = ? and tp.deleted_at is null
                            order by tp.name
                            """, courseId));
        }
        return ApiResponse.ok("Tất cả kế hoạch giảng dạy",
                jdbc.queryForList("""
                        select tp.*, c.name course_name,
                               (select count(*) from teaching_plan_items tpi
                                where tpi.teaching_plan_id = tp.id and tpi.deleted_at is null) item_count
                        from teaching_plans tp
                        join courses c on c.id = tp.course_id
                        where tp.deleted_at is null
                        order by c.name, tp.name
                        """));
    }

    @GetMapping("/api/admin/teaching-plans/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Map<String, Object>> get(@PathVariable Long id) {
        return ApiResponse.ok("Kế hoạch giảng dạy", one(id));
    }

    // ------------------------------------------------------------------
    // Tạo / Cập nhật kế hoạch giảng dạy
    // ------------------------------------------------------------------

    @PostMapping("/api/admin/teaching-plans")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Map<String, Object>> create(@RequestBody TeachingPlanDtos.CreatePlanInput x) {
        requireCourse(x.courseId());
        int totalWeeks   = x.totalWeeks()   != null ? x.totalWeeks()   : 35;
        int totalPeriods = x.totalPeriods() != null ? x.totalPeriods() : 105;
        if (totalWeeks < 1)   throw new BusinessException("Số tuần phải >= 1");
        if (totalPeriods < 1) throw new BusinessException("Số tiết phải >= 1");
        String status = x.status() != null ? x.status() : "ACTIVE";

        Long id = jdbc.queryForObject("""
                insert into teaching_plans
                    (course_id, name, description, total_weeks, total_periods, status, created_at, updated_at)
                values (?,?,?,?,?,?,now(),now()) returning id
                """, Long.class,
                x.courseId(), x.name(), x.description(), totalWeeks, totalPeriods, status);
        return ApiResponse.created("Đã tạo kế hoạch giảng dạy", one(id));
    }

    @PutMapping("/api/admin/teaching-plans/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Map<String, Object>> update(@PathVariable Long id,
                                                   @RequestBody TeachingPlanDtos.CreatePlanInput x) {
        one(id); // kiểm tra tồn tại
        jdbc.update("""
                update teaching_plans
                set name=?, description=?, total_weeks=?, total_periods=?, status=?, updated_at=now()
                where id=? and deleted_at is null
                """,
                x.name(), x.description(),
                x.totalWeeks() != null ? x.totalWeeks() : 35,
                x.totalPeriods() != null ? x.totalPeriods() : 105,
                x.status() != null ? x.status() : "ACTIVE", id);
        return ApiResponse.ok("Đã cập nhật kế hoạch giảng dạy", one(id));
    }

    // ------------------------------------------------------------------
    // Danh sách tiết của kế hoạch (teaching_plan_items)
    // ------------------------------------------------------------------

    @GetMapping("/api/admin/teaching-plans/{id}/items")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String, Object>>> items(@PathVariable Long id) {
        one(id);
        return ApiResponse.ok("Tiết của kế hoạch giảng dạy",
                jdbc.queryForList("""
                        select tpi.*,
                               pp.period_no, pp.week_no as period_week_no, pp.title period_title,
                               pp.period_kind, pp.term,
                               ps.name strand_name, ps.code strand_code,
                               l.title lesson_title
                        from teaching_plan_items tpi
                        join program_periods pp on pp.id = tpi.program_period_id
                        join program_strands ps on ps.id = pp.strand_id
                        left join lessons l on l.id = tpi.lesson_id
                        where tpi.teaching_plan_id = ? and tpi.deleted_at is null
                        order by tpi.week_number, tpi.order_in_week
                        """, id));
    }

    /**
     * Cập nhật thứ tự tuần/tiết trong kế hoạch cho một period cụ thể.
     * Thường được gọi khi admin kéo thả hoặc chỉnh tay.
     */
    @PutMapping("/api/admin/teaching-plan-items/{itemId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Map<String, Object>> updateItem(@PathVariable Long itemId,
                                                       @RequestBody TeachingPlanDtos.PlanItemInput x) {
        if (x.weekNumber() < 1) throw new BusinessException("Số tuần phải >= 1");
        if (x.orderInWeek() < 1) throw new BusinessException("Thứ tự trong tuần phải >= 1");
        int updated = jdbc.update("""
                update teaching_plan_items
                set week_number=?, order_in_week=?, updated_at=now()
                where id=? and deleted_at is null
                """, x.weekNumber(), x.orderInWeek(), itemId);
        if (updated == 0) throw new ResourceNotFoundException("Không tìm thấy mục kế hoạch");
        return ApiResponse.ok("Đã cập nhật", jdbc.queryForMap("select * from teaching_plan_items where id=?", itemId));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    private Map<String, Object> one(Long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select * from teaching_plans where id=? and deleted_at is null", id);
        if (rows.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy kế hoạch giảng dạy");
        return rows.get(0);
    }

    private void requireCourse(Long courseId) {
        if (courseId == null) throw new BusinessException("Thiếu courseId");
        Integer n = jdbc.queryForObject(
                "select count(*) from courses where id=? and deleted_at is null", Integer.class, courseId);
        if (n == null || n == 0) throw new ResourceNotFoundException("Không tìm thấy chương trình học");
    }
}
