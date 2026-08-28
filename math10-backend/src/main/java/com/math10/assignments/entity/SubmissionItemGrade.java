package com.math10.assignments.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
import java.math.BigDecimal;
/**
 * Điểm và nhận xét của <b>một câu</b> trong một bài nộp.
 *
 * <p>Dòng ở bảng này bị xoá thẳng chứ không đánh dấu xoá — ràng buộc duy nhất
 * {@code (progress_id, problem_id)} không tính {@code deleted_at}, nên dòng đánh dấu xoá vẫn chiếm
 * chỗ. {@code @SQLRestriction} giữ ở đây cho khớp nếp chung, còn thực tế không bao giờ có dòng nào
 * mang {@code deleted_at}.
 */
@Getter @Setter @Entity @Table(name="submission_item_grades") @SQLRestriction("deleted_at IS NULL")
public class SubmissionItemGrade extends BaseEntity {
 @Column(name="progress_id",nullable=false) private Long progressId;
 @Column(name="problem_id",nullable=false) private Long problemId;
 /** Để trống nghĩa là chưa ai chấm câu này — khác hẳn 0 điểm. */
 @Column private BigDecimal score;
 @Column(name="max_score",nullable=false) private BigDecimal maxScore;
 @Column(columnDefinition="text") private String feedback;
}
