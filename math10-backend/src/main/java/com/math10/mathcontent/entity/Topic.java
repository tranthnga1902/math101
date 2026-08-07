package com.math10.mathcontent.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
@Getter @Setter @Entity @Table(name="topics") @SQLRestriction("deleted_at IS NULL")
public class Topic extends BaseEntity {
 @Column(nullable=false,length=180) private String name;
 @Column(columnDefinition="text") private String description;
}
