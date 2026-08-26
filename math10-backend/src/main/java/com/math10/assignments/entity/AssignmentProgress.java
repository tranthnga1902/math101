package com.math10.assignments.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
import java.time.LocalDateTime;
@Getter @Setter @Entity @Table(name="assignment_progress") @SQLRestriction("deleted_at IS NULL")
public class AssignmentProgress extends BaseEntity {
 @Column(name="assignment_id",nullable=false) private Long assignmentId;
 @Column(name="student_id",nullable=false) private Long studentId;
 @Column(name="opened_at") private LocalDateTime openedAt;
 @Column(name="completed_at") private LocalDateTime completedAt;
 @Column(name="completion_percent",nullable=false) private Integer completionPercent=0;
 @Column(name="answer_json",columnDefinition="text") private String answerJson;
 @Column(name="submitted_at") private LocalDateTime submittedAt;
 @Column(name="graded_at") private LocalDateTime gradedAt;
 @Column(name="returned_at") private LocalDateTime returnedAt;
 @Column private java.math.BigDecimal score;
 @Column(name="max_score",nullable=false) private java.math.BigDecimal maxScore=java.math.BigDecimal.TEN;
 @Column(name="correct_count") private Integer correctCount;
 @Column(name="total_questions") private Integer totalQuestions;
 @Column(name="teacher_feedback",columnDefinition="text") private String teacherFeedback;
 @Column(name="grading_status",nullable=false,length=20) private String gradingStatus="NOT_SUBMITTED";
}
