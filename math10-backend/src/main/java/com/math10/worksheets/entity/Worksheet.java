package com.math10.worksheets.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
@Getter @Setter @Entity @Table(name="worksheets") @SQLRestriction("deleted_at IS NULL")
public class Worksheet extends BaseEntity {
 @Column(nullable=false) private String name;
 @Column(name="columns_count",nullable=false) private Integer columnsCount=1;
 @Column(name="show_qr",nullable=false) private Boolean showQr=true;
 @Column(name="show_student_fields",nullable=false) private Boolean showStudentFields=true;
 @Column(name="created_by",nullable=false) private Long createdBy;
 @Column(name="lesson_id") private Long lessonId;
}
