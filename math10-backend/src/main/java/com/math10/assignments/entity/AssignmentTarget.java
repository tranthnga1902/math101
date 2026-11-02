package com.math10.assignments.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

/**
 * Một học sinh được chỉ đích danh trong bài giao phạm vi SELECTED.
 *
 * <p>Bài giao cả lớp KHÔNG có dòng nào ở đây — cả lớp là một phạm vi, không phải một danh sách.
 * Đọc bảng này mà không đọc {@code target_scope} là hiểu ngược: rỗng nghĩa là "cả lớp", không
 * phải "không ai".
 */
@Getter
@Setter
@Entity
@Table(name = "assignment_targets")
@SQLRestriction("deleted_at IS NULL")
public class AssignmentTarget extends BaseEntity {

    @Column(name = "assignment_id", nullable = false)
    private Long assignmentId;

    @Column(name = "student_id", nullable = false)
    private Long studentId;
}
