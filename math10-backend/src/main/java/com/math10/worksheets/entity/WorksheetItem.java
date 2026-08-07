package com.math10.worksheets.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
@Getter @Setter @Entity @Table(name="worksheet_items") @SQLRestriction("deleted_at IS NULL")
public class WorksheetItem extends BaseEntity {
 @Column(name="worksheet_id",nullable=false) private Long worksheetId;
 @Column(name="problem_id",nullable=false) private Long problemId;
 @Column(name="order_index",nullable=false) private Integer orderIndex;
}
