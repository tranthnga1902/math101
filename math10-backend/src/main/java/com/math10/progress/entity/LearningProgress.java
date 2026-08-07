package com.math10.progress.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "learning_progress")
@SQLRestriction("deleted_at IS NULL")
public class LearningProgress extends BaseEntity {

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(name = "lesson_id")
    private Long lessonId;

    @Column(name = "worksheet_id")
    private Long worksheetId;

    @Column(nullable = false, length = 30)
    private String status = "NOT_STARTED";

    @Column(name = "opened_at")
    private LocalDateTime openedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "completion_percent", nullable = false)
    private Integer completionPercent = 0;
}
