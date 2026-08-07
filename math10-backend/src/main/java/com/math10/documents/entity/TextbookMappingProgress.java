package com.math10.documents.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "textbook_mapping_progress",
        uniqueConstraints = @UniqueConstraint(name = "uq_textbook_mapping_progress_user_doc",
                columnNames = {"user_id", "document_id"}))
@SQLRestriction("deleted_at IS NULL")
public class TextbookMappingProgress extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "pdf_page", nullable = false)
    private Integer pdfPage;

    @Column(name = "pdf_anchor", nullable = false)
    private Integer pdfAnchor;

    @Column(name = "book_anchor", nullable = false)
    private Integer bookAnchor;

    @Column(name = "zoom", nullable = false)
    private Integer zoom = 100;

    @Column(name = "thumb_page", nullable = false)
    private Integer thumbPage = 1;
}
