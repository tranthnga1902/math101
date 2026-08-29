package com.math10.assignments.controller;
import com.math10.assignments.domain.AssignmentWindow;
import com.math10.audit.service.AuditService;
import com.math10.assignments.dto.*;
import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentState;
import com.math10.assignments.entity.LatePolicy;
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
import java.time.LocalDateTime;
import java.util.List;
import com.math10.lessons.repository.LessonRepository;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.enrollments.repository.ClassCourseRepository;
import com.math10.worksheets.repository.WorksheetRepository;
import com.math10.common.exception.BusinessException;
import org.springframework.jdbc.core.JdbcTemplate;
@RestController @RequiredArgsConstructor @RequestMapping("/api/assignments")
public class AssignmentController {
 private final AssignmentRepository repository; private final CurrentUserService current;
 private final ClassTeacherRepository classTeachers; private final ClassStudentRepository classStudents;
 private final LessonRepository lessons; private final ChapterRepository chapters; private final ClassCourseRepository classCourses; private final WorksheetRepository worksheets;
 private final com.math10.classes.repository.ClassDocumentRepository classDocuments;
 private final AuditService audit;
 private final JdbcTemplate jdbc;
 @GetMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
 public ApiResponse<List<AssignmentResponse>> list(@RequestParam Long classId){
  checkClassAccess(classId,false);
  LocalDateTime now=LocalDateTime.now();
  boolean student="STUDENT".equals(current.requireRoleCode());
  // Học sinh không được thấy bài giáo viên đang soạn. Trước đây danh sách trả về mọi trạng thái.
  return ApiResponse.ok("Danh sách bài giao",repository.findByClassIdOrderByCreatedAtDesc(classId).stream()
    .filter(a->!student||AssignmentWindow.stateOf(a,now).visibleToStudent()).map(this::map).toList());}
 @PostMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<AssignmentResponse> create(@Valid @RequestBody AssignmentRequest r){checkClassAccess(r.classId(),true);Assignment a=new Assignment();apply(a,r);a.setCreatedBy(current.requireUserId());AssignmentResponse saved=map(repository.save(a));audit.record("CREATE","ASSIGNMENT",saved.id(),null,saved.toString());return ApiResponse.created("Giao bài thành công",saved);}
 @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<AssignmentResponse> update(@PathVariable Long id,@Valid @RequestBody AssignmentRequest r){Assignment a=find(id);checkClassAccess(a.getClassId(),true);checkClassAccess(r.classId(),true);String old=map(a).toString();apply(a,r);AssignmentResponse after=map(a);audit.record("UPDATE","ASSIGNMENT",id,old,after.toString());return ApiResponse.ok("Cập nhật bài giao",after);}
 @DeleteMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<Void> delete(@PathVariable Long id){Assignment a=find(id);checkClassAccess(a.getClassId(),true);audit.record("DELETE","ASSIGNMENT",id,map(a).toString(),null);a.markDeleted();return ApiResponse.noContent("Xóa bài giao");}
 private void checkClassAccess(Long classId,boolean write){String role=current.requireRoleCode();if("ADMIN".equals(role))return;Long uid=current.requireUserId();boolean allowed="TEACHER".equals(role)&&classTeachers.existsByClassIdAndTeacherId(classId,uid);if(!write&&"STUDENT".equals(role))allowed=classStudents.existsByClassIdAndStudentId(classId,uid);if(!allowed)throw new AccessDeniedException("Không có quyền truy cập lớp");}
 private Assignment find(Long id){return repository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài giao"));}
 private void apply(Assignment a,AssignmentRequest r){
  int sources=(r.lessonId()!=null?1:0)+(r.worksheetId()!=null?1:0)+(r.documentId()!=null?1:0);
  if(sources!=1)throw new BusinessException("Chọn đúng một nguồn: bài học, phiếu bài tập, hoặc tài liệu");
  if(r.documentId()!=null&&!classDocuments.existsByClassIdAndDocumentId(r.classId(),r.documentId()))throw new BusinessException("Tài liệu chưa được gắn vào lớp này");
  String requirement=r.requirement()==null||r.requirement().isBlank()?"BAT_BUOC":r.requirement();
  if(!"BAT_BUOC".equals(requirement)&&!"TU_CHON".equals(requirement))throw new BusinessException("Loại nhiệm vụ không hợp lệ");
  if(r.openAt()!=null&&r.dueAt()!=null&&r.openAt().isAfter(r.dueAt()))throw new BusinessException("Giờ mở phải trước hạn nộp");
  LatePolicy latePolicy=LatePolicy.of(r.latePolicy());
  if(r.latePolicy()!=null&&!r.latePolicy().isBlank()&&!latePolicy.name().equalsIgnoreCase(r.latePolicy().trim()))throw new BusinessException("Chính sách nộp muộn không hợp lệ");
  int penalty=r.latePenaltyPercent()==null?0:r.latePenaltyPercent();
  if(latePolicy==LatePolicy.PENALTY&&penalty<=0)throw new BusinessException("Chọn trừ điểm nộp muộn thì phần trăm trừ phải lớn hơn 0");
  if(latePolicy!=LatePolicy.REJECT&&r.dueAt()==null)throw new BusinessException("Không đặt hạn nộp thì không có khái niệm nộp muộn");
  if(r.lessonId()!=null){var lesson=lessons.findById(r.lessonId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài học"));var chapter=chapters.findById(lesson.getChapterId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương"));if(!classCourses.existsByClassIdAndCourseId(r.classId(),chapter.getCourseId()))throw new BusinessException("Bài học không thuộc khóa học đã gán cho lớp");}if(r.worksheetId()!=null){var sheet=worksheets.findById(r.worksheetId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy phiếu bài tập"));if(!"ADMIN".equals(current.requireRoleCode())&&!sheet.getCreatedBy().equals(current.requireUserId()))throw new AccessDeniedException("Không có quyền giao phiếu bài tập này");}a.setClassId(r.classId());a.setLessonId(r.lessonId());a.setWorksheetId(r.worksheetId());a.setDocumentId(r.documentId());a.setTitle(r.title());a.setOpenAt(r.openAt());a.setDueAt(r.dueAt());a.setStatus(r.status());a.setRequirement(requirement);
  if(r.worksheetId()!=null){List<Long> publishedVersions=jdbc.queryForList("select id from worksheet_versions where worksheet_id=? and status='PUBLISHED' and deleted_at is null order by version desc limit 1",Long.class,r.worksheetId());if(!publishedVersions.isEmpty())a.setWorksheetVersionId(publishedVersions.get(0));}
  a.setMaxAttempts(r.maxAttempts()==null?1:r.maxAttempts());a.setLatePolicy(latePolicy.name());a.setLatePenaltyPercent(latePolicy==LatePolicy.PENALTY?penalty:0);a.setPublishScoreAt(r.publishScoreAt());}
 private AssignmentResponse map(Assignment a){AssignmentState state=AssignmentWindow.stateOf(a,LocalDateTime.now());return new AssignmentResponse(a.getId(),a.getClassId(),a.getLessonId(),a.getWorksheetId(),a.getDocumentId(),a.getTitle(),a.getOpenAt(),a.getDueAt(),a.getStatus(),state.name(),a.getRequirement(),a.getMaxAttempts(),a.getLatePolicy(),a.getLatePenaltyPercent(),a.getPublishScoreAt(),a.getCreatedBy());}
}
