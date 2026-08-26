package com.math10.assignments.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
import java.time.LocalDateTime;
@Getter @Setter @Entity @Table(name="assignments") @SQLRestriction("deleted_at IS NULL")
public class Assignment extends BaseEntity {
 @Column(name="class_id",nullable=false) private Long classId;
 @Column(name="lesson_id") private Long lessonId;
 @Column(name="worksheet_id") private Long worksheetId;
 @Column(name="document_id") private Long documentId;
 @Column(nullable=false) private String title;
 @Column(name="due_at") private LocalDateTime dueAt;
 @Column(nullable=false) private String status;
 /** BAT_BUOC: có điểm, vào sổ. TU_CHON: chỉ tính hoàn thành, không trộn vào điểm. */
 @Column(nullable=false,length=20) private String requirement="BAT_BUOC";
 @Column(name="created_by",nullable=false) private Long createdBy;
}
