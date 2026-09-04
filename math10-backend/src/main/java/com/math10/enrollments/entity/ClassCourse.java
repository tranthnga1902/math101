package com.math10.enrollments.entity;

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
@Table(name = "class_courses")
@SQLRestriction("deleted_at IS NULL")
public class ClassCourse extends BaseEntity {

    @Column(name = "class_id", nullable = false)
    private Long classId;

    /** Khóa (course_instances), không phải chương trình: lịch dạy của lớp nằm ở khóa. */
    @Column(name = "course_instance_id", nullable = false)
    private Long courseInstanceId;
}
