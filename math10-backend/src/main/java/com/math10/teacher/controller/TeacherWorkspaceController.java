package com.math10.teacher.controller;
import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequiredArgsConstructor @RequestMapping("/api/teacher") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
public class TeacherWorkspaceController {
 private final JdbcTemplate jdbc;private final CurrentUserService current;
 @GetMapping("/dashboard") public ApiResponse<Map<String,Object>> dashboard(){
  Long teacher=current.requireUserId();String adminClause="ADMIN".equals(current.requireRoleCode())?"":" where ct.teacher_id="+teacher;
  Integer classes=jdbc.queryForObject("select count(distinct ct.class_id) from class_teachers ct"+adminClause,Integer.class);
  Integer low=jdbc.queryForObject("""
    select count(*) from (
      select cs.student_id from class_students cs join class_teachers ct on ct.class_id=cs.class_id and ct.deleted_at is null
      left join learning_progress p on p.student_id=cs.student_id and p.deleted_at is null
      where cs.deleted_at is null and (? or ct.teacher_id=?) group by cs.student_id having coalesce(avg(p.completion_percent),0)<50
    ) learners
    """,Integer.class,"ADMIN".equals(current.requireRoleCode()),teacher);if(low==null)low=0;
  Integer sheets=jdbc.queryForObject("select count(*) from worksheets where deleted_at is null and (? or created_by=?)",Integer.class,"ADMIN".equals(current.requireRoleCode()),teacher);
  return ApiResponse.ok("Dashboard giáo viên",Map.of("classes",classes==null?0:classes,"studentsBelow50",low,"worksheets",sheets==null?0:sheets));
 }
 @GetMapping("/classes") public ApiResponse<List<Map<String,Object>>> classes(){Long id=current.requireUserId();return ApiResponse.ok("Lớp đang dạy",jdbc.queryForList("""
   select distinct c.id,c.code,c.name,c.grade_id,c.status from classes c join class_teachers ct on ct.class_id=c.id and ct.deleted_at is null
   where c.deleted_at is null and (? or ct.teacher_id=?) order by c.name
   ""","ADMIN".equals(current.requireRoleCode()),id));}
 @GetMapping("/gradebook") public ApiResponse<List<Map<String,Object>>> gradebook(@RequestParam Long classId){check(classId);return ApiResponse.ok("Sổ điểm",jdbc.queryForList("""
   select u.id student_id,u.full_name,u.username,a.id assignment_id,a.title,
   case when ap.completed_at is not null then 'COMPLETED' when ap.opened_at is not null then 'IN_PROGRESS' else 'NOT_OPENED' end status,
   coalesce(ap.completion_percent,0) completion_percent
   from class_students cs join users u on u.id=cs.student_id and u.deleted_at is null
   cross join assignments a left join assignment_progress ap on ap.student_id=u.id and ap.assignment_id=a.id and ap.deleted_at is null
   where cs.class_id=? and cs.deleted_at is null and a.class_id=? and a.deleted_at is null order by u.full_name,a.created_at
   """,classId,classId));}
 private void check(Long classId){if("ADMIN".equals(current.requireRoleCode()))return;Integer n=jdbc.queryForObject("select count(*) from class_teachers where class_id=? and teacher_id=? and deleted_at is null",Integer.class,classId,current.requireUserId());if(n==null||n==0)throw new AccessDeniedException("Không có quyền truy cập lớp");}
 @GetMapping("/class-results") public ApiResponse<List<Map<String,Object>>> classResults(){
  Long teacher=current.requireUserId();boolean isAdmin="ADMIN".equals(current.requireRoleCode());
  return ApiResponse.ok("Kết quả các lớp",jdbc.queryForList("""
   with latest_assignments as (
     select distinct on (a.class_id, cs.student_id)
       a.class_id,
       cs.student_id,
       a.id as assignment_id,
       a.title,
       ap.completion_percent,
       ap.completed_at,
       ap.opened_at,
       ap.quiz_score
     from assignments a
     cross join class_students cs
     left join assignment_progress ap on ap.assignment_id=a.id and ap.student_id=cs.student_id and ap.deleted_at is null
     where a.deleted_at is null and cs.deleted_at is null
     and (a.class_id in (select class_id from class_teachers where teacher_id=? and deleted_at is null) or ?)
     order by a.class_id, cs.student_id, a.created_at desc
   ),
   student_stats as (
     select
       class_id,
       student_id,
       coalesce(avg(completion_percent),0) as avg_percent,
       count(*) as total_assignments,
       sum(case when completed_at is not null then 1 else 0 end) as completed_count
     from latest_assignments
     group by class_id, student_id
   ),
   class_stats as (
     select
       c.id as class_id,
       c.name as class_name,
       c.code as class_code,
       u.full_name as teacher_name,
       coalesce(round(avg(ss.avg_percent),1),0) as avg_grade,
       coalesce(round(avg(ss.total_assignments) filter (where ss.avg_percent>=0),1),0) as avg_completion,
       coalesce(round(100.0*sum(ss.completed_count)/nullif(sum(ss.total_assignments),0),0),0) as completion_rate
     from class_teachers ct
     join classes c on c.id=ct.class_id and c.deleted_at is null
     left join users u on u.id=ct.teacher_id and u.deleted_at is null
     left join student_stats ss on ss.class_id=c.id
     where ct.deleted_at is null and (ct.teacher_id=? or ?)
     group by c.id, c.name, c.code, u.full_name
   )
   select
     class_id as "classId",
     class_name as "className",
     class_code as "classCode",
     teacher_name as "teacherName",
     case
       when avg_grade>=5.0 then 'Đạt'
       when avg_grade>0 then 'Cần dạy lại'
       else 'Chưa có dữ liệu'
     end as status,
     avg_grade as "diemTb",
     avg_completion as "hoanThanh",
     completion_rate as "tiLe"
   from class_stats
   order by avg_grade asc nulls last
   """,teacher,isAdmin,teacher,isAdmin));
 }
}
