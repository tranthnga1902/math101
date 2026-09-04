package com.math10.assignments.dto;
import jakarta.validation.constraints.*;
import java.time.LocalDateTime;
import java.util.List;
/**
 * Giao một phiếu cho nhiều lớp cùng lúc.
 *
 * <p>Giống {@link AssignmentRequest} nhưng thay {@code classId} bằng {@code classIds}. Không kế
 * thừa và cũng không nhét {@code classIds} vào bản cũ: cửa một lớp phải giữ được {@code @NotNull}
 * trên {@code classId}, mà một trường vừa bắt buộc vừa không thì không kiểm được nữa.
 */
public record AssignmentBatchRequest(@NotEmpty List<Long> classIds,Long lessonId,Long worksheetId,Long documentId,
        @NotBlank String title,LocalDateTime openAt,LocalDateTime dueAt,@NotBlank String status,String requirement,
        @Min(0) @Max(50) Integer maxAttempts,String latePolicy,@Min(0) @Max(100) Integer latePenaltyPercent,
        LocalDateTime publishScoreAt,
        Long anchorPeriodId,@Min(0) @Max(20160) Integer dueBufferMinutes,String taskKind,String answerReveal,
        Boolean countsInGradebook,List<Long> studentIds){

    /** Cắt ra bản một lớp để đi qua đúng đường kiểm tra của {@code AssignmentRequest}. */
    public AssignmentRequest choLop(Long classId){
        return new AssignmentRequest(classId,lessonId,worksheetId,documentId,title,openAt,dueAt,status,requirement,
                maxAttempts,latePolicy,latePenaltyPercent,publishScoreAt,
                anchorPeriodId,dueBufferMinutes,taskKind,answerReveal,countsInGradebook,studentIds);
    }
}
