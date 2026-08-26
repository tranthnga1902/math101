package com.math10.classes.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

/** Một mục chương trình học của lớp — tham chiếu tới cây chuyên đề, không copy nội dung. */
@Getter
@Setter
@Entity
@Table(name = "class_curriculum")
@SQLRestriction("deleted_at IS NULL")
public class ClassCurriculum extends BaseEntity {

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "taxonomy_node_id", nullable = false)
    private Long taxonomyNodeId;

    @Column(name = "order_no", nullable = false)
    private Integer orderNo = 0;

    @Column(length = 500)
    private String note;

    @Column(name = "created_by")
    private Long createdBy;
}
