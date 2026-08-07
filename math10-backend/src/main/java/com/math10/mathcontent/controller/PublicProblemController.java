package com.math10.mathcontent.controller;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.mathcontent.dto.MathContentDtos.*;
import com.math10.mathcontent.entity.*;
import com.math10.mathcontent.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequiredArgsConstructor @RequestMapping("/api/public/problems")
public class PublicProblemController {
 private final ProblemRepository problems; private final ProblemTypeRepository types; private final ProblemHintRepository hints; private final SolutionStepRepository solutions;
 @GetMapping("/{slug}") public ApiResponse<PublicProblem> get(@PathVariable String slug){
  Problem p=problems.findByQrSlugAndStatus(slug,"PUBLISHED").orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài toán công khai"));
  ProblemType t=types.findById(p.getProblemTypeId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy dạng toán"));
  if(!"PRACTICE".equals(p.getProblemKind()))throw new ResourceNotFoundException("Không tìm thấy bài toán công khai");
  List<SimilarProblem> similar=new ArrayList<>();
  addSimilar(similar,"EASIER",p.getEasierProblemId());
  addSimilar(similar,"EQUIVALENT",p.getEquivalentProblemId());
  addSimilar(similar,"HARDER",p.getHarderProblemId());
  return ApiResponse.ok("Chi tiết bài toán",new PublicProblem(map(p),new TypeResponse(t.getId(),t.getTopicId(),t.getName(),t.getRecognitionSigns(),t.getGeneralMethod(),t.getSolutionOutline(),t.getCommonMistakes()),hints.findByProblemIdOrderByOrderIndex(p.getId()).stream().map(x->new HintResponse(x.getId(),x.getProblemId(),x.getContentLatex(),x.getOrderIndex())).toList(),solutions.findByProblemIdOrderByOrderIndex(p.getId()).stream().map(x->new SolutionResponse(x.getId(),x.getProblemId(),x.getTitle(),x.getContentLatex(),x.getOrderIndex())).toList(),similar));
 }
 private void addSimilar(List<SimilarProblem> result,String relation,Long id){if(id==null)return;problems.findById(id).filter(x->"PUBLISHED".equals(x.getStatus())&&"PRACTICE".equals(x.getProblemKind())).ifPresent(x->result.add(new SimilarProblem(relation,map(x))));}
 private ProblemResponse map(Problem x){return new ProblemResponse(x.getId(),x.getProblemTypeId(),x.getPublicCode(),x.getQrSlug(),x.getStatementLatex(),x.getContentHtml(),x.getDifficulty(),x.getStatus(),x.getProblemKind(),x.getExamPart(),x.getEasierProblemId(),x.getEquivalentProblemId(),x.getHarderProblemId());}
}
