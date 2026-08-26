package com.math10.student.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import com.math10.student.dto.StudentAssignmentResponse;
import com.math10.student.dto.StudentCourseResponse;
import com.math10.taxonomy.dto.TaxonomyNodeResponse;
import com.math10.taxonomy.service.TaxonomyService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;

import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/student")
public class StudentLearningController {
    private final JdbcTemplate jdbc;
    private final CurrentUserService current;
    private final TaxonomyService taxonomyService;

    @GetMapping("/taxonomy")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<List<TaxonomyNodeResponse>> taxonomy(@RequestParam(required = false) String subject) {
        return ApiResponse.ok("Lấy cây chuyên đề thành công", taxonomyService.activeTree(subject));
    }

    @GetMapping("/courses")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<List<StudentCourseResponse>> courses() {
        Long studentId = current.requireUserId();
        List<Map<String, Object>> courseRows = jdbc.queryForList("""
                select distinct c.id,c.code,c.name,c.description,c.status
                from courses c
                join class_courses cc on cc.course_id=c.id and cc.deleted_at is null
                join class_students cs on cs.class_id=cc.class_id and cs.deleted_at is null
                where cs.student_id=? and c.deleted_at is null and c.status='PUBLISHED'
                order by c.name
                """, studentId);

        List<StudentCourseResponse> result = new ArrayList<>();
        for (Map<String, Object> course : courseRows) {
            Long courseId = num(course.get("id"));
            List<Map<String, Object>> chapterRows = jdbc.queryForList("""
                    select id,title,order_index
                    from chapters
                    where course_id=? and deleted_at is null and status='PUBLISHED'
                    order by order_index
                    """, courseId);
            List<StudentCourseResponse.Chapter> chapters = new ArrayList<>();

            for (Map<String, Object> chapter : chapterRows) {
                Long chapterId = num(chapter.get("id"));
                List<Map<String, Object>> lessonRows = jdbc.queryForList("""
                        select l.id,l.title,l.summary,l.content_html,l.order_index,l.status,
                               coalesce(p.status,'NOT_OPENED') progress_status,
                               p.opened_at,p.completed_at,
                               coalesce(p.completion_percent,0) completion_percent
                        from lessons l
                        left join learning_progress p on p.lesson_id=l.id and p.student_id=? and p.deleted_at is null
                        where l.chapter_id=? and l.deleted_at is null and l.status in ('PUBLISHED','HIDDEN')
                        order by l.order_index
                        """, studentId, chapterId);
                List<StudentCourseResponse.Lesson> lessons = new ArrayList<>();

                for (Map<String, Object> lesson : lessonRows) {
                    Long lessonId = num(lesson.get("id"));
                    boolean locked = !"PUBLISHED".equals(str(lesson.get("status")));
                    List<StudentCourseResponse.Resource> resources = locked ? List.of() : resources(lessonId);
                    List<StudentCourseResponse.AttachedWorksheet> attached = locked ? List.of() : worksheets(lessonId);
                    lessons.add(new StudentCourseResponse.Lesson(
                            lessonId,
                            str(lesson.get("title")),
                            str(lesson.get("summary")),
                            str(lesson.get("content_html")),
                            integer(lesson.get("order_index")),
                            str(lesson.get("status")),
                            str(lesson.get("progress_status")),
                            dateTime(lesson.get("opened_at")),
                            dateTime(lesson.get("completed_at")),
                            integer(lesson.get("completion_percent")),
                            locked,
                            resources,
                            attached
                    ));
                }
                chapters.add(new StudentCourseResponse.Chapter(
                        num(chapter.get("id")),
                        str(chapter.get("title")),
                        integer(chapter.get("order_index")),
                        lessons
                ));
            }
            result.add(new StudentCourseResponse(
                    courseId,
                    str(course.get("code")),
                    str(course.get("name")),
                    str(course.get("description")),
                    str(course.get("status")),
                    chapters
            ));
        }
        return ApiResponse.ok("My courses", result);
    }

    @GetMapping("/assignments")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<List<StudentAssignmentResponse>> assignments() {
        Long studentId = current.requireUserId();
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select distinct a.id,a.title,a.due_at,a.status,a.lesson_id,a.worksheet_id,w.name worksheet_name,a.created_at,
                case when ap.completed_at is not null then 'COMPLETED' when ap.opened_at is not null then 'IN_PROGRESS' else 'NOT_OPENED' end progress_status,
                coalesce(ap.completion_percent,0) completion_percent,coalesce(ap.grading_status,'NOT_SUBMITTED') grading_status,
                case when ap.returned_at is not null then ap.score else null end score,
                case when ap.returned_at is not null then ap.max_score else null end max_score
                from assignments a join class_students cs on cs.class_id=a.class_id and cs.deleted_at is null
                left join worksheets w on w.id=a.worksheet_id and w.deleted_at is null
                left join assignment_progress ap on ap.assignment_id=a.id and ap.student_id=cs.student_id and ap.deleted_at is null
                where cs.student_id=? and a.deleted_at is null order by a.created_at desc
                """, studentId);
        return ApiResponse.ok("Assignments", rows.stream().map(assignment -> {
            Long worksheetId = assignment.get("worksheet_id") == null ? null : num(assignment.get("worksheet_id"));
            List<StudentAssignmentResponse.Item> content = worksheetId == null ? List.of() : jdbc.query("""
                    select p.id,wi.order_index,p.public_code,p.qr_slug,p.statement_latex,p.difficulty,p.option_a,p.option_b,p.option_c,p.option_d
                    from worksheet_items wi join problems p on p.id=wi.problem_id and p.deleted_at is null
                    where wi.worksheet_id=? and wi.deleted_at is null order by wi.order_index
                    """, (rs, n) -> new StudentAssignmentResponse.Item(rs.getLong("id"), rs.getInt("order_index"), rs.getString("public_code"), rs.getString("qr_slug"), rs.getString("statement_latex"), rs.getString("difficulty"),rs.getString("option_a"),rs.getString("option_b"),rs.getString("option_c"),rs.getString("option_d")), worksheetId);
            return new StudentAssignmentResponse(
                    num(assignment.get("id")),
                    str(assignment.get("title")),
                    dateTime(assignment.get("due_at")),
                    str(assignment.get("status")),
                    assignment.get("lesson_id") == null ? null : num(assignment.get("lesson_id")),
                    worksheetId,
                    str(assignment.get("worksheet_name")),
                    str(assignment.get("progress_status")),
                    integer(assignment.get("completion_percent")),str(assignment.get("grading_status")),
                    assignment.get("score")==null?null:new java.math.BigDecimal(assignment.get("score").toString()),
                    assignment.get("max_score")==null?null:new java.math.BigDecimal(assignment.get("max_score").toString()),
                    content
            );
        }).toList());
    }

    private List<StudentCourseResponse.Resource> resources(Long lessonId) {
        return jdbc.query("""
                select id,type,title,external_url,file_asset_id,text_content,order_index
                from lesson_resources
                where lesson_id=? and deleted_at is null
                order by order_index
                """, (rs, n) -> new StudentCourseResponse.Resource(rs.getLong("id"), rs.getString("type"), rs.getString("title"), rs.getString("external_url"), rs.getObject("file_asset_id", Long.class), rs.getString("text_content"), rs.getInt("order_index")), lessonId);
    }

    private List<StudentCourseResponse.AttachedWorksheet> worksheets(Long lessonId) {
        return jdbc.query("""
                select id,name
                from worksheets
                where lesson_id=? and deleted_at is null
                order by created_at
                """, (rs, n) -> new StudentCourseResponse.AttachedWorksheet(rs.getLong("id"), rs.getString("name")), lessonId);
    }

    private static Long num(Object value) {
        return ((Number) value).longValue();
    }

    private static Integer integer(Object value) {
        return value == null ? 0 : ((Number) value).intValue();
    }

    private static String str(Object value) {
        return value == null ? "" : value.toString();
    }

    private static LocalDateTime dateTime(Object value) {
        return value == null ? null : ((Timestamp) value).toLocalDateTime();
    }
}
