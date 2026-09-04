package com.math10.assignments.controller;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.assignments.domain.NguoiNhan;
import com.math10.assignments.entity.*;
import com.math10.assignments.repository.*;
import com.math10.assignments.service.SubmissionLogService;
import com.math10.common.exception.BusinessException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.assignments.service.WorksheetAnswerKeys;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import java.time.LocalDateTime;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;
import com.math10.progress.repository.LearningProgressRepository;
import org.springframework.jdbc.core.JdbcTemplate;
/**
 * Ở đây kiểm phần nối dây: controller có thật sự hỏi {@link com.math10.assignments.domain.AssignmentWindow}
 * trước khi ghi hay không. Bản thân luật vòng đời đã có test riêng trong {@code AssignmentWindowTest}.
 *
 * <p>Cổng "bài này có dành cho em không" đi qua {@link NguoiNhan} chứ không hỏi thẳng bảng lớp nữa:
 * từ khi có bài giao cho nhóm học sinh, thuộc lớp là điều kiện cần chứ không còn là điều kiện đủ.
 */
class AssignmentProgressControllerTest {
 private final AssignmentRepository assignments=mock(AssignmentRepository.class);
 private final AssignmentProgressRepository progress=mock(AssignmentProgressRepository.class);
 private final NguoiNhan nguoiNhan=mock(NguoiNhan.class);
 private final CurrentUserService current=mock(CurrentUserService.class);

 @Test void studentCompletesOwnClassAssignment(){
  giaoBai(mo());
  var result=controller().completed(3L).data();
  assertThat(result.status()).isEqualTo("COMPLETED");assertThat(result.completionPercent()).isEqualTo(100);
 }
 @Test void rejectsAssignmentFromAnotherClass(){
  Assignment a=mo();a.setClassId(4L);when(assignments.findById(3L)).thenReturn(Optional.of(a));when(current.requireUserId()).thenReturn(7L);
  assertThatThrownBy(()->controller().opened(3L)).isInstanceOf(AccessDeniedException.class);
 }
 @Test void rejectsAssignmentStillInDraft(){
  // Bài giáo viên đang soạn: học sinh có gọi thẳng API cũng không ghi được gì.
  Assignment a=mo();a.setStatus("DRAFT");giaoBai(a);
  assertThatThrownBy(()->controller().completed(3L)).isInstanceOf(BusinessException.class).hasMessageContaining("chưa được mở");
 }
 @Test void rejectsAssignmentPastDue(){
  Assignment a=mo();a.setDueAt(LocalDateTime.now().minusHours(1));giaoBai(a);
  assertThatThrownBy(()->controller().completed(3L)).isInstanceOf(BusinessException.class).hasMessageContaining("quá hạn");
 }

 private Assignment mo(){Assignment a=new Assignment();a.setId(3L);a.setClassId(4L);a.setStatus("PUBLISHED");return a;}
 private void giaoBai(Assignment a){
  when(assignments.findById(3L)).thenReturn(Optional.of(a));when(current.requireUserId()).thenReturn(7L);
  when(nguoiNhan.nhanDuoc(a,7L)).thenReturn(true);
  when(progress.findByAssignmentIdAndStudentId(3L,7L)).thenReturn(Optional.empty());
  when(progress.save(any())).thenAnswer(x->x.getArgument(0));
 }
 private AssignmentProgressController controller(){
  return new AssignmentProgressController(assignments,progress,mock(SubmissionLogService.class),nguoiNhan,current,
    mock(LearningProgressRepository.class),mock(WorksheetAnswerKeys.class),mock(SubmissionItemGradeRepository.class),new ObjectMapper(),mock(JdbcTemplate.class));
 }
}
