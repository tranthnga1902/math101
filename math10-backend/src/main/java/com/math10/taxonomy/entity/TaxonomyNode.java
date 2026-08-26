package com.math10.taxonomy.entity;

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
@Table(name = "taxonomy_node")
@SQLRestriction("deleted_at IS NULL")
public class TaxonomyNode extends BaseEntity {

    @Column(name = "parent_id")
    private Long parentId;

    @Column(nullable = false, length = 40)
    private String subject = "TOAN_10";

    @Column(nullable = false)
    private Integer depth;

    @Column(nullable = false, columnDefinition = "text")
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false, columnDefinition = "text")
    private String slug;

    @Column(name = "order_no", nullable = false)
    private Integer orderNo = 0;

    @Column(name = "proposed_by")
    private Long proposedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaxonomyStatus status = TaxonomyStatus.ACTIVE;

    @Column(name = "merged_into")
    private Long mergedInto;
}
