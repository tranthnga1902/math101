package com.math10.assignments.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
import java.math.BigDecimal;
/** Nhật ký: mỗi lần học sinh nộp bài, giáo viên chấm hoặc trả bài đều ghi lại một dòng. */
@Getter @Setter @Entity @Table(name="assignment_submission_log") @SQLRestriction("deleted_at IS NULL")
public class AssignmentSubmissionLog extends BaseEntity {
 @Column(name="assignment_id",nullable=false) private Long assignmentId;
 @Column(name="class_id",nullable=false) private Long classId;
 @Column(name="student_id",nullable=false) private Long studentId;
 @Column(name="actor_id") private Long actorId;
 @Column(nullable=false,length=20) private String action;
 @Column(nullable=false,length=20) private String requirement="BAT_BUOC";
 @Column private BigDecimal score;
 @Column(length=500) private String note;
}
