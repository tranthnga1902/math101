package com.math10.resources.entity;

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
@Table(name = "lesson_resources")
@SQLRestriction("deleted_at IS NULL")
public class LessonResource extends BaseEntity {

    @Column(name = "lesson_id", nullable = false)
    private Long lessonId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private ResourceType type;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "external_url", length = 1024)
    private String externalUrl;

    @Column(name = "file_asset_id")
    private Long fileAssetId;

    @Column(columnDefinition = "text")
    private String textContent;

    @Column(name = "order_index", nullable = false)
    private Integer orderIndex;
}
