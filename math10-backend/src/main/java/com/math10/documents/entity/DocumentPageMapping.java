package com.math10.documents.entity;

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
@Table(name = "document_page_mappings")
@SQLRestriction("deleted_at IS NULL")
public class DocumentPageMapping extends BaseEntity {

    @Column(name = "document_id", nullable = false)
    private Long documentId;

    @Column(name = "pdf_page_number", nullable = false)
    private Integer pdfPageNumber;

    @Column(name = "book_page_label", length = 30)
    private String bookPageLabel;

    @Enumerated(EnumType.STRING)
    @Column(name = "page_type", length = 30)
    private PageType pageType = PageType.CONTENT;

    @Column(name = "chapter_title", length = 255)
    private String chapterTitle;

    @Column(name = "lesson_title", length = 255)
    private String lessonTitle;
}
