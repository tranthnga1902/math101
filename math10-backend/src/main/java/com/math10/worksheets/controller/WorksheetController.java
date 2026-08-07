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
import com.math10.worksheets.dto.WorksheetDtos.*;
import com.math10.worksheets.entity.*;
import com.math10.worksheets.repository.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import java.util.*;
@RestController @RequiredArgsConstructor @RequestMapping("/api/worksheets") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
public class WorksheetController {
 private final WorksheetRepository worksheets; private final WorksheetItemRepository items; private final ProblemRepository problems; private final CurrentUserService current;
 private final LessonRepository lessons; private final ChapterRepository chapters; private final SecurityService security;
 @GetMapping public ApiResponse<List<Response>> list(){List<Worksheet> rows="ADMIN".equals(current.requireRoleCode())?worksheets.findAll():worksheets.findByCreatedByOrderByCreatedAtDesc(current.requireUserId());return ApiResponse.ok("Danh sách phiếu bài tập",rows.stream().map(this::map).toList());}
 @GetMapping("/{id}") public ApiResponse<Response> get(@PathVariable Long id){return ApiResponse.ok("Chi tiết phiếu bài tập",map(owned(id)));}
 @PostMapping @Transactional public ApiResponse<Response> create(@Valid @RequestBody Request r){Worksheet w=new Worksheet();w.setCreatedBy(current.requireUserId());apply(w,r);w=worksheets.save(w);replaceItems(w.getId(),r.problemIds());return ApiResponse.created("Tạo phiếu bài tập",map(w));}
 @PutMapping("/{id}") @Transactional public ApiResponse<Response> update(@PathVariable Long id,@Valid @RequestBody Request r){Worksheet w=owned(id);apply(w,r);replaceItems(id,r.problemIds());return ApiResponse.ok("Cập nhật phiếu bài tập",map(w));}
 @DeleteMapping("/{id}") @Transactional public ApiResponse<Void> delete(@PathVariable Long id){owned(id).markDeleted();items.findByWorksheetIdOrderByOrderIndex(id).forEach(WorksheetItem::markDeleted);return ApiResponse.noContent("Xóa phiếu bài tập");}
 @PatchMapping("/{id}/lesson") @Transactional public ApiResponse<Response> attachLesson(@PathVariable Long id,@RequestBody LessonAttachmentRequest request){Worksheet worksheet=owned(id);if(request.lessonId()!=null){Lesson lesson=lessons.findById(request.lessonId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài học"));var chapter=chapters.findById(lesson.getChapterId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương"));security.checkCourseOwnership(chapter.getCourseId());}worksheet.setLessonId(request.lessonId());return ApiResponse.ok(request.lessonId()==null?"Đã gỡ phiếu khỏi bài học":"Đã gắn phiếu vào bài học",map(worksheet));}
 private Worksheet owned(Long id){Worksheet w=worksheets.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy phiếu bài tập"));if(!"ADMIN".equals(current.requireRoleCode())&&!w.getCreatedBy().equals(current.requireUserId()))throw new AccessDeniedException("Không có quyền truy cập phiếu bài tập");return w;}
 private void apply(Worksheet w,Request r){w.setName(r.name());w.setColumnsCount(r.columnsCount());w.setShowQr(r.showQr());w.setShowStudentFields(r.showStudentFields());}
 private void replaceItems(Long id,List<Long> problemIds){items.findByWorksheetIdOrderByOrderIndex(id).forEach(WorksheetItem::markDeleted);items.flush();int order=1;for(Long problemId:problemIds){Problem problem=problems.findById(problemId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài toán #"+problemId));if(!"PRACTICE".equals(problem.getProblemKind()))throw new BusinessException("Phiếu bài tập chỉ được chứa bài PRACTICE");WorksheetItem x=new WorksheetItem();x.setWorksheetId(id);x.setProblemId(problemId);x.setOrderIndex(order++);items.save(x);}}
 private Response map(Worksheet w){List<Item> rows=items.findByWorksheetIdOrderByOrderIndex(w.getId()).stream().map(x->{Problem p=problems.findById(x.getProblemId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài toán"));return new Item(x.getId(),p.getId(),x.getOrderIndex(),p.getPublicCode(),p.getQrSlug(),p.getStatementLatex(),p.getDifficulty());}).toList();return new Response(w.getId(),w.getName(),w.getColumnsCount(),w.getShowQr(),w.getShowStudentFields(),w.getCreatedBy(),w.getLessonId(),rows);}
 public record LessonAttachmentRequest(Long lessonId){}
}
