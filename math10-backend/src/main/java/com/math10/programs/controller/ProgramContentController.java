package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController @RequiredArgsConstructor
public class ProgramContentController {
    private final JdbcTemplate jdbc;

    @GetMapping("/api/programs/{programId}/chapters-by-time") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String,Object>>> chaptersByTime(@PathVariable Long programId,@RequestParam(required=false) java.time.LocalDate at){java.time.LocalDate date=at==null?java.time.LocalDate.now():at;return ApiResponse.ok("Chương theo thời gian",jdbc.queryForList("""
      select ch.id chapter_id,ch.title,ch.order_index,ps.starts_on,ps.ends_on,
      case when ? between ps.starts_on and ps.ends_on then 'CURRENT' when ps.starts_on>? then 'UPCOMING' else 'PAST' end time_group
      from chapters ch left join program_schedules ps on ps.chapter_id=ch.id and ps.course_id=ch.course_id and ps.deleted_at is null and ps.status='ACTIVE' and ps.course_instance_id is null
      where ch.course_id=? and ch.deleted_at is null and ch.status='PUBLISHED'
      order by ch.order_index""",date,date,programId));}

    @GetMapping("/api/programs/{programId}/resources") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String,Object>>> published(@PathVariable Long programId,@RequestParam(required=false) String type){
        String filter=type==null?"":" and pr.resource_type=?";
        Object[] args=type==null?new Object[]{programId}:new Object[]{programId,type};
        return ApiResponse.ok("Nội dung chương trình",jdbc.queryForList("""
          select pr.*,l.chapter_id,ch.order_index chapter_order,ps.starts_on,ps.ends_on,
          v.video_url,v.thumbnail_url,v.duration_seconds,
          case when current_date between ps.starts_on and ps.ends_on then 'CURRENT'
               when ps.starts_on>current_date then 'UPCOMING' else 'PAST' end time_group
          from program_resources pr join lessons l on l.id=pr.lesson_id and l.deleted_at is null
          join chapters ch on ch.id=l.chapter_id and ch.deleted_at is null
          left join videos v on pr.resource_type='VIDEO' and v.id=pr.resource_ref_id and v.deleted_at is null
          left join program_schedules ps on ps.chapter_id=ch.id and ps.course_id=ch.course_id and ps.deleted_at is null and ps.status='ACTIVE'
          where ch.course_id=? and pr.deleted_at is null and pr.status='PUBLISHED'
            and (pr.resource_type<>'VIDEO' or v.status='PUBLISHED')"""+filter+" order by case when current_date between ps.starts_on and ps.ends_on then 0 when ps.starts_on>current_date then 1 else 2 end,ch.order_index,pr.order_index",args));
    }

    @GetMapping("/api/lessons/{lessonId}/program-resources") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String,Object>>> lesson(@PathVariable Long lessonId){return ApiResponse.ok("Luồng nội dung",jdbc.queryForList("select * from program_resources where lesson_id=? and deleted_at is null and status='PUBLISHED' order by order_index",lessonId));}

    @PostMapping("/api/admin/lessons/{lessonId}/resources") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> add(@PathVariable Long lessonId,@RequestBody ResourceInput x){
        validateRef(x.resourceType(),x.resourceRefId());
        Long id=jdbc.queryForObject("insert into program_resources(lesson_id,exercise_type_id,resource_type,resource_ref_id,title,order_index,status,created_at,updated_at) values(?,?,?,?,?,?,?,now(),now()) returning id",Long.class,lessonId,x.exerciseTypeId(),x.resourceType(),x.resourceRefId(),x.title(),x.orderIndex(),x.status()==null?"DRAFT":x.status());
        return ApiResponse.created("Đã thêm vào luồng học",one("program_resources",id));
    }

    @PutMapping("/api/admin/lessons/{lessonId}/resources/reorder") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> reorder(@PathVariable Long lessonId,@RequestBody List<OrderInput> rows){
        for(OrderInput row:rows) if(jdbc.update("update program_resources set order_index=-?,updated_at=now() where id=? and lesson_id=? and deleted_at is null",row.orderIndex(),row.id(),lessonId)!=1) throw new ResourceNotFoundException("Không tìm thấy nội dung");
        for(OrderInput row:rows) jdbc.update("update program_resources set order_index=? where id=?",row.orderIndex(),row.id());
        return ApiResponse.ok("Đã lưu thứ tự nội dung",null);
    }

    @DeleteMapping("/api/admin/program-resources/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> remove(@PathVariable Long id){if(jdbc.update("update program_resources set deleted_at=now(),updated_at=now() where id=? and deleted_at is null",id)!=1)throw new ResourceNotFoundException("Không tìm thấy nội dung");return ApiResponse.ok("Đã gỡ khỏi luồng học",null);}

    @GetMapping("/api/admin/videos") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String,Object>>> videos(@RequestParam(required=false) Long programId){return ApiResponse.ok("Kho video",programId==null?jdbc.queryForList("select * from videos where deleted_at is null order by created_at desc"):jdbc.queryForList("select * from videos where deleted_at is null and program_id=? order by created_at desc",programId));}

    @PostMapping("/api/admin/videos") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> video(@RequestBody VideoInput x){Long id=jdbc.queryForObject("insert into videos(title,description,video_url,thumbnail_url,duration_seconds,program_id,chapter_id,lesson_id,content_group,status,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,now(),now()) returning id",Long.class,x.title(),x.description(),x.videoUrl(),x.thumbnailUrl(),x.durationSeconds(),x.programId(),x.chapterId(),x.lessonId(),x.contentGroup(),x.status());return ApiResponse.created("Đã tạo video",one("videos",id));}

    @PutMapping("/api/admin/videos/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> updateVideo(@PathVariable Long id,@RequestBody VideoInput x){if(jdbc.update("update videos set title=?,description=?,video_url=?,thumbnail_url=?,duration_seconds=?,program_id=?,chapter_id=?,lesson_id=?,content_group=?,status=?,updated_at=now() where id=? and deleted_at is null",x.title(),x.description(),x.videoUrl(),x.thumbnailUrl(),x.durationSeconds(),x.programId(),x.chapterId(),x.lessonId(),x.contentGroup(),x.status(),id)!=1)throw new ResourceNotFoundException("Không tìm thấy video");return ApiResponse.ok("Đã cập nhật video",one("videos",id));}

    @DeleteMapping("/api/admin/videos/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> deleteVideo(@PathVariable Long id){archive("videos",id);return ApiResponse.ok("Đã lưu trữ video",null);}

    @GetMapping("/api/admin/special-topics") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String,Object>>> topics(@RequestParam(required=false) Long programId){return ApiResponse.ok("Kho chuyên đề",programId==null?jdbc.queryForList("select * from special_topics where deleted_at is null order by created_at desc"):jdbc.queryForList("select * from special_topics where deleted_at is null and program_id=? order by created_at desc",programId));}

    @PostMapping("/api/admin/special-topics") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> topic(@RequestBody TopicInput x){Long id=jdbc.queryForObject("insert into special_topics(title,description,program_id,related_chapter_id,status,created_at,updated_at) values(?,?,?,?,?,now(),now()) returning id",Long.class,x.title(),x.description(),x.programId(),x.relatedChapterId(),x.status());return ApiResponse.created("Đã tạo chuyên đề",one("special_topics",id));}

    @PutMapping("/api/admin/special-topics/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> updateTopic(@PathVariable Long id,@RequestBody TopicInput x){if(jdbc.update("update special_topics set title=?,description=?,program_id=?,related_chapter_id=?,status=?,updated_at=now() where id=? and deleted_at is null",x.title(),x.description(),x.programId(),x.relatedChapterId(),x.status(),id)!=1)throw new ResourceNotFoundException("Không tìm thấy chuyên đề");return ApiResponse.ok("Đã cập nhật chuyên đề",one("special_topics",id));}

    @DeleteMapping("/api/admin/special-topics/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> deleteTopic(@PathVariable Long id){archive("special_topics",id);return ApiResponse.ok("Đã lưu trữ chuyên đề",null);}

    private void validateRef(String type,Long id){String table=switch(type){case "VIDEO"->"videos";case "DOCUMENT"->"documents";case "EXERCISE"->"worksheets";case "SPECIAL_TOPIC"->"special_topics";default->throw new BusinessException("Loại tài nguyên không hợp lệ");};Integer n=jdbc.queryForObject("select count(*) from "+table+" where id=? and deleted_at is null",Integer.class,id);if(n==null||n==0)throw new ResourceNotFoundException("Không tìm thấy tài nguyên nguồn");}
    private Map<String,Object> one(String table,Long id){return jdbc.queryForMap("select * from "+table+" where id=?",id);}
    private void archive(String table,Long id){if(jdbc.update("update "+table+" set status='ARCHIVED',deleted_at=now(),updated_at=now() where id=? and deleted_at is null",id)!=1)throw new ResourceNotFoundException("Không tìm thấy tài nguyên");}
    public record ResourceInput(Long exerciseTypeId,String resourceType,Long resourceRefId,String title,Integer orderIndex,String status){}
    public record OrderInput(Long id,Integer orderIndex){}
    public record VideoInput(String title,String description,String videoUrl,String thumbnailUrl,Integer durationSeconds,Long programId,Long chapterId,Long lessonId,String contentGroup,String status){}
    public record TopicInput(String title,String description,Long programId,Long relatedChapterId,String status){}
}
