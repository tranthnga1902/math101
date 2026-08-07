package com.math10.assignments.controller;
import com.math10.assignments.dto.AssignmentProgressResponse;
import com.math10.assignments.entity.*;
import com.math10.assignments.repository.*;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.time.LocalDateTime;
import com.math10.progress.entity.LearningProgress;
import com.math10.progress.repository.LearningProgressRepository;
@RestController @RequiredArgsConstructor @RequestMapping("/api/assignment-progress") @PreAuthorize("hasRole('STUDENT')")
public class AssignmentProgressController {
 private final AssignmentRepository assignments;private final AssignmentProgressRepository progress;private final ClassStudentRepository classStudents;private final CurrentUserService current;private final LearningProgressRepository learningProgress;
 @PatchMapping("/{assignmentId}/opened") @Transactional public ApiResponse<AssignmentProgressResponse> opened(@PathVariable Long assignmentId){AssignmentProgress p=get(assignmentId);if(p.getOpenedAt()==null)p.setOpenedAt(LocalDateTime.now());p.setCompletionPercent(Math.max(p.getCompletionPercent(),10));syncWorksheet(assignmentId,p,false);return ApiResponse.ok("Đã mở bài giao",map(progress.save(p)));}
 @PatchMapping("/{assignmentId}/completed") @Transactional public ApiResponse<AssignmentProgressResponse> completed(@PathVariable Long assignmentId){AssignmentProgress p=get(assignmentId);if(p.getOpenedAt()==null)p.setOpenedAt(LocalDateTime.now());p.setCompletedAt(LocalDateTime.now());p.setCompletionPercent(100);syncWorksheet(assignmentId,p,true);return ApiResponse.ok("Đã hoàn thành bài giao",map(progress.save(p)));}
 private AssignmentProgress get(Long id){Assignment a=assignments.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài giao"));Long student=current.requireUserId();if(!classStudents.existsByClassIdAndStudentId(a.getClassId(),student))throw new AccessDeniedException("Bài giao không thuộc lớp của bạn");return progress.findByAssignmentIdAndStudentId(id,student).orElseGet(()->{AssignmentProgress p=new AssignmentProgress();p.setAssignmentId(id);p.setStudentId(student);return p;});}
 private void syncWorksheet(Long assignmentId,AssignmentProgress assignmentProgress,boolean completed){Assignment assignment=assignments.findById(assignmentId).orElseThrow();if(assignment.getWorksheetId()==null)return;LearningProgress row=learningProgress.findByStudentIdAndWorksheetId(assignmentProgress.getStudentId(),assignment.getWorksheetId()).orElseGet(()->{LearningProgress created=new LearningProgress();created.setStudentId(assignmentProgress.getStudentId());created.setWorksheetId(assignment.getWorksheetId());return created;});if(row.getOpenedAt()==null)row.setOpenedAt(LocalDateTime.now());row.setStatus(completed?"COMPLETED":"IN_PROGRESS");row.setCompletionPercent(completed?100:Math.max(row.getCompletionPercent(),10));if(completed)row.setCompletedAt(LocalDateTime.now());learningProgress.save(row);}
 private AssignmentProgressResponse map(AssignmentProgress p){String s=p.getCompletedAt()!=null?"COMPLETED":p.getOpenedAt()!=null?"IN_PROGRESS":"NOT_OPENED";return new AssignmentProgressResponse(p.getAssignmentId(),p.getStudentId(),p.getOpenedAt(),p.getCompletedAt(),p.getCompletionPercent(),s);}
}
