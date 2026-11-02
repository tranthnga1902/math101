package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController @RequiredArgsConstructor
public class ProgramDeliveryController {
    private final JdbcTemplate jdbc;

    @GetMapping("/api/admin/program-templates") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String,Object>>> templates(){return ApiResponse.ok("Mẫu chương trình",jdbc.queryForList("select * from program_templates where deleted_at is null order by name"));}

    @PostMapping("/api/admin/program-templates") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> createTemplate(@RequestBody TemplateInput x){require("courses",x.programId());Long id=jdbc.queryForObject("insert into program_templates(program_id,name,description,status,created_at,updated_at) values(?,?,?,?,now(),now()) returning id",Long.class,x.programId(),x.name(),x.description(),value(x.status(),"DRAFT"));return ApiResponse.created("Đã tạo mẫu chương trình",one("program_templates",id));}

    @PutMapping("/api/admin/program-templates/{id}/chapters") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<List<Map<String,Object>>> configure(@PathVariable Long id,@RequestBody List<TemplateChapterInput> rows){require("program_templates",id);jdbc.update("update program_template_chapters set deleted_at=now(),updated_at=now() where template_id=? and deleted_at is null",id);for(TemplateChapterInput x:rows){require("chapters",x.chapterId());jdbc.update("insert into program_template_chapters(template_id,chapter_id,order_index,recommended_days,created_at,updated_at) values(?,?,?,?,now(),now())",id,x.chapterId(),x.orderIndex(),x.recommendedDays());}return ApiResponse.ok("Đã cấu hình mẫu",jdbc.queryForList("select * from program_template_chapters where template_id=? and deleted_at is null order by order_index",id));}

    @GetMapping("/api/admin/course-instances") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String,Object>>> instances(){return ApiResponse.ok("Khóa triển khai",jdbc.queryForList("select ci.*,pt.name template_name from course_instances ci join program_templates pt on pt.id=ci.template_id where ci.deleted_at is null order by ci.starts_on desc"));}

    @PostMapping("/api/admin/course-instances") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> createInstance(@RequestBody CourseInput x){
        require("program_templates",x.templateId());
        if(x.startsOn().isAfter(x.endsOn()))throw new BusinessException("Ngày bắt đầu phải trước ngày kết thúc");
        Long courseId=jdbc.queryForObject("select program_id from program_templates where id=? and deleted_at is null",Long.class,x.templateId());
        Long tpId=x.teachingPlanId();
        if(tpId==null){List<Long> tps=jdbc.queryForList("select id from teaching_plans where template_id=? and deleted_at is null order by id limit 1",Long.class,x.templateId());if(!tps.isEmpty())tpId=tps.get(0);}
        Long id=jdbc.queryForObject(
            "insert into course_instances(template_id,course_id,teaching_plan_id,name,school_year,starts_on,ends_on,target_ends_on,status,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,now(),now()) returning id",
            Long.class,x.templateId(),courseId,tpId,x.name(),x.schoolYear(),x.startsOn(),x.endsOn(),x.endsOn(),value(x.status(),"DRAFT"));
        return ApiResponse.created("Đã tạo khóa học",one("course_instances",id));
    }

    @PutMapping("/api/admin/course-instances/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> updateInstance(@PathVariable Long id,@RequestBody CourseInput x){
        require("course_instances",id);
        require("program_templates",x.templateId());
        if(x.startsOn().isAfter(x.endsOn()))throw new BusinessException("Ngày bắt đầu phải trước ngày kết thúc");
        Long courseId=jdbc.queryForObject("select program_id from program_templates where id=? and deleted_at is null",Long.class,x.templateId());
        Long tpId=x.teachingPlanId();
        if(tpId==null){List<Long> tps=jdbc.queryForList("select id from teaching_plans where template_id=? and deleted_at is null order by id limit 1",Long.class,x.templateId());if(!tps.isEmpty())tpId=tps.get(0);}
        jdbc.update("update course_instances set template_id=?,course_id=?,teaching_plan_id=?,name=?,school_year=?,starts_on=?,ends_on=?,target_ends_on=?,status=?,updated_at=now() where id=? and deleted_at is null",
            x.templateId(),courseId,tpId,x.name(),x.schoolYear(),x.startsOn(),x.endsOn(),x.endsOn(),value(x.status(),"DRAFT"),id);
        return ApiResponse.ok("Đã cập nhật khóa học",jdbc.queryForMap("select ci.*,pt.name template_name from course_instances ci join program_templates pt on pt.id=ci.template_id where ci.id=?",id));
    }

    @DeleteMapping("/api/admin/course-instances/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> deleteInstance(@PathVariable Long id){
        require("course_instances",id);
        jdbc.update("update course_instances set deleted_at=now(),updated_at=now() where id=? and deleted_at is null",id);
        jdbc.update("update program_schedules set deleted_at=now(),updated_at=now() where course_instance_id=? and deleted_at is null",id);
        jdbc.update("update academic_breaks set deleted_at=now(),updated_at=now() where course_instance_id=? and deleted_at is null",id);
        jdbc.update("update class_courses set deleted_at=now(),updated_at=now() where course_instance_id=? and deleted_at is null",id);
        return ApiResponse.ok("Đã xóa khóa học",null);
    }

    @GetMapping("/api/admin/course-instances/{id}/breaks") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String,Object>>> breaks(@PathVariable Long id){require("course_instances",id);return ApiResponse.ok("Kỳ nghỉ của khóa",jdbc.queryForList("select * from academic_breaks where course_instance_id=? and deleted_at is null order by starts_on",id));}

    @PostMapping("/api/admin/course-instances/{id}/breaks") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> addBreak(@PathVariable Long id,@RequestBody BreakInput x){
        Map<String,Object> khoa=one("course_instances",id);
        if(x.startsOn()==null||x.endsOn()==null)throw new BusinessException("Kỳ nghỉ phải có ngày bắt đầu và ngày kết thúc");
        if(x.startsOn().isAfter(x.endsOn()))throw new BusinessException("Ngày bắt đầu phải trước ngày kết thúc");
        if(x.reason()==null||x.reason().isBlank())throw new BusinessException("Kỳ nghỉ phải có lý do — màn hình học sinh hiện đúng dòng chữ này");
        // Kỳ nghỉ nằm ngoài khoảng của khóa thì không ngày học nào rơi vào nó: nhận rồi cất đi sẽ
        // thành một dòng vô hại nhưng vô dụng, mà Admin thì tin là đã đặt xong.
        LocalDate tu=((Date)khoa.get("starts_on")).toLocalDate(),den=((Date)khoa.get("ends_on")).toLocalDate();
        if(x.startsOn().isBefore(tu)||x.endsOn().isAfter(den))throw new BusinessException("Kỳ nghỉ phải nằm trong khoảng của khóa ("+tu+" đến "+den+")");
        Long newId=jdbc.queryForObject("insert into academic_breaks(course_instance_id,starts_on,ends_on,reason,created_at,updated_at) values(?,?,?,?,now(),now()) returning id",Long.class,id,x.startsOn(),x.endsOn(),x.reason().trim());
        return ApiResponse.created("Đã thêm kỳ nghỉ",one("academic_breaks",newId));
    }

    @DeleteMapping("/api/admin/academic-breaks/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> removeBreak(@PathVariable Long id){if(jdbc.update("update academic_breaks set deleted_at=now(),updated_at=now() where id=? and deleted_at is null",id)!=1)throw new ResourceNotFoundException("Không tìm thấy kỳ nghỉ");return ApiResponse.ok("Đã gỡ kỳ nghỉ",null);}

    private void require(String table,Long id){Integer n=jdbc.queryForObject("select count(*) from "+table+" where id=? and deleted_at is null",Integer.class,id);if(n==null||n==0)throw new ResourceNotFoundException("Không tìm thấy dữ liệu");}
    private Map<String,Object> one(String table,Long id){require(table,id);return jdbc.queryForMap("select * from "+table+" where id=?",id);}
    private String value(String x,String fallback){return x==null?fallback:x;}
    public record TemplateInput(Long programId,String name,String description,String status){}
    public record TemplateChapterInput(Long chapterId,Integer orderIndex,Integer recommendedDays){}
    public record CourseInput(Long templateId,String name,String schoolYear,LocalDate startsOn,LocalDate endsOn,String status,Long teachingPlanId){}
    public record BreakInput(LocalDate startsOn,LocalDate endsOn,String reason){}
}
