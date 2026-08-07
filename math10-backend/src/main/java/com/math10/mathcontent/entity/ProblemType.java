package com.math10.mathcontent.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
@Getter @Setter @Entity @Table(name="problem_types") @SQLRestriction("deleted_at IS NULL")
public class ProblemType extends BaseEntity {
 @Column(name="topic_id",nullable=false) private Long topicId;
 @Column(nullable=false,length=180) private String name;
 @Column(name="recognition_signs",columnDefinition="text") private String recognitionSigns;
 @Column(name="general_method",columnDefinition="text") private String generalMethod;
 @Column(name="solution_outline",columnDefinition="text") private String solutionOutline;
 @Column(name="common_mistakes",columnDefinition="text") private String commonMistakes;
}
