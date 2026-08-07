package com.math10.mathcontent.dto;
import jakarta.validation.constraints.*;
import java.util.List;
public final class MathContentDtos {
 private MathContentDtos(){}
 public record TopicRequest(@NotBlank String name,String description){}
 public record TopicResponse(Long id,String name,String description){}
 public record TypeRequest(@NotNull Long topicId,@NotBlank String name,String recognitionSigns,String generalMethod,String solutionOutline,String commonMistakes){}
 public record TypeResponse(Long id,Long topicId,String name,String recognitionSigns,String generalMethod,String solutionOutline,String commonMistakes){}
 public record ProblemRequest(@NotNull Long problemTypeId,String publicCode,@NotBlank String statementLatex,String contentHtml,@NotBlank String difficulty,@NotBlank String status,@NotBlank String problemKind,String examPart,Long easierProblemId,Long equivalentProblemId,Long harderProblemId){}
 public record ProblemResponse(Long id,Long problemTypeId,String publicCode,String qrSlug,String statementLatex,String contentHtml,String difficulty,String status,String problemKind,String examPart,Long easierProblemId,Long equivalentProblemId,Long harderProblemId){}
 public record HintRequest(@NotNull Long problemId,@NotBlank String contentLatex,@NotNull @Min(1) Integer orderIndex){}
 public record HintResponse(Long id,Long problemId,String contentLatex,Integer orderIndex){}
 public record SolutionRequest(@NotNull Long problemId,@NotBlank String title,@NotBlank String contentLatex,@NotNull @Min(1) Integer orderIndex){}
 public record SolutionResponse(Long id,Long problemId,String title,String contentLatex,Integer orderIndex){}
 public record SimilarProblem(String relation,ProblemResponse problem){}
 public record PublicProblem(ProblemResponse problem,TypeResponse problemType,List<HintResponse> hints,List<SolutionResponse> solutions,List<SimilarProblem> similar){}
}
