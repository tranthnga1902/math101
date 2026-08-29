package com.math10.programs.entity;

import com.math10.common.entity.BaseEntity;
import com.math10.common.entity.PublishStatus;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter @Setter @Entity
@Table(name = "exercise_types")
@SQLRestriction("deleted_at IS NULL")
public class ExerciseType extends BaseEntity {
    @Column(name="lesson_id", nullable=false) private Long lessonId;
    @Column(nullable=false, length=180) private String name;
    @Column(columnDefinition="text") private String description;
    @Column(name="order_index", nullable=false) private Integer orderIndex;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private PublishStatus status = PublishStatus.DRAFT;
}
