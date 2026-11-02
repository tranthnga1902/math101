package com.math10.worksheets.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
@Getter @Setter @Entity @Table(name="worksheet_items") @SQLRestriction("deleted_at IS NULL")
public class WorksheetItem extends BaseEntity {
 @Column(name="worksheet_id",nullable=false) private Long worksheetId;
 @Column(name="problem_id") private Long problemId;
 @Column(name="worksheet_version_id") private Long worksheetVersionId;
 @Column(name="source_question_id") private Long sourceQuestionId;
 @Column(name="question_variant_id") private Long questionVariantId;
 @Column(name="content_snapshot",columnDefinition="text") private String contentSnapshot;
 @Column(name="option_a_snapshot",columnDefinition="text") private String optionASnapshot;
 @Column(name="option_b_snapshot",columnDefinition="text") private String optionBSnapshot;
 @Column(name="option_c_snapshot",columnDefinition="text") private String optionCSnapshot;
 @Column(name="option_d_snapshot",columnDefinition="text") private String optionDSnapshot;
 @Column(name="answer_snapshot",columnDefinition="text") private String answerSnapshot;
 @Column(name="solution_snapshot",columnDefinition="text") private String solutionSnapshot;
 @Column(name="order_index",nullable=false) private Integer orderIndex;
}
