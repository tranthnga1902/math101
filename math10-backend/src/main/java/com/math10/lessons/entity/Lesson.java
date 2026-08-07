package com.math10.lessons.entity;

import com.math10.common.entity.BaseEntity;
import com.math10.common.entity.PublishStatus;
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
@Table(name = "lessons")
@SQLRestriction("deleted_at IS NULL")
public class Lesson extends BaseEntity {

    @Column(name = "chapter_id", nullable = false)
    private Long chapterId;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "public_code", unique = true, length = 80)
    private String publicCode;

    @Column(columnDefinition = "text")
    private String summary;

    @Column(name = "content_html", columnDefinition = "text")
    private String contentHtml;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private PublishStatus status = PublishStatus.DRAFT;
}
