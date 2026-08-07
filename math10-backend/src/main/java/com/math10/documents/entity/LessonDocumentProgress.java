package com.math10.documents.entity;

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
@Table(name = "lesson_document_progress")
@SQLRestriction("deleted_at IS NULL")
public class LessonDocumentProgress extends BaseEntity {

    @Column(name = "lesson_document_id", nullable = false)
    private Long lessonDocumentId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;

    @Column(nullable = false, length = 30)
    private String status = "NOT_OPENED";

    @Column(name = "opened_at")
    private LocalDateTime openedAt;

    @Column(name = "last_opened_at")
    private LocalDateTime lastOpenedAt;

    @Column(name = "open_count", nullable = false)
    private Integer openCount = 0;

    @Column(name = "total_seconds", nullable = false)
    private Integer totalSeconds = 0;

    @Column(name = "quiz_score")
    private Integer quizScore;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;
}
