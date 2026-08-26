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

/**
 * Tài liệu được gắn vào một lớp. Chỉ giữ tham chiếu tới documents(id):
 * nguồn tài liệu (kho chung cấp trường hay tài liệu riêng của giáo viên) suy ra từ
 * documents.owner_id, không lưu lại ở đây để không lệch khi tài liệu gốc đổi chủ.
 */
@Getter
@Setter
@Entity
@Table(name = "class_documents")
@SQLRestriction("deleted_at IS NULL")
public class ClassDocument extends BaseEntity {

    @Column(name = "class_id", nullable = false)
    private Long classId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ClassRequirement requirement = ClassRequirement.TU_CHON;

    @Column(length = 500)
    private String note;

    @Column(name = "attached_by")
    private Long attachedBy;
}
