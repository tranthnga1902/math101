package com.math10.worksheets.controller;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.common.exception.BusinessException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.configuration.security.SecurityService;
import com.math10.lessons.entity.Lesson;
import com.math10.lessons.repository.LessonRepository;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.mathcontent.entity.Problem;
import com.math10.mathcontent.repository.ProblemRepository;
import com.math10.mathcontent.repository.ProblemTypeRepository;
import com.math10.worksheets.dto.WorksheetImportDtos.*;
import com.math10.worksheets.service.DocxWorksheetParser;
import com.math10.worksheets.service.PdfWorksheetParser;
import com.math10.worksheets.dto.WorksheetDtos.*;
import com.math10.worksheets.entity.*;
import com.math10.worksheets.repository.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.MediaType;
import java.util.*;
@RestController @RequiredArgsConstructor @RequestMapping("/api/worksheets") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
public class WorksheetController {
 private final WorksheetRepository worksheets; private final WorksheetItemRepository items; private final ProblemRepository problems; private final ProblemTypeRepository problemTypes; private final CurrentUserService current;
 private final LessonRepository lessons; private final ChapterRepository chapters; private final SecurityService security;
 private final DocxWorksheetParser docxParser;
 private final PdfWorksheetParser pdfParser;
 @GetMapping public ApiResponse<List<Response>> list(){List<Worksheet> rows="ADMIN".equals(current.requireRoleCode())?worksheets.findAll():worksheets.findByCreatedByOrderByCreatedAtDesc(current.requireUserId());return ApiResponse.ok("Danh sách phiếu bài tập",rows.stream().map(this::map).toList());}
 @GetMapping("/{id}") public ApiResponse<Response> get(@PathVariable Long id){return ApiResponse.ok("Chi tiết phiếu bài tập",map(owned(id)));}
 @PostMapping @Transactional public ApiResponse<Response> create(@Valid @RequestBody Request r){Worksheet w=new Worksheet();w.setCreatedBy(current.requireUserId());apply(w,r);w=worksheets.save(w);replaceItems(w.getId(),r.problemIds());return ApiResponse.created("Tạo phiếu bài tập",map(w));}
 @PostMapping(value="/import/docx",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public ApiResponse<Preview> importDocx(@RequestPart("file") MultipartFile file){if(file.isEmpty())throw new BusinessException("File DOCX không được rỗng");if(file.getSize()>20L*1024*1024)throw new BusinessException("File DOCX vượt quá 20MB");String name=Optional.ofNullable(file.getOriginalFilename()).orElse("de-thi.docx");if(!name.toLowerCase(Locale.ROOT).endsWith(".docx"))throw new BusinessException("Chỉ hỗ trợ file .docx");try{return ApiResponse.ok("Bóc đề thành công",docxParser.parse(name,file.getInputStream()));}catch(java.io.IOException e){throw new BusinessException("Không thể đọc file tải lên");}}
 @PostMapping(value="/import/pdf",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
 public ApiResponse<Preview> importPdf(@RequestPart("file") MultipartFile file){if(file.isEmpty())throw new BusinessException("File PDF không được rỗng");if(file.getSize()>30L*1024*1024)throw new BusinessException("File PDF vượt quá 30MB");String name=Optional.ofNullable(file.getOriginalFilename()).orElse("de-thi.pdf");if(!name.toLowerCase(Locale.ROOT).endsWith(".pdf"))throw new BusinessException("Chỉ hỗ trợ file .pdf");try{return ApiResponse.ok("Bóc đề PDF thành công",pdfParser.parse(name,file.getInputStream()));}catch(java.io.IOException e){throw new BusinessException("Không thể đọc file tải lên");}}
 @PostMapping("/import/publish") @Transactional
 public ApiResponse<Response> publishImport(@Valid @RequestBody PublishRequest r){problemTypes.findById(r.problemTypeId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy dạng toán"));List<Long> problemIds=new ArrayList<>();int index=1;for(PublishQuestion q:r.questions()){String answer=q.correctOption().trim().toUpperCase(Locale.ROOT);if(!Set.of("A","B","C","D").contains(answer))throw new BusinessException("Đáp án đúng phải là A, B, C hoặc D");Problem p=new Problem();p.setProblemTypeId(r.problemTypeId());p.setPublicCode(nextImportCode(index++));p.setStatementLatex(q.statement().trim());p.setContentHtml(q.statement().trim());p.setOptionA(q.optionA().trim());p.setOptionB(q.optionB().trim());p.setOptionC(q.optionC().trim());p.setOptionD(q.optionD().trim());p.setCorrectOption(answer);p.setProblemKind("PRACTICE");p.setDifficulty("MEDIUM");p.setStatus("PUBLISHED");p.setCreatedBy(current.requireUserId());problemIds.add(problems.save(p).getId());}Worksheet w=new Worksheet();w.setCreatedBy(current.requireUserId());w.setName(r.name());w.setColumnsCount(1);w.setShowQr(false);w.setShowStudentFields(true);w=worksheets.save(w);replaceItems(w.getId(),problemIds);return ApiResponse.created("Phát hành phiếu đề thành công",map(w));}
 @PutMapping("/{id}") @Transactional public ApiResponse<Response> update(@PathVariable Long id,@Valid @RequestBody Request r){Worksheet w=editable(id);apply(w,r);replaceItems(id,r.problemIds());return ApiResponse.ok("Cập nhật phiếu bài tập",map(w));}
 @PostMapping("/{id}/publish") @Transactional public ApiResponse<Response> publish(@PathVariable Long id){Worksheet w=owned(id);w.setStatus("PUBLISHED");return ApiResponse.ok("Đã phát hành phiếu bài tập",map(w));}
 @PostMapping("/{id}/clone") @Transactional public ApiResponse<Response> cloneVersion(@PathVariable Long id){Worksheet source=owned(id);Worksheet copy=new Worksheet();copy.setName(source.getName());copy.setColumnsCount(source.getColumnsCount());copy.setShowQr(source.getShowQr());copy.setShowStudentFields(source.getShowStudentFields());copy.setCreatedBy(current.requireUserId());copy.setLessonId(source.getLessonId());copy.setExerciseTypeId(source.getExerciseTypeId());copy.setStatus("DRAFT");copy.setVersion(source.getVersion()+1);copy.setParentWorksheetId(source.getParentWorksheetId()==null?source.getId():source.getParentWorksheetId());copy=worksheets.save(copy);replaceItems(copy.getId(),items.findByWorksheetIdOrderByOrderIndex(source.getId()).stream().map(WorksheetItem::getProblemId).toList());return ApiResponse.created("Đã tạo phiên bản mới",map(copy));}
 @DeleteMapping("/{id}") @Transactional public ApiResponse<Void> delete(@PathVariable Long id){owned(id).markDeleted();items.findByWorksheetIdOrderByOrderIndex(id).forEach(WorksheetItem::markDeleted);return ApiResponse.noContent("Xóa phiếu bài tập");}
 @PatchMapping("/{id}/lesson") @Transactional public ApiResponse<Response> attachLesson(@PathVariable Long id,@RequestBody LessonAttachmentRequest request){Worksheet worksheet=owned(id);if(request.lessonId()!=null){Lesson lesson=lessons.findById(request.lessonId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài học"));var chapter=chapters.findById(lesson.getChapterId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương"));security.checkCourseOwnership(chapter.getCourseId());}worksheet.setLessonId(request.lessonId());return ApiResponse.ok(request.lessonId()==null?"Đã gỡ phiếu khỏi bài học":"Đã gắn phiếu vào bài học",map(worksheet));}
 private Worksheet owned(Long id){Worksheet w=worksheets.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy phiếu bài tập"));if(!"ADMIN".equals(current.requireRoleCode())&&!w.getCreatedBy().equals(current.requireUserId()))throw new AccessDeniedException("Không có quyền truy cập phiếu bài tập");return w;}
 private Worksheet editable(Long id){Worksheet w=owned(id);if(!"DRAFT".equals(w.getStatus()))throw new BusinessException("Phiếu đã phát hành; hãy nhân bản để tạo phiên bản mới");return w;}
 private void apply(Worksheet w,Request r){w.setName(r.name());w.setColumnsCount(r.columnsCount());w.setShowQr(r.showQr());w.setShowStudentFields(r.showStudentFields());}
 private void replaceItems(Long id,List<Long> problemIds){items.findByWorksheetIdOrderByOrderIndex(id).forEach(WorksheetItem::markDeleted);items.flush();int order=1;for(Long problemId:problemIds){Problem problem=problems.findById(problemId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài toán #"+problemId));if(!"PRACTICE".equals(problem.getProblemKind()))throw new BusinessException("Phiếu bài tập chỉ được chứa bài PRACTICE");WorksheetItem x=new WorksheetItem();x.setWorksheetId(id);x.setProblemId(problemId);x.setOrderIndex(order++);items.save(x);}}
 private String nextImportCode(int index){String base="IMP"+System.currentTimeMillis()+"-"+index;String code=base.length()>30?base.substring(0,30):base;while(problems.existsByPublicCode(code))code=("IMP"+UUID.randomUUID().toString().replace("-","")).substring(0,30);return code;}
 private Response map(Worksheet w){List<Item> rows=items.findByWorksheetIdOrderByOrderIndex(w.getId()).stream().map(x->{Problem p=problems.findById(x.getProblemId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài toán"));return new Item(x.getId(),p.getId(),x.getOrderIndex(),p.getPublicCode(),p.getQrSlug(),p.getStatementLatex(),p.getDifficulty());}).toList();return new Response(w.getId(),w.getName(),w.getColumnsCount(),w.getShowQr(),w.getShowStudentFields(),w.getCreatedBy(),w.getLessonId(),rows);}
 public record LessonAttachmentRequest(Long lessonId){}
}
