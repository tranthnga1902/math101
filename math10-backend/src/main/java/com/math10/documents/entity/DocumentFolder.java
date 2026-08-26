package com.math10.documents.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

@Getter @Setter @Entity
@Table(name="document_folders")
@SQLRestriction("deleted_at IS NULL")
public class DocumentFolder extends BaseEntity {
    @Column(name="owner_id",nullable=false) private Long ownerId;
    @Column(nullable=false,length=120) private String name;
}
