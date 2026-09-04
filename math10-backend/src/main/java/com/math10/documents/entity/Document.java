package com.math10.documents.entity;

import com.math10.common.entity.BaseEntity;
import com.math10.common.entity.ContentGroup;
import com.math10.subjects.entity.Subject;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "documents")
@SQLRestriction("deleted_at IS NULL")
public class Document extends BaseEntity {

    @Column(nullable = false, length = 255)
    private String title;

    @Enumerated(EnumType.STRING)
    @Column(name = "doc_type", nullable = false, length = 30)
    private DocumentType docType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DocumentAudience audience;

    @Column(name = "file_url", nullable = false, length = 1024)
    private String fileUrl;

    @Column(name = "thumbnail_url", length = 1024)
    private String thumbnailUrl;

    @Column(name = "grade_id")
    private Long gradeId;

    @Column(name = "chapter_id")
    private Long chapterId;

    @Column(name = "owner_id")
    private Long ownerId;

    @Column(name = "folder_id")
    private Long folderId;

    /** Mục trong cây phân loại mà tài liệu này thuộc về. Dùng Long thuần thay vì @ManyToOne để module documents không phụ thuộc module taxonomy. */
    @Column(name = "taxonomy_node_id")
    private Long taxonomyNodeId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private DocumentStatus status = DocumentStatus.DRAFT;

    /**
     * Tài liệu này dùng vào lúc nào trong quá trình học — để trống khi chưa ai phân loại.
     *
     * <p>Cột đã có trong CSDL từ lâu nhưng chưa từng được ánh xạ, nên mọi dòng đều mang giá trị máy
     * đặt sẵn. Ánh xạ vào đây để nhãn có đường ghi thật; {@code null} là câu trả lời hợp lệ và
     * đúng cho tài liệu chưa phân loại, đừng đặt giá trị mặc định.
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "content_group", length = 30)
    private ContentGroup contentGroup;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "subject_id")
    private Subject subject;

    @Column(name = "total_pages")
    private Integer totalPages;

    @Column(name = "base_page_offset", nullable = false)
    private Integer basePageOffset = 1;

    @Column(name = "content_markdown", columnDefinition = "text")
    private String contentMarkdown;
}
