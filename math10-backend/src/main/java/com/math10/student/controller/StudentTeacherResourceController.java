package com.math10.student.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.configuration.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import java.util.Map;

@RestController @RequiredArgsConstructor @RequestMapping("/api/student/teacher-resources") @PreAuthorize("hasRole('STUDENT')")
public class StudentTeacherResourceController {
 private final JdbcTemplate jdbc; private final CurrentUserService current;
 @GetMapping public ApiResponse<List<Map<String,Object>>> shared(@RequestParam(required=false) Long lessonId){return ApiResponse.ok("Từ giáo viên của em",jdbc.queryForList("""
 select tr.*,u.full_name teacher_name,rs.available_from,rs.available_until,c.name class_name
 from resource_shares rs join teacher_resources tr on tr.id=rs.teacher_resource_id and tr.deleted_at is null and tr.status='ACTIVE'
 join classes c on c.id=rs.class_id join class_students cs on cs.class_id=c.id and cs.deleted_at is null
 join users u on u.id=tr.owner_teacher_id
 where cs.student_id=? and rs.deleted_at is null and rs.status='ACTIVE'
 and (rs.available_from is null or rs.available_from<=now()) and (rs.available_until is null or rs.available_until>=now())
 """+(lessonId==null?"":" and tr.lesson_id=?")+" order by rs.created_at desc",lessonId==null?new Object[]{current.requireUserId()}:new Object[]{current.requireUserId(),lessonId}));}
}
