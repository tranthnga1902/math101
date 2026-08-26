package com.math10.taxonomy.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter
@Setter
@Entity
@Table(name = "taxonomy_alias")
@SQLRestriction("deleted_at IS NULL")
public class TaxonomyAlias extends BaseEntity {

    @Column(name = "node_id", nullable = false)
    private Long nodeId;

    @Column(nullable = false, columnDefinition = "text")
    private String alias;

    @Column(nullable = false, columnDefinition = "text")
    private String slug;
}
