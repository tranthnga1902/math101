package com.math10.assignments.dto;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;
/**
 * {@code maxAttempts} bỏ trống = 1 lượt; 0 = không giới hạn. {@code latePolicy} bỏ trống = REJECT.
 *
 * <p>Có {@code anchorPeriodId} thì {@code openAt}/{@code dueAt} gửi lên bị bỏ qua: hai mốc ấy suy
 * ra từ buổi, và nhận cả hai nguồn cùng lúc là để dành chỗ cho hai câu trả lời khác nhau.
 *
 * <p>{@code studentIds} rỗng = cả lớp. Đây là <em>phạm vi</em> chứ không phải danh sách chốt: cả
 * lớp thì không ghi dòng nào, nên em vào lớp muộn tự có bài.
 */
public record AssignmentRequest(@NotNull Long classId,Long lessonId,Long worksheetId,Long documentId,@NotBlank String title,
        LocalDateTime openAt,LocalDateTime dueAt,@NotBlank String status,String requirement,
        @Min(0) @Max(50) Integer maxAttempts,String latePolicy,@Min(0) @Max(100) Integer latePenaltyPercent,
        LocalDateTime publishScoreAt,
        Long anchorPeriodId,@Min(0) @Max(20160) Integer dueBufferMinutes,String taskKind,String answerReveal,
        Boolean countsInGradebook,List<Long> studentIds){}
