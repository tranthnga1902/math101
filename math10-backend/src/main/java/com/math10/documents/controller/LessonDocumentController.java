package com.math10.documents.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.documents.dto.DocumentOpenResponse;
import com.math10.documents.dto.LessonDocumentProgressResponse;
import com.math10.documents.dto.LessonDocumentQuestionRequest;
import com.math10.documents.dto.LessonDocumentQuestionResponse;
import com.math10.documents.dto.LessonDocumentQuizSubmitRequest;
import com.math10.documents.dto.LessonDocumentRequest;
import com.math10.documents.dto.LessonDocumentResponse;
import com.math10.documents.dto.LessonDocumentStudyRequest;
import com.math10.documents.dto.LessonDocumentUpdateRequest;
import com.math10.documents.dto.MoveLessonDocumentRequest;
import com.math10.documents.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/lessons/{lessonId}/documents")
public class LessonDocumentController {

    private final DocumentService documentService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<List<LessonDocumentResponse>> list(@PathVariable Long lessonId) {
        return ApiResponse.ok("Lấy tài liệu của bài học thành công", documentService.listLessonDocuments(lessonId));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<LessonDocumentResponse> attach(@PathVariable Long lessonId, @Valid @RequestBody LessonDocumentRequest request) {
        return ApiResponse.created("Gắn tài liệu vào bài học thành công", documentService.attachToLesson(lessonId, request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<LessonDocumentResponse> update(
            @PathVariable Long lessonId,
            @PathVariable Long id,
            @RequestBody LessonDocumentUpdateRequest request
    ) {
        return ApiResponse.ok("Cập nhật tài liệu trong bài học thành công", documentService.updateLessonDocument(lessonId, id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> remove(@PathVariable Long lessonId, @PathVariable Long id) {
        documentService.removeLessonDocument(lessonId, id);
        return ApiResponse.noContent("Gỡ tài liệu khỏi bài học thành công");
    }

    @PatchMapping("/{id}/move")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<LessonDocumentResponse> move(
            @PathVariable Long lessonId,
            @PathVariable Long id,
            @Valid @RequestBody MoveLessonDocumentRequest request
    ) {
        return ApiResponse.ok("Sắp xếp tài liệu thành công", documentService.move(lessonId, id, request.direction()));
    }

    @GetMapping("/{id}/open")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<DocumentOpenResponse> open(@PathVariable Long lessonId, @PathVariable Long id) {
        return ApiResponse.ok("Mở tài liệu thành công", documentService.openLessonDocument(lessonId, id));
    }

    /**
     * Byte file cho trình xem trong app. Dùng cùng guard với {@code /open} nhưng không ghi
     * tiến độ, để một lần mở tài liệu không bị đếm hai lượt.
     *
     * <p>Quyền ở đây đến từ việc đang học bài này, không từ audience của tài liệu — nên tài
     * liệu trong bài học đi đường riêng chứ không dùng {@code /api/documents/{id}/content}.
     */
    @GetMapping({"/{id}/content", "/{id}/content.{ext}"})
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ResponseEntity<byte[]> content(@PathVariable Long lessonId,
                                          @PathVariable Long id,
                                          @PathVariable(required = false) String ext) {
        return ResponseEntity.ok()
                .contentType(DocumentController.mediaTypeFor(ext))
                .body(documentService.readLessonDocumentBytes(lessonId, id));
    }

    @GetMapping("/{id}/questions")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<List<LessonDocumentQuestionResponse>> questions(@PathVariable Long lessonId, @PathVariable Long id) {
        return ApiResponse.ok("Lấy câu hỏi kiểm tra thành công", documentService.listQuestions(lessonId, id));
    }

    @PostMapping("/{id}/questions")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<LessonDocumentQuestionResponse> addQuestion(
            @PathVariable Long lessonId,
            @PathVariable Long id,
            @Valid @RequestBody LessonDocumentQuestionRequest request
    ) {
        return ApiResponse.created("Thêm câu hỏi kiểm tra thành công", documentService.addQuestion(lessonId, id, request));
    }

    @DeleteMapping("/{id}/questions/{questionId}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> deleteQuestion(@PathVariable Long lessonId, @PathVariable Long id, @PathVariable Long questionId) {
        documentService.deleteQuestion(lessonId, id, questionId);
        return ApiResponse.noContent("Xóa câu hỏi kiểm tra thành công");
    }

    @PostMapping("/{id}/study")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<LessonDocumentProgressResponse> recordStudy(
            @PathVariable Long lessonId,
            @PathVariable Long id,
            @RequestBody LessonDocumentStudyRequest request
    ) {
        return ApiResponse.ok("Ghi nhận thời gian đọc thành công", documentService.recordStudy(lessonId, id, request));
    }

    @PostMapping("/{id}/quiz-submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<LessonDocumentProgressResponse> submitQuiz(
            @PathVariable Long lessonId,
            @PathVariable Long id,
            @RequestBody LessonDocumentQuizSubmitRequest request
    ) {
        return ApiResponse.ok("Nộp kiểm tra nhanh thành công", documentService.submitQuiz(lessonId, id, request));
    }
}
