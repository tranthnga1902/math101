package com.math10.classes.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "classes")
@SQLRestriction("deleted_at IS NULL")
public class Classroom extends BaseEntity {

    @Column(nullable = false, unique = true, length = 50)
    private String code;

    @Column(nullable = false, length = 120)
    private String name;

    @Column(name = "grade_id", nullable = false)
    private Long gradeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ClassStatus status = ClassStatus.ACTIVE;

    @Column(length = 500)
    private String description;

    /** Người tạo lớp — để Admin biết lớp nào do giáo viên nào lập ra. */
    @Column(name = "created_by")
    private Long createdBy;
}
