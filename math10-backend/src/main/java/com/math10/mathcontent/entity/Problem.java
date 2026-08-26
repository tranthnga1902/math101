package com.math10.mathcontent.entity;
import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;
@Getter @Setter @Entity @Table(name="problems") @SQLRestriction("deleted_at IS NULL")
public class Problem extends BaseEntity {
 @Column(name="problem_type_id",nullable=false) private Long problemTypeId;
 @Column(name="public_code",nullable=false,unique=true,length=30) private String publicCode;
 @Column(name="qr_slug",unique=true,length=8) private String qrSlug;
 @Column(name="statement_latex",nullable=false,columnDefinition="text") private String statementLatex;
 @Column(name="content_html",columnDefinition="text") private String contentHtml;
 @Column(name="option_a",columnDefinition="text") private String optionA;
 @Column(name="option_b",columnDefinition="text") private String optionB;
 @Column(name="option_c",columnDefinition="text") private String optionC;
 @Column(name="option_d",columnDefinition="text") private String optionD;
 @Column(name="correct_option",length=1) private String correctOption;
 @Column(name="problem_kind",nullable=false,length=20) private String problemKind;
 @Column(name="easier_problem_id") private Long easierProblemId;
 @Column(name="equivalent_problem_id") private Long equivalentProblemId;
 @Column(name="harder_problem_id") private Long harderProblemId;
 @Column(name="exam_part",length=80) private String examPart;
 @Column(nullable=false,length=30) private String difficulty;
 @Column(nullable=false,length=30) private String status;
 @Column(name="created_by") private Long createdBy;
}
