package com.math10.exams.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
import java.time.LocalDateTime;
/**
 * Kì thi = <b>ý định</b> ra đề; bài giao con = câu trả lời đã vật hóa cho từng lớp.
 *
 * <p>Mặc định của mọi cột nhắc lại y hệt mặc định trong migration: Postgres không áp default khi
 * câu INSERT liệt kê cột tường minh, mà Hibernate thì luôn liệt kê.
 */
@Getter @Setter @Entity @Table(name="exams") @SQLRestriction("deleted_at IS NULL")
public class Exam extends BaseEntity {
 /** COURSE = chung cho khóa (admin). CLASS = cho một lớp (giáo viên). */
 @Column(nullable=false,length=10) private String scope;
 @Column(name="course_instance_id") private Long courseInstanceId;
 @Column(name="class_id") private Long classId;
 @Column(nullable=false) private String title;
 @Column private String description;
 @Column(name="worksheet_id") private Long worksheetId;
 /** Bản chụp bất biến của đề — thứ học sinh thật sự làm. */
 @Column(name="worksheet_version_id") private Long worksheetVersionId;
 @Column(name="duration_minutes") private Integer durationMinutes;
 @Column(name="open_at") private LocalDateTime openAt;
 @Column(name="due_at") private LocalDateTime dueAt;
 /** Neo vào tiết chương trình. Có neo thì mỗi lớp tự có mốc giờ riêng theo lịch của lớp ấy. */
 @Column(name="anchor_period_id") private Long anchorPeriodId;
 @Column(name="max_attempts",nullable=false) private Integer maxAttempts=1;
 @Column(name="late_policy",nullable=false,length=20) private String latePolicy="REJECT";
 @Column(name="answer_reveal",nullable=false,length=20) private String answerReveal="AFTER_RETURN";
 @Column(name="counts_in_gradebook",nullable=false) private Boolean countsInGradebook=true;
 @Column(nullable=false,length=20) private String status="DRAFT";
 @Column(name="created_by",nullable=false) private Long createdBy;
}
