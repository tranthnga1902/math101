package com.math10.classes.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import com.math10.classes.service.ClassAccessGuard;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Lớp học nhìn từ phía học sinh: chỉ những lớp em đó được thêm vào, và trong mỗi lớp
 * chỉ dữ liệu của chính em đó. Chương trình học và tài liệu dùng chung endpoint với
 * giáo viên ({@link ClassContentController}) vì ai là thành viên lớp cũng xem được.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/student/classes")
@PreAuthorize("hasRole('STUDENT')")
public class StudentClassController {

    private final JdbcTemplate jdbc;
    private final ClassAccessGuard guard;
    private final CurrentUserService current;

    /**
     * Danh sách lớp của em, kèm tiến độ của chính em. Bắt buộc và tự chọn tách hai cột
     * theo đúng cách chấm đã chốt: bắt buộc ra điểm, tự chọn chỉ đo mức tự giác.
     */
    @GetMapping
    public ApiResponse<List<Map<String, Object>>> myClasses() {
        Long studentId = current.requireUserId();
        return ApiResponse.ok("Lớp của tôi", jdbc.queryForList("""
                select c.id,c.code,c.name,c.status,c.description,g.name grade_name,
                       (select string_agg(u.full_name,', ' order by u.full_name)
                          from class_teachers ct join users u on u.id=ct.teacher_id and u.deleted_at is null
                         where ct.class_id=c.id and ct.deleted_at is null) teacher_names,
                       (select count(*) from class_students cs2 where cs2.class_id=c.id and cs2.deleted_at is null) student_count,
                       (select count(*) from class_curriculum cc where cc.class_id=c.id and cc.deleted_at is null) curriculum_count,
                       (select count(*) from class_documents cd where cd.class_id=c.id and cd.deleted_at is null) document_count,
                       count(a.id) filter (where a.requirement='BAT_BUOC') required_total,
                       count(a.id) filter (where a.requirement='BAT_BUOC' and ap.submitted_at is not null) required_submitted,
                       round(avg(ap.score) filter (where a.requirement='BAT_BUOC' and ap.returned_at is not null),2) required_avg_score,
                       count(a.id) filter (where a.requirement='TU_CHON') optional_total,
                       count(a.id) filter (where a.requirement='TU_CHON' and ap.submitted_at is not null) optional_submitted
                from class_students cs
                join classes c on c.id=cs.class_id and c.deleted_at is null
                left join grades g on g.id=c.grade_id
                left join assignments a on a.class_id=c.id and a.deleted_at is null and a.status<>'DRAFT'
                left join assignment_progress ap on ap.assignment_id=a.id and ap.student_id=cs.student_id and ap.deleted_at is null
                where cs.student_id=? and cs.deleted_at is null
                group by c.id,c.code,c.name,c.status,c.description,g.name
                order by c.name
                """, studentId));
    }

    /**
     * Nhiệm vụ của một lớp kèm trạng thái nộp của chính em. Bài còn ở trạng thái DRAFT
     * (giáo viên chưa giao) thì không hiện.
     */
    @GetMapping("/{classId}/tasks")
    public ApiResponse<List<Map<String, Object>>> myTasks(@PathVariable Long classId) {
        guard.requireMember(classId);
        Long studentId = current.requireUserId();
        return ApiResponse.ok("Nhiệm vụ của tôi trong lớp", jdbc.queryForList("""
                select a.id,a.title,a.due_at,a.status,a.requirement,a.lesson_id,a.worksheet_id,a.document_id,
                       w.name worksheet_name,d.title document_title,d.file_url document_file_url,d.doc_type document_doc_type,
                       coalesce(ap.grading_status,'NOT_SUBMITTED') grading_status,
                       coalesce(ap.completion_percent,0) completion_percent,
                       ap.opened_at,ap.submitted_at,ap.returned_at,
                       case when ap.returned_at is not null then ap.score else null end score,
                       case when ap.returned_at is not null then ap.max_score else null end max_score,
                       case when ap.returned_at is not null then ap.teacher_feedback else null end teacher_feedback
                from assignments a
                left join worksheets w on w.id=a.worksheet_id and w.deleted_at is null
                left join documents d on d.id=a.document_id and d.deleted_at is null
                left join assignment_progress ap on ap.assignment_id=a.id and ap.student_id=? and ap.deleted_at is null
                where a.class_id=? and a.deleted_at is null and a.status<>'DRAFT'
                order by a.requirement,a.due_at nulls last,a.created_at desc
                """, studentId, classId));
    }

    /** Nhật ký nộp bài của chính em trong lớp — cùng dữ liệu giáo viên thấy, nhưng lọc cứng theo em. */
    @GetMapping("/{classId}/submission-log")
    public ApiResponse<List<Map<String, Object>>> myLog(@PathVariable Long classId,
                                                       @RequestParam(defaultValue = "100") int limit) {
        guard.requireMember(classId);
        int size = Math.max(1, Math.min(limit, 500));
        return ApiResponse.ok("Nhật ký nộp bài của tôi", jdbc.queryForList("""
                select l.id,l.assignment_id,a.title,l.student_id,u.full_name,u.username,
                       l.action,l.requirement,l.score,l.note,l.created_at,l.actor_id,actor.full_name actor_name
                from assignment_submission_log l
                join assignments a on a.id=l.assignment_id
                join users u on u.id=l.student_id
                left join users actor on actor.id=l.actor_id
                where l.class_id=? and l.student_id=? and l.deleted_at is null
                order by l.created_at desc limit ?
                """, classId, current.requireUserId(), size));
    }
}
