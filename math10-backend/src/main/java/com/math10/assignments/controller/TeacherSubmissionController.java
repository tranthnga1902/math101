package com.math10.assignments.controller;

import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentProgress;
import com.math10.assignments.repository.AssignmentProgressRepository;
import com.math10.assignments.repository.AssignmentRepository;
import com.math10.assignments.service.SubmissionLogService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassTeacherRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.math.RoundingMode;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.mathcontent.repository.ProblemRepository;
import com.math10.worksheets.repository.WorksheetItemRepository;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teacher/submissions")
@PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
public class TeacherSubmissionController {
    private final JdbcTemplate jdbc;
    private final AssignmentProgressRepository progress;
    private final AssignmentRepository assignments;
    private final SubmissionLogService submissionLog;
    private final ClassTeacherRepository classTeachers;
    private final CurrentUserService current;
    private final WorksheetItemRepository worksheetItems;
    private final ProblemRepository problems;
    private final ObjectMapper objectMapper;

    @GetMapping("/assignments/{assignmentId}/analysis")
    public ApiResponse<List<Map<String,Object>>> analysis(@PathVariable Long assignmentId){Assignment assignment=assignments.findById(assignmentId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài giao"));checkClass(assignment.getClassId());if(assignment.getWorksheetId()==null)throw new BusinessException("Bài giao không phải phiếu đề");List<AssignmentProgress> submitted=progress.findByAssignmentId(assignmentId).stream().filter(x->x.getSubmittedAt()!=null).toList();List<Map<String,Object>> result=new ArrayList<>();for(var item:worksheetItems.findByWorksheetIdOrderByOrderIndex(assignment.getWorksheetId())){var problem=problems.findById(item.getProblemId()).orElseThrow();int correct=0;for(var row:submitted){String answer=readAnswers(row.getAnswerJson()).get(item.getProblemId());if(problem.getCorrectOption()!=null&&problem.getCorrectOption().equalsIgnoreCase(answer))correct++;}double rate=submitted.isEmpty()?0:Math.round(1000.0*correct/submitted.size())/10.0;Map<String,Object> value=new LinkedHashMap<>();value.put("problemId",problem.getId());value.put("orderNo",item.getOrderIndex());value.put("publicCode",problem.getPublicCode());value.put("correct",correct);value.put("total",submitted.size());value.put("rate",rate);value.put("warning",!submitted.isEmpty()&&rate<30);result.add(value);}return ApiResponse.ok("Phân tích câu hỏi",result);}

    @PostMapping("/assignments/{assignmentId}/regrade") @Transactional
    public ApiResponse<Map<String,Integer>> regrade(@PathVariable Long assignmentId){Assignment assignment=assignments.findById(assignmentId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài giao"));checkClass(assignment.getClassId());if(assignment.getWorksheetId()==null)throw new BusinessException("Bài giao không phải phiếu đề");var items=worksheetItems.findByWorksheetIdOrderByOrderIndex(assignment.getWorksheetId());int updated=0;for(var row:progress.findByAssignmentId(assignmentId)){if(row.getSubmittedAt()==null)continue;Map<Long,String> answers=readAnswers(row.getAnswerJson());int correct=0;for(var item:items){var problem=problems.findById(item.getProblemId()).orElseThrow();if(problem.getCorrectOption()!=null&&problem.getCorrectOption().equalsIgnoreCase(answers.get(item.getProblemId())))correct++;}row.setCorrectCount(correct);row.setTotalQuestions(items.size());row.setScore(BigDecimal.valueOf(correct).multiply(BigDecimal.TEN).divide(BigDecimal.valueOf(Math.max(items.size(),1)),2,RoundingMode.HALF_UP));row.setGradedAt(LocalDateTime.now());if(row.getReturnedAt()==null)row.setGradingStatus("GRADED");progress.save(row);updated++;}return ApiResponse.ok("Đã chấm lại toàn bộ bài nộp",Map.of("updated",updated));}

    /**
     * Hàng chờ chấm của một lớp. Chỉ bài BẮT BUỘC lọt vào đây: bài TỰ CHỌN cũng ghi submitted_at
     * (học sinh đánh dấu hoàn thành) nhưng theo cách chấm đã chốt thì nó chỉ đo mức tự giác,
     * không bao giờ ra điểm — nên phải chặn ngay từ danh sách để giáo viên không chấm nhầm.
     */
    @GetMapping
    public ApiResponse<List<Map<String,Object>>> list(@RequestParam Long classId) {
        checkClass(classId);
        return ApiResponse.ok("Danh sách bài nộp", jdbc.queryForList("""
            select ap.id,ap.assignment_id,a.title,ap.student_id,u.full_name,u.username,
                   ap.submitted_at,ap.graded_at,ap.returned_at,ap.score,ap.max_score,
                   ap.correct_count,ap.total_questions,ap.teacher_feedback,ap.grading_status,ap.answer_json
            from assignment_progress ap
            join assignments a on a.id=ap.assignment_id and a.deleted_at is null
            join users u on u.id=ap.student_id and u.deleted_at is null
            where a.class_id=? and a.requirement='BAT_BUOC' and ap.submitted_at is not null and ap.deleted_at is null
            order by ap.submitted_at desc
            """, classId));
    }

    @PutMapping("/{id}/grade")
    @Transactional
    public ApiResponse<Void> grade(@PathVariable Long id,@Valid @RequestBody GradeRequest request) {
        AssignmentProgress row=owned(id);
        if(row.getSubmittedAt()==null)throw new BusinessException("Học sinh chưa nộp bài");
        if(!"BAT_BUOC".equals(assignment(row).getRequirement()))throw new BusinessException("Bài tự chọn chỉ ghi nhận đã làm, không chấm điểm");
        row.setScore(request.score());row.setMaxScore(BigDecimal.TEN);row.setTeacherFeedback(request.feedback());
        row.setGradedAt(LocalDateTime.now());row.setGradingStatus("GRADED");row.setReturnedAt(null);progress.save(row);
        submissionLog.record(assignment(row),row.getStudentId(),"GRADED",row.getScore(),request.feedback());
        return ApiResponse.noContent("Đã lưu điểm");
    }

    @PatchMapping("/{id}/return")
    @Transactional
    public ApiResponse<Void> release(@PathVariable Long id) {
        AssignmentProgress row=owned(id);
        if(row.getScore()==null)throw new BusinessException("Phải chấm điểm trước khi trả bài");
        row.setReturnedAt(LocalDateTime.now());row.setGradingStatus("RETURNED");progress.save(row);
        submissionLog.record(assignment(row),row.getStudentId(),"RETURNED",row.getScore(),null);
        return ApiResponse.noContent("Đã trả điểm cho học sinh");
    }

    private Assignment assignment(AssignmentProgress row){
        return assignments.findById(row.getAssignmentId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài giao"));
    }

    private AssignmentProgress owned(Long id){
        AssignmentProgress row=progress.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài nộp"));
        Long classId=jdbc.queryForObject("select class_id from assignments where id=? and deleted_at is null",Long.class,row.getAssignmentId());
        checkClass(classId);return row;
    }
    private void checkClass(Long classId){if("ADMIN".equals(current.requireRoleCode()))return;if(!classTeachers.existsByClassIdAndTeacherId(classId,current.requireUserId()))throw new AccessDeniedException("Không có quyền truy cập lớp");}
    private Map<Long,String> readAnswers(String json){if(json==null||json.isBlank())return Map.of();try{Map<String,String> raw=objectMapper.readValue(json,new TypeReference<>(){});Map<Long,String> result=new LinkedHashMap<>();raw.forEach((key,value)->result.put(Long.valueOf(key),value));return result;}catch(Exception e){return Map.of();}}
    public record GradeRequest(@NotNull @DecimalMin("0") @DecimalMax("10") BigDecimal score,String feedback){}
}
