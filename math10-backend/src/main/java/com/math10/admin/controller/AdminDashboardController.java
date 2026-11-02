package com.math10.admin.controller;

import com.math10.admin.dto.AdminDashboardResponse;
import com.math10.classes.repository.ClassroomRepository;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.courses.entity.CourseStatus;
import com.math10.courses.repository.CourseRepository;
import com.math10.users.repository.UserRepository;
import com.math10.mathcontent.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin")
public class AdminDashboardController {
    private final UserRepository users;
    private final ClassroomRepository classrooms;
    private final CourseRepository courses;
    private final ProblemRepository problems;
    private final JdbcTemplate jdbc;

    @GetMapping("/dashboard")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminDashboardResponse> dashboard() {
        return ApiResponse.ok("Lấy dashboard admin thành công", new AdminDashboardResponse(
                users.count(),
                users.countByRoleCode("TEACHER"),
                users.countByRoleCode("STUDENT"),
                classrooms.count(),
                courses.count(),
                courses.countByStatus(CourseStatus.PUBLISHED),
                problems.countByStatus("PUBLISHED")
        ));
    }

    /**
     * Lịch tổng quan chỉ trả về các mốc cần hành động của học sinh/giáo viên. Không đưa bản nháp,
     * bài tự chọn, luyện tự do hay một dòng "đang diễn ra" cho từng ngày vào đây.
     */
    @GetMapping("/calendar-events")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String, Object>>> calendarEvents(@RequestParam LocalDate from,
                                                                  @RequestParam LocalDate to) {
        if (to.isBefore(from)) throw new BusinessException("Khoảng ngày của lịch không hợp lệ");
        if (ChronoUnit.DAYS.between(from, to) > 62)
            throw new BusinessException("Mỗi lần chỉ xem tối đa 63 ngày lịch");

        return ApiResponse.ok("Sự kiện học tập quan trọng", jdbc.queryForList("""
                with important_events as (
                    select case when a.task_kind='BAI_KIEM_TRA' then 'EXAM' else 'ASSIGNMENT_DUE' end kind,
                           a.id source_id,cast(a.due_at as date) event_date,a.due_at event_at,
                           a.title,c.name class_name,
                           case when a.task_kind='BAI_KIEM_TRA' then 1 else 2 end priority
                    from assignments a
                    join classes c on c.id=a.class_id and c.deleted_at is null and c.status<>'ARCHIVED'
                    where a.deleted_at is null and a.status='PUBLISHED'
                      and a.requirement='BAT_BUOC'
                      and a.task_kind in ('BAI_KIEM_TRA','BAI_TAP')
                      and a.due_at>=cast(? as date) and a.due_at<cast(? as date)+interval '1 day'

                    union all

                    select 'COURSE_START',ci.id,ci.starts_on,cast(ci.starts_on as timestamp),
                           ci.name,string_agg(distinct c.name,', ' order by c.name),3
                    from course_instances ci
                    join class_courses cc on cc.course_instance_id=ci.id and cc.deleted_at is null
                    join classes c on c.id=cc.class_id and c.deleted_at is null and c.status<>'ARCHIVED'
                    where ci.deleted_at is null and ci.status='PUBLISHED'
                      and ci.starts_on between cast(? as date) and cast(? as date)
                      and (exists(select 1 from class_students cs where cs.class_id=c.id and cs.deleted_at is null)
                           or exists(select 1 from class_teachers ct where ct.class_id=c.id and ct.deleted_at is null))
                    group by ci.id,ci.starts_on,ci.name

                    union all

                    select 'COURSE_END',ci.id,ci.ends_on,cast(ci.ends_on as timestamp),
                           ci.name,string_agg(distinct c.name,', ' order by c.name),4
                    from course_instances ci
                    join class_courses cc on cc.course_instance_id=ci.id and cc.deleted_at is null
                    join classes c on c.id=cc.class_id and c.deleted_at is null and c.status<>'ARCHIVED'
                    where ci.deleted_at is null and ci.status='PUBLISHED'
                      and ci.ends_on between cast(? as date) and cast(? as date)
                      and (exists(select 1 from class_students cs where cs.class_id=c.id and cs.deleted_at is null)
                           or exists(select 1 from class_teachers ct where ct.class_id=c.id and ct.deleted_at is null))
                    group by ci.id,ci.ends_on,ci.name
                )
                select * from important_events order by event_date,priority,event_at,title
                """, from, to, from, to, from, to));
    }
}
