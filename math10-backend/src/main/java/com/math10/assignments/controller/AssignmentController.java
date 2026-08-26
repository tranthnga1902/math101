package com.math10.assignments.controller;
import com.math10.assignments.dto.*;
import com.math10.assignments.entity.Assignment;
import com.math10.assignments.repository.AssignmentRepository;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassTeacherRepository;
import com.math10.enrollments.repository.ClassStudentRepository;
import org.springframework.security.access.AccessDeniedException;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import com.math10.lessons.repository.LessonRepository;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.enrollments.repository.ClassCourseRepository;
import com.math10.worksheets.repository.WorksheetRepository;
import com.math10.common.exception.BusinessException;
@RestController @RequiredArgsConstructor @RequestMapping("/api/assignments")
public class AssignmentController {
 private final AssignmentRepository repository; private final CurrentUserService current;
 private final ClassTeacherRepository classTeachers; private final ClassStudentRepository classStudents;
 private final LessonRepository lessons; private final ChapterRepository chapters; private final ClassCourseRepository classCourses; private final WorksheetRepository worksheets;
 private final com.math10.classes.repository.ClassDocumentRepository classDocuments;
 @GetMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
 public ApiResponse<List<AssignmentResponse>> list(@RequestParam Long classId){checkClassAccess(classId,false);return ApiResponse.ok("Danh sách bài giao",repository.findByClassIdOrderByCreatedAtDesc(classId).stream().map(this::map).toList());}
 @PostMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<AssignmentResponse> create(@Valid @RequestBody AssignmentRequest r){checkClassAccess(r.classId(),true);Assignment a=new Assignment();apply(a,r);a.setCreatedBy(current.requireUserId());return ApiResponse.created("Giao bài thành công",map(repository.save(a)));}
 @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<AssignmentResponse> update(@PathVariable Long id,@Valid @RequestBody AssignmentRequest r){Assignment a=find(id);checkClassAccess(a.getClassId(),true);checkClassAccess(r.classId(),true);apply(a,r);return ApiResponse.ok("Cập nhật bài giao",map(a));}
 @DeleteMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<Void> delete(@PathVariable Long id){Assignment a=find(id);checkClassAccess(a.getClassId(),true);a.markDeleted();return ApiResponse.noContent("Xóa bài giao");}
 private void checkClassAccess(Long classId,boolean write){String role=current.requireRoleCode();if("ADMIN".equals(role))return;Long uid=current.requireUserId();boolean allowed="TEACHER".equals(role)&&classTeachers.existsByClassIdAndTeacherId(classId,uid);if(!write&&"STUDENT".equals(role))allowed=classStudents.existsByClassIdAndStudentId(classId,uid);if(!allowed)throw new AccessDeniedException("Không có quyền truy cập lớp");}
 private Assignment find(Long id){return repository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài giao"));}
 private void apply(Assignment a,AssignmentRequest r){
  int sources=(r.lessonId()!=null?1:0)+(r.worksheetId()!=null?1:0)+(r.documentId()!=null?1:0);
  if(sources!=1)throw new BusinessException("Chọn đúng một nguồn: bài học, phiếu bài tập, hoặc tài liệu");
  if(r.documentId()!=null&&!classDocuments.existsByClassIdAndDocumentId(r.classId(),r.documentId()))throw new BusinessException("Tài liệu chưa được gắn vào lớp này");
  String requirement=r.requirement()==null||r.requirement().isBlank()?"BAT_BUOC":r.requirement();
  if(!"BAT_BUOC".equals(requirement)&&!"TU_CHON".equals(requirement))throw new BusinessException("Loại nhiệm vụ không hợp lệ");
  if(r.lessonId()!=null){var lesson=lessons.findById(r.lessonId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài học"));var chapter=chapters.findById(lesson.getChapterId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương"));if(!classCourses.existsByClassIdAndCourseId(r.classId(),chapter.getCourseId()))throw new BusinessException("Bài học không thuộc khóa học đã gán cho lớp");}if(r.worksheetId()!=null){var sheet=worksheets.findById(r.worksheetId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy phiếu bài tập"));if(!"ADMIN".equals(current.requireRoleCode())&&!sheet.getCreatedBy().equals(current.requireUserId()))throw new AccessDeniedException("Không có quyền giao phiếu bài tập này");}a.setClassId(r.classId());a.setLessonId(r.lessonId());a.setWorksheetId(r.worksheetId());a.setDocumentId(r.documentId());a.setTitle(r.title());a.setDueAt(r.dueAt());a.setStatus(r.status());a.setRequirement(requirement);}
 private AssignmentResponse map(Assignment a){return new AssignmentResponse(a.getId(),a.getClassId(),a.getLessonId(),a.getWorksheetId(),a.getDocumentId(),a.getTitle(),a.getDueAt(),a.getStatus(),a.getRequirement(),a.getCreatedBy());}
}
