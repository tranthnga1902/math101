package com.math10.assignments.controller;
import com.math10.assignments.domain.AssignmentWindow;
import com.math10.assignments.domain.NguoiNhan;
import com.math10.assignments.entity.AssignmentTarget;
import com.math10.assignments.support.NeoBuoi;
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
import java.util.*;
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
 private final NguoiNhan nguoiNhan; private final NeoBuoi neoBuoi;
 private final com.math10.assignments.repository.AssignmentTargetRepository targets;
 private final AuditService audit;
 private final JdbcTemplate jdbc;
 @GetMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
 public ApiResponse<List<AssignmentResponse>> list(@RequestParam Long classId){
  checkClassAccess(classId,false);
  LocalDateTime now=LocalDateTime.now();
  boolean student="STUDENT".equals(current.requireRoleCode());
  // Học sinh không được thấy bài giáo viên đang soạn. Trước đây danh sách trả về mọi trạng thái.
  Long uid=student?current.requireUserId():null;
  // Bài giao riêng cho vài em thì những em khác trong lớp không được biết là nó tồn tại.
  return ApiResponse.ok("Danh sách bài giao",repository.findByClassIdOrderByCreatedAtDesc(classId).stream()
    .filter(a->!student||(AssignmentWindow.stateOf(a,now).visibleToStudent()&&nguoiNhan.nhanDuoc(a,uid))).map(this::map).toList());}
 @PostMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<AssignmentResponse> create(@Valid @RequestBody AssignmentRequest r){checkClassAccess(r.classId(),true);Assignment a=new Assignment();apply(a,r);a.setCreatedBy(current.requireUserId());repository.save(a);datDoiTuong(a,r.studentIds());AssignmentResponse saved=map(a);audit.record("CREATE","ASSIGNMENT",saved.id(),null,saved.toString());return ApiResponse.created("Giao bài thành công",saved);}
 /**
  * Giao một lượt cho nhiều lớp: <b>N bài giao riêng biệt</b>, mỗi lớp một bài.
  *
  * <p>Không phải một bài dùng chung, vì mỗi lớp chốt buổi vào lúc khác nhau — hạn nộp của lớp A
  * không phải hạn của lớp B, và một dòng thì chỉ giữ được một cặp mốc giờ. Tách ra cũng là để
  * đóng/sửa/xoá riêng từng lớp mà không đụng lớp kia.
  */
 @PostMapping("/batch") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<List<AssignmentResponse>> batch(@Valid @RequestBody AssignmentBatchRequest r){
  if(r.classIds()==null||r.classIds().isEmpty())throw new BusinessException("Chọn ít nhất một lớp");
  // Học sinh chỉ thuộc một lớp, nên "nhiều lớp" và "chọn vài em" ghép lại là vô nghĩa — và cái vô
  // nghĩa mà vẫn chạy sẽ giao nhầm: danh sách của lớp A đem áp cho lớp B thành ra không ai nhận.
  if(r.classIds().size()>1&&r.studentIds()!=null&&!r.studentIds().isEmpty())
   throw new BusinessException("Giao nhiều lớp thì không chọn riêng học sinh được");
  List<AssignmentResponse> ket=new ArrayList<>();
  for(Long lop:new LinkedHashSet<>(r.classIds())){
   checkClassAccess(lop,true);
   Assignment a=new Assignment();apply(a,r.choLop(lop));a.setCreatedBy(current.requireUserId());
   repository.save(a);datDoiTuong(a,r.studentIds());
   AssignmentResponse saved=map(a);audit.record("CREATE","ASSIGNMENT",saved.id(),null,saved.toString());ket.add(saved);}
  return ApiResponse.created("Giao bài cho "+ket.size()+" lớp",ket);}
 @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<AssignmentResponse> update(@PathVariable Long id,@Valid @RequestBody AssignmentRequest r){Assignment a=find(id);checkClassAccess(a.getClassId(),true);checkClassAccess(r.classId(),true);String old=map(a).toString();apply(a,r);datDoiTuong(a,r.studentIds());AssignmentResponse after=map(a);audit.record("UPDATE","ASSIGNMENT",id,old,after.toString());return ApiResponse.ok("Cập nhật bài giao",after);}
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
  String taskKind=r.taskKind()==null||r.taskKind().isBlank()?"BAI_TAP":r.taskKind().trim().toUpperCase();
  if(!List.of("BAI_TAP","BAI_KIEM_TRA","LUYEN_TU_DO").contains(taskKind))throw new BusinessException("Loại nhiệm vụ không hợp lệ");
  String answerReveal=r.answerReveal()==null||r.answerReveal().isBlank()?"AFTER_RETURN":r.answerReveal().trim().toUpperCase();
  if(!List.of("AFTER_SUBMIT","AFTER_RETURN","IMMEDIATE").contains(answerReveal))throw new BusinessException("Mức hiện đáp án không hợp lệ");
  // Neo buổi thì hai mốc giờ gửi lên bị bỏ qua: chúng là kết quả, không phải đầu vào.
  int dem=r.dueBufferMinutes()==null?NeoBuoi.DEM_MAC_DINH:r.dueBufferMinutes();
  LocalDateTime openAt=r.openAt(),dueAt=r.dueAt();
  if(r.anchorPeriodId()!=null){NeoBuoi.Han han=neoBuoi.tinh(r.classId(),r.anchorPeriodId(),dem);openAt=han.moLuc();dueAt=han.hanNop();}
  if(openAt!=null&&dueAt!=null&&openAt.isAfter(dueAt))throw new BusinessException("Giờ mở phải trước hạn nộp");
  LatePolicy latePolicy=LatePolicy.of(r.latePolicy());
  if(r.latePolicy()!=null&&!r.latePolicy().isBlank()&&!latePolicy.name().equalsIgnoreCase(r.latePolicy().trim()))throw new BusinessException("Chính sách nộp muộn không hợp lệ");
  int penalty=r.latePenaltyPercent()==null?0:r.latePenaltyPercent();
  if(latePolicy==LatePolicy.PENALTY&&penalty<=0)throw new BusinessException("Chọn trừ điểm nộp muộn thì phần trăm trừ phải lớn hơn 0");
  // Bài neo buổi được miễn: hạn của nó do lịch khóa quyết định, và lịch chưa xếp tới đó thì hạn
  // tạm rỗng chứ không phải không có. Bắt lỗi ở đây là cấm giao bài trước khi xếp xong cả năm.
  if(latePolicy!=LatePolicy.REJECT&&dueAt==null&&r.anchorPeriodId()==null)throw new BusinessException("Không đặt hạn nộp thì không có khái niệm nộp muộn");
  if(r.lessonId()!=null){var lesson=lessons.findById(r.lessonId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài học"));var chapter=chapters.findById(lesson.getChapterId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương"));if(!classCourses.classHasProgram(r.classId(),chapter.getCourseId()))throw new BusinessException("Bài học không thuộc khóa học đã gán cho lớp");}if(r.worksheetId()!=null){var sheet=worksheets.findById(r.worksheetId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy phiếu bài tập"));if(!"ADMIN".equals(current.requireRoleCode())&&!sheet.getCreatedBy().equals(current.requireUserId()))throw new AccessDeniedException("Không có quyền giao phiếu bài tập này");
   // Phiếu nháp còn sửa được, và sửa sau khi giao thì học sinh mở ra thấy đề khác đề đã nộp.
   // Bắt phát hành trước là chỗ duy nhất khoá được: từ đó editable(id) đã tự từ chối mọi lần sửa.
   if(!"PUBLISHED".equals(sheet.getStatus()))throw new BusinessException("Phiếu còn là bản nháp; phát hành rồi mới giao được");}a.setClassId(r.classId());a.setLessonId(r.lessonId());a.setWorksheetId(r.worksheetId());a.setDocumentId(r.documentId());a.setTitle(r.title());a.setOpenAt(openAt);a.setDueAt(dueAt);a.setStatus(r.status());a.setRequirement(requirement);
  a.setAnchorPeriodId(r.anchorPeriodId());a.setDueBufferMinutes(dem);a.setTaskKind(taskKind);a.setAnswerReveal(answerReveal);
  a.setCountsInGradebook(r.countsInGradebook()==null||r.countsInGradebook());
  if(r.worksheetId()!=null){List<Long> publishedVersions=jdbc.queryForList("select id from worksheet_versions where worksheet_id=? and status='PUBLISHED' and deleted_at is null order by version desc limit 1",Long.class,r.worksheetId());if(!publishedVersions.isEmpty())a.setWorksheetVersionId(publishedVersions.get(0));}
  a.setMaxAttempts(r.maxAttempts()==null?1:r.maxAttempts());a.setLatePolicy(latePolicy.name());a.setLatePenaltyPercent(latePolicy==LatePolicy.PENALTY?penalty:0);a.setPublishScoreAt(r.publishScoreAt());}
 /**
  * Ghi lại danh sách em được chọn. Rỗng = cả lớp, và khi đó <b>xoá sạch</b> dòng cũ — đổi từ
  * "vài em" về "cả lớp" mà để dòng cũ lại thì phạm vi nói một đằng, bảng nói một nẻo.
  */
 private void datDoiTuong(Assignment a,List<Long> hocSinh){
  List<Long> chon=hocSinh==null?List.of():hocSinh.stream().filter(java.util.Objects::nonNull).distinct().toList();
  for(Long em:chon)if(!classStudents.existsByClassIdAndStudentId(a.getClassId(),em))throw new BusinessException("Có học sinh không thuộc lớp này");
  a.setTargetScope(chon.isEmpty()?"CLASS":"SELECTED");
  List<AssignmentTarget> cu=targets.findByAssignmentId(a.getId());
  for(AssignmentTarget t:cu)if(!chon.contains(t.getStudentId()))t.markDeleted();
  java.util.Set<Long> daCo=cu.stream().filter(t->t.getDeletedAt()==null).map(AssignmentTarget::getStudentId).collect(java.util.stream.Collectors.toSet());
  for(Long em:chon)if(!daCo.contains(em)){AssignmentTarget t=new AssignmentTarget();t.setAssignmentId(a.getId());t.setStudentId(em);targets.save(t);}}
 /** Nhãn người đọc hiểu được cho tiết neo: "Đại số · tiết 9 (tuần 12)". */
 private String nhanTiet(Long tietId){
  List<Map<String,Object>> d=jdbc.queryForList("""
    select ps.name strand,pp.period_no,pp.week_no,pp.title from program_periods pp
    join program_strands ps on ps.id=pp.strand_id and ps.deleted_at is null
    where pp.id=? and pp.deleted_at is null""",tietId);
  if(d.isEmpty())return null;Map<String,Object> t=d.get(0);
  return t.get("strand")+" · tiết "+t.get("period_no")+" (tuần "+t.get("week_no")+")";}
 private AssignmentResponse map(Assignment a){AssignmentState state=AssignmentWindow.stateOf(a,LocalDateTime.now());return new AssignmentResponse(a.getId(),a.getClassId(),a.getLessonId(),a.getWorksheetId(),a.getDocumentId(),a.getTitle(),a.getOpenAt(),a.getDueAt(),a.getStatus(),state.name(),a.getRequirement(),a.getMaxAttempts(),a.getLatePolicy(),a.getLatePenaltyPercent(),a.getPublishScoreAt(),a.getCreatedBy(),
  a.getAnchorPeriodId(),a.getAnchorPeriodId()==null?null:nhanTiet(a.getAnchorPeriodId()),a.getDueBufferMinutes(),
  // Chỉ đi hỏi lý do khi thật sự thiếu hạn — hỏi mỗi dòng là ba lượt truy vấn cho một câu chữ.
  a.getAnchorPeriodId()!=null&&a.getDueAt()==null?neoBuoi.tinh(a.getClassId(),a.getAnchorPeriodId(),a.getDueBufferMinutes()).lyDoTrong():null,
  a.getTaskKind(),a.getAnswerReveal(),a.getCountsInGradebook(),a.getTargetScope(),
  "SELECTED".equals(a.getTargetScope())?nguoiNhan.hocSinhDuocChon(a.getId()):List.of());}
}
