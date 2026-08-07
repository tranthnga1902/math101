package com.math10.documents.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@Entity
@Table(name = "textbook_mapping_history")
public class TextbookMappingHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

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

    @Enumerated(EnumType.STRING)
    @Column(name = "action", nullable = false, length = 20)
    private MappingHistoryAction action;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
