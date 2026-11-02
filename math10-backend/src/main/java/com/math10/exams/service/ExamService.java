package com.math10.exams.service;
import com.math10.assignments.entity.Assignment;
import com.math10.assignments.repository.AssignmentRepository;
import com.math10.assignments.support.NeoBuoi;
import com.math10.common.exception.BusinessException;
import com.math10.exams.entity.Exam;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.List;
/**
 * Phát hành kì thi = vật hóa nó thành bài giao, mỗi lớp một bài.
 *
 * <p>Vì sao không dựng luồng nộp bài riêng cho thi: học sinh làm bài kiểm tra bằng đúng màn làm
 * phiếu, giáo viên chấm bằng đúng màn chấm, điểm vào đúng sổ điểm. Một hệ thống song song thì sẽ
 * có hai bộ luật hạn nộp và hai bộ luật lộ đáp án, rồi chúng trôi lệch nhau.
 *
 * <p>Vì sao mỗi lớp một bài giao chứ không một bài dùng chung: mỗi lớp chốt buổi vào ngày khác
 * nhau, nên hạn nộp của lớp A không phải hạn của lớp B — một dòng chỉ giữ được một cặp mốc giờ.
 * Đây cũng là lối đã chọn cho {@code POST /api/assignments/batch}.
 */
@Service @RequiredArgsConstructor
public class ExamService {
 private final AssignmentRepository baiGiao;
 private final NeoBuoi neoBuoi;
 private final JdbcTemplate jdbc;

 /** Các lớp kì thi này chạm tới. Khóa thì tra {@code class_courses}; lớp thì chính nó. */
 public List<Long> lopCuaKiThi(Exam kiThi){
  if("CLASS".equals(kiThi.getScope()))return List.of(kiThi.getClassId());
  return jdbc.queryForList("select cc.class_id from class_courses cc join classes c on c.id=cc.class_id and c.deleted_at is null where cc.course_instance_id=? and cc.deleted_at is null order by cc.class_id",Long.class,kiThi.getCourseInstanceId());
 }

 /** Đã rơi xuống mấy lớp — để màn hình nói được "đã phát hành tới 4/5 lớp". */
 public int soBaiGiao(Long kiThiId){
  Integer n=jdbc.queryForObject("select count(*) from assignments where exam_id=? and deleted_at is null",Integer.class,kiThiId);
  return n==null?0:n;
 }

 /**
  * Tạo hoặc cập nhật một bài giao cho mỗi lớp. Chạy lại lần hai không nhân đôi: chỉ mục duy nhất
  * {@code uq_assignment_exam_class} là ranh giới, còn ở đây thì tra trước rồi sửa tại chỗ.
  *
  * <p>Lớp mới vào khóa sau khi đã phát hành: bấm phát hành lần nữa là lớp ấy có bài, các lớp cũ
  * chỉ được cập nhật chứ không sinh thêm.
  */
 public int phatHanh(Exam kiThi){
  if(kiThi.getWorksheetVersionId()==null)throw new BusinessException("Chọn đề đã phát hành trước khi phát hành kì thi");
  List<Long> lop=lopCuaKiThi(kiThi);
  if(lop.isEmpty())throw new BusinessException("Khóa này chưa có lớp nào để nhận kì thi");
  for(Long lopId:lop)ghiBaiGiao(kiThi,lopId);
  return lop.size();
 }

 private void ghiBaiGiao(Exam kiThi,Long lopId){
  List<Long> cu=jdbc.queryForList("select id from assignments where exam_id=? and class_id=? and deleted_at is null limit 1",Long.class,kiThi.getId(),lopId);
  Assignment bai=cu.isEmpty()?new Assignment():baiGiao.findById(cu.get(0)).orElseGet(Assignment::new);
  bai.setClassId(lopId);
  bai.setExamId(kiThi.getId());
  bai.setTitle(kiThi.getTitle());
  bai.setWorksheetId(kiThi.getWorksheetId());
  bai.setWorksheetVersionId(kiThi.getWorksheetVersionId());
  // Đây là chỗ duy nhất task_kind được đặt cứng: bài này sinh ra từ một kì thi, không phải từ
  // biểu mẫu giao bài, nên không có ai để chọn.
  bai.setTaskKind("BAI_KIEM_TRA");
  bai.setStatus("PUBLISHED");
  bai.setMaxAttempts(kiThi.getMaxAttempts()==null?1:kiThi.getMaxAttempts());
  bai.setLatePolicy(kiThi.getLatePolicy());
  bai.setAnswerReveal(kiThi.getAnswerReveal());
  bai.setCountsInGradebook(kiThi.getCountsInGradebook());
  bai.setAnchorPeriodId(kiThi.getAnchorPeriodId());
  if(bai.getCreatedBy()==null)bai.setCreatedBy(kiThi.getCreatedBy());
  // Neo buổi thì mốc giờ là *của lớp*: cùng một kì thi, lớp chốt buổi sớm thì mở sớm. Không neo
  // thì dùng mốc tuyệt đối của kì thi, giống nhau cho mọi lớp.
  if(kiThi.getAnchorPeriodId()!=null){
   NeoBuoi.Han han=neoBuoi.tinh(lopId,kiThi.getAnchorPeriodId(),bai.getDueBufferMinutes());
   bai.setOpenAt(han.moLuc());bai.setDueAt(han.hanNop());
  }else{bai.setOpenAt(kiThi.getOpenAt());bai.setDueAt(kiThi.getDueAt());}
  baiGiao.save(bai);
 }

 /**
  * Đóng kì thi thì đóng luôn các bài con. Để bài con mở tiếp thì kì thi "đã đóng" chỉ là một chữ
  * trên màn hình, còn học sinh vẫn nộp được — trạng thái nói một đằng, cổng nộp làm một nẻo.
  */
 public int dong(Exam kiThi){
  int n=0;
  for(Long id:jdbc.queryForList("select id from assignments where exam_id=? and deleted_at is null",Long.class,kiThi.getId())){
   Assignment bai=baiGiao.findById(id).orElse(null);
   if(bai==null)continue;
   bai.setStatus("CLOSED");baiGiao.save(bai);n++;
  }
  return n;
 }
}
