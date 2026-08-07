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
}
