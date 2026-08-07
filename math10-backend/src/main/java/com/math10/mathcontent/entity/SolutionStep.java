package com.math10.mathcontent.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
@Getter @Setter @Entity @Table(name="solution_steps") @SQLRestriction("deleted_at IS NULL")
public class SolutionStep extends BaseEntity {
 @Column(name="problem_id",nullable=false) private Long problemId;
 @Column(nullable=false,length=180) private String title;
 @Column(name="content_latex",nullable=false,columnDefinition="text") private String contentLatex;
 @Column(name="order_index",nullable=false) private Integer orderIndex;
}
