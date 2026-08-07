package com.math10.mathcontent.controller;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.*;
import com.math10.configuration.security.CurrentUserService;
import com.math10.mathcontent.dto.MathContentDtos.*;
import com.math10.mathcontent.entity.*;
import com.math10.mathcontent.repository.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.security.SecureRandom;
import java.util.*;
import com.math10.audit.service.AuditService;

@RestController @RequiredArgsConstructor @RequestMapping("/api/math")
@PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
public class MathContentController {
 private final TopicRepository topics; private final ProblemTypeRepository types; private final ProblemRepository problems;
 private final ProblemHintRepository hints; private final SolutionStepRepository solutions; private final CurrentUserService current;
 private final AuditService audit;
 private static final String ALPHABET="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; private static final SecureRandom RANDOM=new SecureRandom();

 @GetMapping("/topics") public ApiResponse<List<TopicResponse>> topics(){return ApiResponse.ok("Danh sách chủ đề",topics.findAll().stream().map(this::map).toList());}
 @PostMapping("/topics") @PreAuthorize("hasRole('ADMIN')") @Transactional public ApiResponse<TopicResponse> createTopic(@Valid @RequestBody TopicRequest r){Topic x=new Topic();apply(x,r);return ApiResponse.created("Tạo chủ đề",map(topics.save(x)));}
 @PutMapping("/topics/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional public ApiResponse<TopicResponse> updateTopic(@PathVariable Long id,@Valid @RequestBody TopicRequest r){Topic x=topic(id);apply(x,r);return ApiResponse.ok("Cập nhật chủ đề",map(x));}
 @DeleteMapping("/topics/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional public ApiResponse<Void> deleteTopic(@PathVariable Long id){topic(id).markDeleted();return ApiResponse.noContent("Xóa chủ đề");}

 @GetMapping("/types") public ApiResponse<List<TypeResponse>> types(@RequestParam Long topicId){return ApiResponse.ok("Danh sách dạng toán",types.findByTopicIdOrderByName(topicId).stream().map(this::map).toList());}
 @PostMapping("/types") @Transactional public ApiResponse<TypeResponse> createType(@Valid @RequestBody TypeRequest r){topic(r.topicId());ProblemType x=new ProblemType();apply(x,r);return ApiResponse.created("Tạo dạng toán",map(types.save(x)));}
 @PutMapping("/types/{id}") @Transactional public ApiResponse<TypeResponse> updateType(@PathVariable Long id,@Valid @RequestBody TypeRequest r){topic(r.topicId());ProblemType x=type(id);apply(x,r);return ApiResponse.ok("Cập nhật dạng toán",map(x));}
 @DeleteMapping("/types/{id}") @Transactional public ApiResponse<Void> deleteType(@PathVariable Long id){type(id).markDeleted();return ApiResponse.noContent("Xóa dạng toán");}

 @GetMapping("/problems") public ApiResponse<List<ProblemResponse>> problems(@RequestParam Long problemTypeId){return ApiResponse.ok("Danh sách bài toán",problems.findByProblemTypeIdOrderByCreatedAtDesc(problemTypeId).stream().map(this::map).toList());}
 @PostMapping("/problems") @Transactional public ApiResponse<ProblemResponse> createProblem(@Valid @RequestBody ProblemRequest r){type(r.problemTypeId());validateKind(r.problemKind());validateSimilar(null,r);Problem x=new Problem();apply(x,r);x.setPublicCode(uniqueCode(r.publicCode()));x.setQrSlug("PRACTICE".equals(r.problemKind())?uniqueSlug():null);x.setCreatedBy(current.requireUserId());x=problems.save(x);audit.record("CREATE","PROBLEM",x.getId(),null,map(x).toString());return ApiResponse.created("Tạo bài toán",map(x));}
 @PutMapping("/problems/{id}") @Transactional public ApiResponse<ProblemResponse> updateProblem(@PathVariable Long id,@Valid @RequestBody ProblemRequest r){type(r.problemTypeId());Problem x=problem(id);checkProblemOwner(x);validateKind(r.problemKind());if(!Objects.equals(x.getProblemKind(),r.problemKind()))throw new BusinessException("Không thể đổi phân loại PRACTICE/EXAM sau khi tạo");validateSimilar(id,r);String old=map(x).toString();apply(x,r);audit.record("UPDATE","PROBLEM",id,old,map(x).toString());return ApiResponse.ok("Cập nhật bài toán",map(x));}
 @DeleteMapping("/problems/{id}") @Transactional public ApiResponse<Void> deleteProblem(@PathVariable Long id){Problem x=problem(id);checkProblemOwner(x);audit.record("DELETE","PROBLEM",id,map(x).toString(),null);x.markDeleted();return ApiResponse.noContent("Xóa bài toán");}

 @GetMapping("/problems/{id}/hints") public ApiResponse<List<HintResponse>> hints(@PathVariable Long id){ensurePractice(problem(id));return ApiResponse.ok("Danh sách gợi ý",hints.findByProblemIdOrderByOrderIndex(id).stream().map(this::map).toList());}
 @PostMapping("/hints") @Transactional public ApiResponse<HintResponse> createHint(@Valid @RequestBody HintRequest r){Problem p=problem(r.problemId());checkProblemOwner(p);ensurePractice(p);ProblemHint x=new ProblemHint();apply(x,r);return ApiResponse.created("Tạo gợi ý",map(hints.save(x)));}
 @PutMapping("/hints/{id}") @Transactional public ApiResponse<HintResponse> updateHint(@PathVariable Long id,@Valid @RequestBody HintRequest r){ProblemHint x=hint(id);Problem p=problem(x.getProblemId());checkProblemOwner(p);ensurePractice(p);apply(x,r);return ApiResponse.ok("Cập nhật gợi ý",map(x));}
 @DeleteMapping("/hints/{id}") @Transactional public ApiResponse<Void> deleteHint(@PathVariable Long id){ProblemHint x=hint(id);Problem p=problem(x.getProblemId());checkProblemOwner(p);ensurePractice(p);x.markDeleted();return ApiResponse.noContent("Xóa gợi ý");}
 @PatchMapping("/problems/{id}/hints/reorder") @Transactional public ApiResponse<Void> reorderHints(@PathVariable Long id,@Valid @RequestBody com.math10.courses.dto.request.ReorderRequest r){Problem p=problem(id);checkProblemOwner(p);ensurePractice(p);for(int i=0;i<r.ids().size();i++)hint(r.ids().get(i)).setOrderIndex(-(i+1));hints.flush();for(int i=0;i<r.ids().size();i++)hint(r.ids().get(i)).setOrderIndex(i+1);return ApiResponse.ok("Sắp xếp gợi ý",null);}

 @GetMapping("/problems/{id}/solutions") public ApiResponse<List<SolutionResponse>> solutions(@PathVariable Long id){ensurePractice(problem(id));return ApiResponse.ok("Danh sách lời giải",solutions.findByProblemIdOrderByOrderIndex(id).stream().map(this::map).toList());}
 @PostMapping("/solutions") @Transactional public ApiResponse<SolutionResponse> createSolution(@Valid @RequestBody SolutionRequest r){Problem p=problem(r.problemId());checkProblemOwner(p);ensurePractice(p);SolutionStep x=new SolutionStep();apply(x,r);return ApiResponse.created("Tạo bước giải",map(solutions.save(x)));}
 @PutMapping("/solutions/{id}") @Transactional public ApiResponse<SolutionResponse> updateSolution(@PathVariable Long id,@Valid @RequestBody SolutionRequest r){SolutionStep x=solution(id);Problem p=problem(x.getProblemId());checkProblemOwner(p);ensurePractice(p);apply(x,r);return ApiResponse.ok("Cập nhật bước giải",map(x));}
 @DeleteMapping("/solutions/{id}") @Transactional public ApiResponse<Void> deleteSolution(@PathVariable Long id){SolutionStep x=solution(id);Problem p=problem(x.getProblemId());checkProblemOwner(p);ensurePractice(p);x.markDeleted();return ApiResponse.noContent("Xóa bước giải");}
 @PatchMapping("/problems/{id}/solutions/reorder") @Transactional public ApiResponse<Void> reorderSolutions(@PathVariable Long id,@Valid @RequestBody com.math10.courses.dto.request.ReorderRequest r){Problem p=problem(id);checkProblemOwner(p);ensurePractice(p);for(int i=0;i<r.ids().size();i++)solution(r.ids().get(i)).setOrderIndex(-(i+1));solutions.flush();for(int i=0;i<r.ids().size();i++)solution(r.ids().get(i)).setOrderIndex(i+1);return ApiResponse.ok("Sắp xếp lời giải",null);}

 private Topic topic(Long id){return topics.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chủ đề"));}
 private ProblemType type(Long id){return types.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy dạng toán"));}
 private Problem problem(Long id){return problems.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài toán"));}
 private ProblemHint hint(Long id){return hints.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy gợi ý"));}
 private SolutionStep solution(Long id){return solutions.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bước giải"));}
 private void apply(Topic x,TopicRequest r){x.setName(r.name());x.setDescription(r.description());}
 private void apply(ProblemType x,TypeRequest r){x.setTopicId(r.topicId());x.setName(r.name());x.setRecognitionSigns(r.recognitionSigns());x.setGeneralMethod(r.generalMethod());x.setSolutionOutline(r.solutionOutline());x.setCommonMistakes(r.commonMistakes());}
 private void apply(Problem x,ProblemRequest r){x.setProblemTypeId(r.problemTypeId());x.setStatementLatex(r.statementLatex());x.setContentHtml(r.contentHtml()==null||r.contentHtml().isBlank()?r.statementLatex():r.contentHtml());x.setDifficulty(r.difficulty());x.setStatus(r.status());x.setProblemKind(r.problemKind());x.setExamPart(r.examPart());x.setEasierProblemId(r.easierProblemId());x.setEquivalentProblemId(r.equivalentProblemId());x.setHarderProblemId(r.harderProblemId());}
 private void apply(ProblemHint x,HintRequest r){x.setProblemId(r.problemId());x.setContentLatex(r.contentLatex());x.setOrderIndex(r.orderIndex());}
 private void apply(SolutionStep x,SolutionRequest r){x.setProblemId(r.problemId());x.setTitle(r.title());x.setContentLatex(r.contentLatex());x.setOrderIndex(r.orderIndex());}
 private String uniqueCode(String requested){String code=requested==null||requested.isBlank()?"M10-"+System.currentTimeMillis():requested.trim();if(problems.existsByPublicCode(code))throw new BusinessException("Mã bài đã tồn tại");return code;}
 private String uniqueSlug(){String slug;do{StringBuilder b=new StringBuilder(8);for(int i=0;i<8;i++)b.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));slug=b.toString();}while(problems.existsByQrSlug(slug));return slug;}
 private void validateKind(String kind){if(!Set.of("PRACTICE","EXAM").contains(kind))throw new BusinessException("Phân loại bài toán phải là PRACTICE hoặc EXAM");}
 private void ensurePractice(Problem p){if(!"PRACTICE".equals(p.getProblemKind()))throw new BusinessException("Bài EXAM không được có gợi ý hoặc lời giải");}
 private void validateSimilar(Long problemId,ProblemRequest r){List<Long> ids=java.util.stream.Stream.of(r.easierProblemId(),r.equivalentProblemId(),r.harderProblemId()).filter(Objects::nonNull).toList();if(ids.size()!=new HashSet<>(ids).size())throw new BusinessException("Ba bài tương tự phải khác nhau");for(Long id:ids){if(Objects.equals(problemId,id))throw new BusinessException("Bài toán không thể tương tự với chính nó");Problem related=problem(id);if(!"PRACTICE".equals(related.getProblemKind()))throw new BusinessException("Bài tương tự phải là PRACTICE");}}
 private void checkProblemOwner(Problem x){if(!"ADMIN".equals(current.requireRoleCode())&&!Objects.equals(x.getCreatedBy(),current.requireUserId()))throw new org.springframework.security.access.AccessDeniedException("Không có quyền sửa bài toán");}
 private TopicResponse map(Topic x){return new TopicResponse(x.getId(),x.getName(),x.getDescription());}
 private TypeResponse map(ProblemType x){return new TypeResponse(x.getId(),x.getTopicId(),x.getName(),x.getRecognitionSigns(),x.getGeneralMethod(),x.getSolutionOutline(),x.getCommonMistakes());}
 private ProblemResponse map(Problem x){return new ProblemResponse(x.getId(),x.getProblemTypeId(),x.getPublicCode(),x.getQrSlug(),x.getStatementLatex(),x.getContentHtml(),x.getDifficulty(),x.getStatus(),x.getProblemKind(),x.getExamPart(),x.getEasierProblemId(),x.getEquivalentProblemId(),x.getHarderProblemId());}
 private HintResponse map(ProblemHint x){return new HintResponse(x.getId(),x.getProblemId(),x.getContentLatex(),x.getOrderIndex());}
 private SolutionResponse map(SolutionStep x){return new SolutionResponse(x.getId(),x.getProblemId(),x.getTitle(),x.getContentLatex(),x.getOrderIndex());}
}
