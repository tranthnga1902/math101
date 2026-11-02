package com.math10.student.dto;
import java.time.LocalDateTime;
import java.util.List;
/**
 * {@code state} là trạng thái vòng đời tại thời điểm gọi. Bài SCHEDULED vẫn hiện tên để học sinh
 * biết sắp có bài, nhưng {@code items} rỗng — chưa tới giờ mở thì chưa được thấy đề.
 */
public record StudentAssignmentResponse(Long id,String title,LocalDateTime openAt,LocalDateTime dueAt,String status,String state,Long lessonId,Long worksheetId,String worksheetName,String progressStatus,Integer completionPercent,String gradingStatus,java.math.BigDecimal score,java.math.BigDecimal maxScore,Integer attemptsLeft,boolean submittedLate,String requirement,List<Item> items){
 /**
  * {@code essay} true là câu tự luận — màn hình làm bài cho ô gõ chữ thay vì bốn nút A/B/C/D.
  * Cờ này do server tính chứ không để màn hình tự đoán từ bốn cột {@code optionA..D}: đề nhập từ
  * PDF in phương án ngay trong đề bài nên bốn cột ấy trống, màn hình đoán ra "tự luận", học sinh
  * gõ chữ, rồi server — vốn coi đó là trắc nghiệm — trả về "Đáp án không hợp lệ" mà không ai
  * hiểu vì sao. Chỉ có một bản luật, ở {@code McqGrading.laTracNghiem}.
  *
  * <p>Không có {@code correctOption}: đây là đường đi tới máy học sinh.
  */
 public record Item(Long problemId,Integer orderIndex,String publicCode,String qrSlug,String statementLatex,String difficulty,String optionA,String optionB,String optionC,String optionD,boolean essay){}
}
