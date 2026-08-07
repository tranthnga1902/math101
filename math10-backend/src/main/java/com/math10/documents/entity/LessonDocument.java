package com.math10.documents.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "lesson_documents")
@SQLRestriction("deleted_at IS NULL")
public class LessonDocument extends BaseEntity {

    @Column(name = "lesson_id", nullable = false)
    private Long lessonId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "is_required", nullable = false)
    private boolean required;

    @Column(name = "teacher_note", columnDefinition = "text")
    private String teacherNote;

    @Column(name = "start_page")
    private Integer startPage;

    @Column(name = "display_order", nullable = false)
    private Integer displayOrder;
}
