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
 private final org.springframework.jdbc.core.JdbcTemplate jdbc;
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
 /**
  * Chỉ bản nháp mới sửa được — và câu từ chối phải nói ra hậu quả, không chỉ nói "không được".
  *
  * <p>Phiếu đã phát hành là phiếu có thể đang nằm trong bài của ai đó. Sửa nó không hỏng dữ liệu,
  * nó làm một việc tệ hơn: đề của bài đã nộp đổi sau lưng, và bảng chấm so bài cũ với đáp án mới.
  * Nên chỗ này đếm luôn số bài giao đang dùng phiếu, để người đọc biết mình đang suýt đụng vào gì.
  */
 private Worksheet editable(Long id){Worksheet w=owned(id);
  if("DRAFT".equals(w.getStatus()))return w;
  long soBai=jdbc.queryForObject("select count(*) from assignments where worksheet_id=? and deleted_at is null",Long.class,id);
  throw new BusinessException(soBai==0
   ?"Phiếu đã phát hành; hãy nhân bản để tạo phiên bản mới"
   :"Phiếu đã phát hành và đang dùng ở "+soBai+" bài giao; hãy nhân bản để tạo phiên bản mới");}
 /**
  * Sửa phiếu này thì đụng tới ai: danh sách bài giao, số học sinh đã nộp ở mỗi bài.
  *
  * <p>Có cửa này thì câu từ chối ở trên không phải ngõ cụt — giáo viên xem được cái giá trước khi
  * chọn giữa nhân bản và sửa hẹp một câu.
  */
 @GetMapping("/{id}/anh-huong") public ApiResponse<List<Map<String,Object>>> anhHuong(@PathVariable Long id){
  owned(id);
  return ApiResponse.ok("Ảnh hưởng của phiếu",jdbc.queryForList("""
    select a.id assignment_id,a.title,a.class_id,c.name class_name,a.status,a.open_at,a.due_at,
           (select count(*) from assignment_progress ap
             where ap.assignment_id=a.id and ap.submitted_at is not null and ap.deleted_at is null) so_da_nop
    from assignments a left join classes c on c.id=a.class_id and c.deleted_at is null
    where a.worksheet_id=? and a.deleted_at is null order by a.created_at desc""",id));}
 /**
  * Ngoại lệ hẹp: sửa chữ và đáp án của <b>một câu</b> trên phiếu đã phát hành.
  *
  * <p>Lỗi chính tả trong đề hay đáp án gõ nhầm là chuyện có thật, và bắt nhân bản cả phiếu chỉ vì
  * một dấu hỏi là cách để không ai sửa gì cả. Nhưng cửa này cố tình <em>không</em> cho thêm, bớt
  * hay đổi thứ tự câu: bài đã nộp đối chiếu theo vị trí câu, nên đổi cấu trúc là làm hỏng mọi bài
  * nộp cũ, còn sửa chữ của một câu thì chỉ cần chấm lại.
  *
  * <p>Trả về {@code soBaiCanChamLai} chứ không tự chấm lại: chấm lại là thao tác thấy được của
  * giáo viên, làm lén thì điểm đổi mà không ai biết vì sao.
  */
 @PatchMapping("/items/{itemId}") @Transactional
 public ApiResponse<Map<String,Object>> suaCauHep(@PathVariable Long itemId,@RequestBody SuaCauRequest r){
  WorksheetItem item=items.findById(itemId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy câu trong phiếu"));
  owned(item.getWorksheetId());
  if(item.getContentSnapshot()==null)throw new BusinessException("Câu này lấy thẳng từ ngân hàng bài; sửa ở ngân hàng hoặc nhân bản phiếu");
  if(r.contentSnapshot()!=null)item.setContentSnapshot(r.contentSnapshot());
  if(r.optionASnapshot()!=null)item.setOptionASnapshot(r.optionASnapshot());
  if(r.optionBSnapshot()!=null)item.setOptionBSnapshot(r.optionBSnapshot());
  if(r.optionCSnapshot()!=null)item.setOptionCSnapshot(r.optionCSnapshot());
  if(r.optionDSnapshot()!=null)item.setOptionDSnapshot(r.optionDSnapshot());
  boolean doiDapAn=r.answerSnapshot()!=null&&!r.answerSnapshot().equals(item.getAnswerSnapshot());
  if(r.answerSnapshot()!=null)item.setAnswerSnapshot(r.answerSnapshot());
  if(r.solutionSnapshot()!=null)item.setSolutionSnapshot(r.solutionSnapshot());
  // Sửa chữ thì bài cũ vẫn chấm đúng; đổi đáp án mới là lúc điểm cũ thành sai.
  long canChamLai=!doiDapAn?0L:jdbc.queryForObject("""
    select count(*) from assignment_progress ap join assignments a on a.id=ap.assignment_id and a.deleted_at is null
    where a.worksheet_id=? and ap.submitted_at is not null and ap.deleted_at is null""",Long.class,item.getWorksheetId());
  return ApiResponse.ok("Đã sửa câu",Map.of("worksheetId",item.getWorksheetId(),"soBaiCanChamLai",canChamLai));}
 /** Chỉ nội dung một câu; rỗng nghĩa là giữ nguyên. Không có trường nào đổi được cấu trúc phiếu. */
 public record SuaCauRequest(String contentSnapshot,String optionASnapshot,String optionBSnapshot,
   String optionCSnapshot,String optionDSnapshot,String answerSnapshot,String solutionSnapshot){}
 private void apply(Worksheet w,Request r){w.setName(r.name());w.setColumnsCount(r.columnsCount());w.setShowQr(r.showQr());w.setShowStudentFields(r.showStudentFields());}
 private void replaceItems(Long id,List<Long> problemIds){items.findByWorksheetIdOrderByOrderIndex(id).forEach(WorksheetItem::markDeleted);items.flush();int order=1;for(Long problemId:problemIds){Problem problem=problems.findById(problemId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài toán #"+problemId));if(!"PRACTICE".equals(problem.getProblemKind()))throw new BusinessException("Phiếu bài tập chỉ được chứa bài PRACTICE");WorksheetItem x=new WorksheetItem();x.setWorksheetId(id);x.setProblemId(problemId);x.setOrderIndex(order++);items.save(x);}}
 private String nextImportCode(int index){String base="IMP"+System.currentTimeMillis()+"-"+index;String code=base.length()>30?base.substring(0,30):base;while(problems.existsByPublicCode(code))code=("IMP"+UUID.randomUUID().toString().replace("-","")).substring(0,30);return code;}
 private Response map(Worksheet w){List<Item> rows=items.findByWorksheetIdOrderByOrderIndex(w.getId()).stream().map(x->{Problem p=problems.findById(x.getProblemId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài toán"));return new Item(x.getId(),p.getId(),x.getOrderIndex(),p.getPublicCode(),p.getQrSlug(),p.getStatementLatex(),p.getDifficulty(),x.getContentSnapshot(),x.getAnswerSnapshot());}).toList();return new Response(w.getId(),w.getName(),w.getColumnsCount(),w.getShowQr(),w.getShowStudentFields(),w.getCreatedBy(),w.getLessonId(),w.getStatus(),rows);}
 public record LessonAttachmentRequest(Long lessonId){}
}
