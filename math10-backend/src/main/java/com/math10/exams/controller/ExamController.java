package com.math10.exams.controller;
import com.math10.audit.service.AuditService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassTeacherRepository;
import com.math10.exams.dto.ExamRequest;
import com.math10.exams.dto.ExamResponse;
import com.math10.exams.entity.Exam;
import com.math10.exams.repository.ExamRepository;
import com.math10.exams.service.ExamService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;
/**
 * Kì thi của admin và của giáo viên là <b>một cửa</b>, khác nhau ở tầm với chứ không ở cách làm:
 * admin ra đề chung cho khóa, giáo viên ra đề cho lớp mình. Tách thành hai controller thì hai
 * bên sẽ trôi lệch từng chút một, mà người dùng lại yêu cầu chúng "tương tự nhau".
 *
 * <p>Tầm với (khóa hay lớp) tách khỏi quyền đọc: {@code scope} chỉ nói kì thi rơi xuống những lớp
 * nào, còn ai xem được bài thi vẫn do cổng đọc của bài giao quyết định như mọi bài khác.
 */
@RestController @RequiredArgsConstructor @RequestMapping("/api/exams")
public class ExamController {
 private final ExamRepository repository; private final ExamService service;
 private final CurrentUserService current; private final ClassTeacherRepository classTeachers;
 private final AuditService audit; private final JdbcTemplate jdbc;

 /**
  * Giáo viên thấy kì thi của lớp mình, <b>và</b> kì thi khóa chạm tới lớp mình — kì thi chung do
  * admin ra vẫn là kì thi học sinh của họ phải làm, giấu đi thì giáo viên không biết mà chuẩn bị.
  */
 @GetMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
 public ApiResponse<List<ExamResponse>> list(@RequestParam(required=false) String scope,@RequestParam(required=false) Long classId,@RequestParam(required=false) Long courseInstanceId){
  List<Exam> rows=classId!=null?repository.findByClassIdOrderByCreatedAtDesc(classId)
    :courseInstanceId!=null?repository.findByCourseInstanceIdOrderByCreatedAtDesc(courseInstanceId)
    :scope!=null&&!scope.isBlank()?repository.findByScopeOrderByCreatedAtDesc(scope.trim().toUpperCase())
    :repository.findAll();
  boolean admin=admin();
  Set<Long> lopCuaToi=admin?Set.of():new HashSet<>(jdbc.queryForList("select class_id from class_teachers where teacher_id=? and deleted_at is null",Long.class,current.requireUserId()));
  List<ExamResponse> ket=new ArrayList<>();
  for(Exam e:rows){
   if(!admin&&!chamToiLop(e,lopCuaToi))continue;
   ket.add(map(e));
  }
  ket.sort(Comparator.comparing(ExamResponse::createdAt,Comparator.nullsLast(Comparator.reverseOrder())));
  return ApiResponse.ok("Danh sách kì thi",ket);}

 @PostMapping @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<ExamResponse> create(@Valid @RequestBody ExamRequest r){
  Exam e=new Exam();apply(e,r);e.setCreatedBy(current.requireUserId());repository.save(e);
  ExamResponse saved=map(e);audit.record("CREATE","EXAM",e.getId(),null,saved.toString());
  return ApiResponse.created("Đã tạo kì thi",saved);}

 @PutMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<ExamResponse> update(@PathVariable Long id,@Valid @RequestBody ExamRequest r){
  Exam e=find(id);quyenGhi(e);String cu=map(e).toString();apply(e,r);
  // Đã phát hành mà sửa đề hoặc giờ thì các bài con phải đi theo, nếu không thì bảng nói một đằng
  // còn học sinh làm một nẻo.
  if("PUBLISHED".equals(e.getStatus()))service.phatHanh(e);
  ExamResponse sau=map(e);audit.record("UPDATE","EXAM",id,cu,sau.toString());
  return ApiResponse.ok("Đã cập nhật kì thi",sau);}

 @PostMapping("/{id}/publish") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<ExamResponse> publish(@PathVariable Long id){
  Exam e=find(id);quyenGhi(e);int soLop=service.phatHanh(e);e.setStatus("PUBLISHED");
  audit.record("PUBLISH","EXAM",id,null,"classes="+soLop);
  return ApiResponse.ok("Đã phát hành tới "+soLop+" lớp",map(e));}

 @PostMapping("/{id}/close") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<ExamResponse> close(@PathVariable Long id){
  Exam e=find(id);quyenGhi(e);int n=service.dong(e);e.setStatus("CLOSED");
  audit.record("CLOSE","EXAM",id,null,"assignments="+n);
  return ApiResponse.ok("Đã đóng kì thi và "+n+" bài giao",map(e));}

 @DeleteMapping("/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") @Transactional
 public ApiResponse<Void> delete(@PathVariable Long id){
  Exam e=find(id);quyenGhi(e);service.dong(e);audit.record("DELETE","EXAM",id,map(e).toString(),null);
  e.markDeleted();return ApiResponse.noContent("Đã xoá kì thi");}

 private Exam find(Long id){return repository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy kì thi"));}
 private boolean admin(){return "ADMIN".equals(current.requireRoleCode());}

 private boolean chamToiLop(Exam e,Set<Long> lopCuaToi){
  if("CLASS".equals(e.getScope()))return lopCuaToi.contains(e.getClassId());
  for(Long lop:service.lopCuaKiThi(e))if(lopCuaToi.contains(lop))return true;
  return false;}

 /**
  * Kì thi chung của khóa là quyết định ở tầm trung tâm: giáo viên đọc được, nhưng không ra được
  * và không sửa được — một lớp sửa kì thi chung thì các lớp khác của khóa đổi theo mà không biết.
  */
 private void quyenGhi(Exam e){
  if(admin())return;
  if(!"CLASS".equals(e.getScope()))throw new AccessDeniedException("Kì thi chung của khóa do quản trị lập");
  if(!classTeachers.existsByClassIdAndTeacherId(e.getClassId(),current.requireUserId()))throw new AccessDeniedException("Không có quyền với lớp này");}

 private void apply(Exam e,ExamRequest r){
  String scope=r.scope()==null?"":r.scope().trim().toUpperCase();
  if(!List.of("COURSE","CLASS").contains(scope))throw new BusinessException("Phạm vi kì thi không hợp lệ");
  e.setScope(scope);
  // Giữ đúng ràng buộc ck_exam_reach: đặt rỗng cột không thuộc phạm vi, thay vì để sót giá trị cũ
  // khi người dùng đổi phạm vi.
  e.setCourseInstanceId("COURSE".equals(scope)?r.courseInstanceId():null);
  e.setClassId("CLASS".equals(scope)?r.classId():null);
  if("COURSE".equals(scope)&&e.getCourseInstanceId()==null)throw new BusinessException("Chọn khóa cho kì thi chung");
  if("CLASS".equals(scope)&&e.getClassId()==null)throw new BusinessException("Chọn lớp cho kì thi");
  quyenGhi(e);
  e.setTitle(r.title());e.setDescription(r.description());
  e.setWorksheetVersionId(r.worksheetVersionId());
  e.setWorksheetId(r.worksheetId()!=null?r.worksheetId():worksheetCuaBan(r.worksheetVersionId()));
  if(r.worksheetVersionId()!=null){
   List<String> tt=jdbc.queryForList("select status from worksheet_versions where id=? and deleted_at is null",String.class,r.worksheetVersionId());
   if(tt.isEmpty())throw new ResourceNotFoundException("Không tìm thấy đề");
   // Bản nháp còn sửa được, mà sửa sau khi thi thì đề đã nộp khác đề đang xem.
   if(!"PUBLISHED".equals(tt.get(0)))throw new BusinessException("Đề còn là bản nháp; phát hành đề rồi mới gắn vào kì thi");}
  e.setDurationMinutes(r.durationMinutes());
  e.setAnchorPeriodId(r.anchorPeriodId());
  // Neo buổi thì hai mốc giờ là kết quả tính theo lịch từng lớp, không phải đầu vào.
  e.setOpenAt(r.anchorPeriodId()!=null?null:r.openAt());
  e.setDueAt(r.anchorPeriodId()!=null?null:r.dueAt());
  if(e.getOpenAt()!=null&&e.getDueAt()!=null&&e.getOpenAt().isAfter(e.getDueAt()))throw new BusinessException("Giờ mở phải trước hạn nộp");
  e.setMaxAttempts(r.maxAttempts()==null?1:Math.max(0,r.maxAttempts()));
  String late=r.latePolicy()==null||r.latePolicy().isBlank()?"REJECT":r.latePolicy().trim().toUpperCase();
  if(!List.of("REJECT","ACCEPT","PENALTY").contains(late))throw new BusinessException("Chính sách nộp muộn không hợp lệ");
  e.setLatePolicy(late);
  String reveal=r.answerReveal()==null||r.answerReveal().isBlank()?"AFTER_RETURN":r.answerReveal().trim().toUpperCase();
  if(!List.of("AFTER_SUBMIT","AFTER_RETURN","IMMEDIATE").contains(reveal))throw new BusinessException("Mức hiện đáp án không hợp lệ");
  e.setAnswerReveal(reveal);
  e.setCountsInGradebook(r.countsInGradebook()==null||r.countsInGradebook());}

 private Long worksheetCuaBan(Long versionId){
  if(versionId==null)return null;
  List<Long> w=jdbc.queryForList("select worksheet_id from worksheet_versions where id=? and deleted_at is null",Long.class,versionId);
  return w.isEmpty()?null:w.get(0);}

 private ExamResponse map(Exam e){
  String tenKhoa=e.getCourseInstanceId()==null?null:motChuoi("select name from course_instances where id=?",e.getCourseInstanceId());
  String tenLop=e.getClassId()==null?null:motChuoi("select name from classes where id=?",e.getClassId());
  String tenDe=e.getWorksheetId()==null?null:motChuoi("select name from worksheets where id=?",e.getWorksheetId());
  return new ExamResponse(e.getId(),e.getScope(),e.getCourseInstanceId(),e.getClassId(),tenKhoa,tenLop,
    e.getTitle(),e.getDescription(),e.getWorksheetId(),e.getWorksheetVersionId(),tenDe,
    e.getDurationMinutes(),e.getOpenAt(),e.getDueAt(),e.getAnchorPeriodId(),
    e.getMaxAttempts(),e.getLatePolicy(),e.getAnswerReveal(),e.getCountsInGradebook(),
    e.getStatus(),service.lopCuaKiThi(e).size(),service.soBaiGiao(e.getId()),e.getCreatedAt());}

 private String motChuoi(String sql,Long id){
  List<String> rows=jdbc.queryForList(sql,String.class,id);
  return rows.isEmpty()?null:rows.get(0);}
}
