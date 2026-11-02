package com.math10.worksheets.dto;
import jakarta.validation.constraints.*;
import java.util.List;
public final class WorksheetDtos {
 private WorksheetDtos(){}
 public record Request(@NotBlank String name,@NotNull @Min(1) @Max(2) Integer columnsCount,@NotNull Boolean showQr,@NotNull Boolean showStudentFields,@NotEmpty List<@NotNull Long> problemIds){}
 /**
  * Một câu trên phiếu. {@code contentSnapshot} khác rỗng nghĩa là câu này do xưởng nội dung dựng
  * nên và <b>sửa hẹp được</b> ngay trên phiếu đã phát hành; rỗng nghĩa là câu lấy thẳng từ ngân
  * hàng bài, muốn đổi thì sửa ở ngân hàng hoặc nhân bản phiếu. Màn hình phải phân biệt được hai
  * loại ấy, nếu không nút "sửa câu" sẽ hiện ra rồi báo lỗi ở nửa số câu.
  */
 public record Item(Long id,Long problemId,Integer orderIndex,String publicCode,String qrSlug,String statementLatex,String difficulty,
   String contentSnapshot,String answerSnapshot){}
 /** {@code status} là DRAFT hay PUBLISHED — chỉ phiếu đã phát hành mới giao được, nên màn giao bài
  * phải đọc được nó thay vì bấm lưu rồi mới biết. */
 public record Response(Long id,String name,Integer columnsCount,Boolean showQr,Boolean showStudentFields,Long createdBy,Long lessonId,String status,List<Item> items){}
}
