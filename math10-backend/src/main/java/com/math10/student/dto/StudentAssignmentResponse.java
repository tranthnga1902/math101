package com.math10.student.dto;
import java.time.LocalDateTime;
import java.util.List;
/**
 * {@code state} là trạng thái vòng đời tại thời điểm gọi. Bài SCHEDULED vẫn hiện tên để học sinh
 * biết sắp có bài, nhưng {@code items} rỗng — chưa tới giờ mở thì chưa được thấy đề.
 */
public record StudentAssignmentResponse(Long id,String title,LocalDateTime openAt,LocalDateTime dueAt,String status,String state,Long lessonId,Long worksheetId,String worksheetName,String progressStatus,Integer completionPercent,String gradingStatus,java.math.BigDecimal score,java.math.BigDecimal maxScore,Integer attemptsLeft,boolean submittedLate,List<Item> items){
 public record Item(Long problemId,Integer orderIndex,String publicCode,String qrSlug,String statementLatex,String difficulty,String optionA,String optionB,String optionC,String optionD){}
}
