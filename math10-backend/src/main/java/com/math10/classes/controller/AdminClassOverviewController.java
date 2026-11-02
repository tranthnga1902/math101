package com.math10.classes.controller;

import com.math10.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * Lớp học nhìn từ phía Admin: mỗi lớp một dòng, xoay quanh <b>giáo viên phụ trách</b> —
 * ai đang quản lý lớp nào, lớp đó đã có chương trình học và tài liệu chưa, học sinh nộp bài tới đâu.
 * Gộp hết vào một truy vấn để màn Admin không phải gọi thêm một lượt cho từng lớp.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/class-overview")
@PreAuthorize("hasRole('ADMIN')")
public class AdminClassOverviewController {

    private final JdbcTemplate jdbc;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> overview(@RequestParam(required = false) String search,
                                                           @RequestParam(required = false) Long gradeId,
                                                           @RequestParam(required = false) String status) {
        StringBuilder sql = new StringBuilder("""
                select c.id,c.code,c.name,c.grade_id,c.status,c.description,c.start_date,c.created_at,g.name grade_name,
                       creator.full_name created_by_name,creator.role_code created_by_role,
                       (select string_agg(u.full_name,', ' order by u.full_name)
                          from class_teachers ct join users u on u.id=ct.teacher_id and u.deleted_at is null
                         where ct.class_id=c.id and ct.deleted_at is null) teacher_names,
                       (select count(*) from class_teachers ct where ct.class_id=c.id and ct.deleted_at is null) teacher_count,
                       (select count(*) from class_students cs where cs.class_id=c.id and cs.deleted_at is null) student_count,
                       (select count(*) from class_courses cco where cco.class_id=c.id and cco.deleted_at is null) course_count,
                       (select count(*) from class_curriculum cc where cc.class_id=c.id and cc.deleted_at is null) curriculum_count,
                       (select count(*) from class_documents cd where cd.class_id=c.id and cd.deleted_at is null) document_count,
                       (select count(*) from assignments a where a.class_id=c.id and a.deleted_at is null and a.requirement='BAT_BUOC') required_total,
                       (select count(*) from assignments a where a.class_id=c.id and a.deleted_at is null and a.requirement='TU_CHON') optional_total,
                       (select count(*) from assignment_submission_log l where l.class_id=c.id and l.deleted_at is null and l.action='SUBMITTED') submission_count,
                       (select max(l.created_at) from assignment_submission_log l where l.class_id=c.id and l.deleted_at is null) last_submitted_at
                from classes c
                left join grades g on g.id=c.grade_id
                left join users creator on creator.id=c.created_by
                where c.deleted_at is null
                """);
        List<Object> args = new java.util.ArrayList<>();
        if (search != null && !search.isBlank()) {
            sql.append(" and (lower(c.code) like ? or lower(c.name) like ? or exists(select 1 from class_teachers ct join users u on u.id=ct.teacher_id where ct.class_id=c.id and ct.deleted_at is null and lower(u.full_name) like ?))");
            String pattern = "%" + search.strip().toLowerCase() + "%";
            args.add(pattern);
            args.add(pattern);
            args.add(pattern);
        }
        if (gradeId != null) {
            sql.append(" and c.grade_id=?");
            args.add(gradeId);
        }
        if (status != null && !status.isBlank()) {
            sql.append(" and c.status=?");
            args.add(status);
        }
        sql.append(" order by c.created_at desc");
        return ApiResponse.ok("Tổng quan lớp học", jdbc.queryForList(sql.toString(), args.toArray()));
    }
}
