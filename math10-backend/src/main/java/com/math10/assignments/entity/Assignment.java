package com.math10.assignments.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
import java.time.LocalDateTime;
@Getter @Setter @Entity @Table(name="assignments") @SQLRestriction("deleted_at IS NULL")
public class Assignment extends BaseEntity {
 @Column(name="class_id",nullable=false) private Long classId;
 @Column(name="lesson_id") private Long lessonId;
 @Column(name="worksheet_id") private Long worksheetId;
 @Column(name="worksheet_version_id") private Long worksheetVersionId;
 @Column(name="document_id") private Long documentId;
 @Column(nullable=false) private String title;
 /** Giờ mở. Null = mở ngay khi trạng thái chuyển sang PUBLISHED. */
 @Column(name="open_at") private LocalDateTime openAt;
 @Column(name="due_at") private LocalDateTime dueAt;
 @Column(nullable=false) private String status;
 /** BAT_BUOC: có điểm, vào sổ. TU_CHON: chỉ tính hoàn thành, không trộn vào điểm. */
 @Column(nullable=false,length=20) private String requirement="BAT_BUOC";
 /** Số lần được nộp. 0 = không giới hạn. */
 @Column(name="max_attempts",nullable=false) private Integer maxAttempts=1;
 @Column(name="late_policy",nullable=false,length=20) private String latePolicy=LatePolicy.REJECT.name();
 @Column(name="late_penalty_percent",nullable=false) private Integer latePenaltyPercent=0;
 /** Tới giờ này thì điểm tự hiện cho học sinh, không cần giáo viên bấm trả từng bài. */
 @Column(name="publish_score_at") private LocalDateTime publishScoreAt;
 /** Tiết của chương trình mà bài này neo vào. Rỗng = dùng ngày tuyệt đối như cũ. */
 @Column(name="anchor_period_id") private Long anchorPeriodId;
 /** Đệm trước buổi sau, tính bằng phút. Chỉ có nghĩa khi có neo. */
 @Column(name="due_buffer_minutes",nullable=false) private Integer dueBufferMinutes=120;
 /** Chỉ chọn bộ mặc định lúc mở biểu mẫu. Luật vòng đời không được rẽ nhánh theo cột này. */
 @Column(name="task_kind",nullable=false,length=20) private String taskKind="BAI_TAP";
 /** AFTER_SUBMIT / AFTER_RETURN / IMMEDIATE — cổng của điểm và bảng chữa từng câu. */
 @Column(name="answer_reveal",nullable=false,length=20) private String answerReveal="AFTER_RETURN";
 @Column(name="counts_in_gradebook",nullable=false) private Boolean countsInGradebook=true;
 /** CLASS = cả lớp, không sinh dòng assignment_targets nào. SELECTED = chỉ những em được chọn. */
 @Column(name="target_scope",nullable=false,length=10) private String targetScope="CLASS";
 @Column(name="created_by",nullable=false) private Long createdBy;
}
