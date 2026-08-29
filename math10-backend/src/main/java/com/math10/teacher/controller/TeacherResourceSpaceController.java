package com.math10.teacher.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController @RequiredArgsConstructor @RequestMapping("/api/teacher/resources") @PreAuthorize("hasRole('TEACHER')")
public class TeacherResourceSpaceController {
    private final JdbcTemplate jdbc; private final CurrentUserService current;

    @GetMapping public ApiResponse<List<Map<String,Object>>> mine(){return ApiResponse.ok("Học liệu của tôi",jdbc.queryForList("select * from teacher_resources where owner_teacher_id=? and deleted_at is null order by created_at desc",current.requireUserId()));}

    @PostMapping @Transactional public ApiResponse<Map<String,Object>> create(@RequestBody Input x){Long owner=current.requireUserId();validateAnchor(x.lessonId(),x.exerciseTypeId());Long id=jdbc.queryForObject("insert into teacher_resources(owner_teacher_id,lesson_id,exercise_type_id,resource_type,title,description,storage_key,external_url,moderation_status,status,created_at,updated_at) values(?,?,?,?,?,?,?,?, 'PENDING','ACTIVE',now(),now()) returning id",Long.class,owner,x.lessonId(),x.exerciseTypeId(),x.resourceType(),x.title(),x.description(),x.storageKey(),x.externalUrl());return ApiResponse.created("Đã tạo học liệu",owned(id));}

    @PutMapping("/{id}") @Transactional public ApiResponse<Map<String,Object>> update(@PathVariable Long id,@RequestBody Input x){owned(id);validateAnchor(x.lessonId(),x.exerciseTypeId());jdbc.update("update teacher_resources set lesson_id=?,exercise_type_id=?,resource_type=?,title=?,description=?,storage_key=?,external_url=?,moderation_status='PENDING',updated_at=now() where id=?",x.lessonId(),x.exerciseTypeId(),x.resourceType(),x.title(),x.description(),x.storageKey(),x.externalUrl(),id);return ApiResponse.ok("Đã cập nhật học liệu",owned(id));}

    @DeleteMapping("/{id}") @Transactional public ApiResponse<Void> archive(@PathVariable Long id){owned(id);jdbc.update("update teacher_resources set status='ARCHIVED',updated_at=now() where id=?",id);return ApiResponse.noContent("Đã lưu trữ học liệu");}

    @PostMapping("/{id}/shares") @Transactional public ApiResponse<Map<String,Object>> share(@PathVariable Long id,@RequestBody ShareInput x){owned(id);Long teacher=current.requireUserId();Integer teaches=jdbc.queryForObject("select count(*) from class_teachers where class_id=? and teacher_id=? and deleted_at is null",Integer.class,x.classId(),teacher);if(teaches==null||teaches==0)throw new BusinessException("Bạn không phụ trách lớp này");if(x.availableFrom()!=null&&x.availableUntil()!=null&&x.availableFrom().isAfter(x.availableUntil()))throw new BusinessException("Thời gian chia sẻ không hợp lệ");Long shareId=jdbc.queryForObject("insert into resource_shares(teacher_resource_id,class_id,shared_by,available_from,available_until,status,created_at,updated_at) values(?,?,?,?,?,'ACTIVE',now(),now()) on conflict (teacher_resource_id,class_id) where deleted_at is null do update set available_from=excluded.available_from,available_until=excluded.available_until,status='ACTIVE',updated_at=now() returning id",Long.class,id,x.classId(),teacher,x.availableFrom(),x.availableUntil());return ApiResponse.created("Đã chia sẻ học liệu",jdbc.queryForMap("select * from resource_shares where id=?",shareId));}

    private Map<String,Object> owned(Long id){List<Map<String,Object>> rows=jdbc.queryForList("select * from teacher_resources where id=? and owner_teacher_id=? and deleted_at is null",id,current.requireUserId());if(rows.isEmpty())throw new ResourceNotFoundException("Không tìm thấy học liệu");return rows.get(0);}
    private void validateAnchor(Long lessonId,Long exerciseTypeId){if(lessonId!=null&&jdbc.queryForObject("select count(*) from lessons where id=? and deleted_at is null",Integer.class,lessonId)==0)throw new ResourceNotFoundException("Không tìm thấy bài học");if(exerciseTypeId!=null){Map<String,Object> row=jdbc.queryForMap("select lesson_id from exercise_types where id=? and deleted_at is null",exerciseTypeId);if(lessonId==null||((Number)row.get("lesson_id")).longValue()!=lessonId.longValue())throw new BusinessException("Dạng bài không thuộc bài học đã chọn");}}
    public record Input(Long lessonId,Long exerciseTypeId,String resourceType,String title,String description,String storageKey,String externalUrl){}
    public record ShareInput(Long classId,LocalDateTime availableFrom,LocalDateTime availableUntil){}
}
