package com.math10.documents.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.documents.dto.DocumentResponse;
import com.math10.documents.dto.TextbookDetailResponse;
import com.math10.documents.dto.TextbookListResponse;
import com.math10.documents.dto.TextbookOpenResponse;
import com.math10.documents.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<DocumentResponse>> list() {
        return ApiResponse.ok("Lấy thư viện tài liệu thành công", documentService.listDocuments());
    }

    @GetMapping("/student")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<List<DocumentResponse>> listForStudent() {
        return ApiResponse.ok("Lấy tài liệu chuyên đề thành công", documentService.listStudentDocuments());
    }

    @GetMapping("/student/exams")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<List<DocumentResponse>> listExamsForStudent() {
        return ApiResponse.ok("Lấy đề thi thành công", documentService.listStudentExamDocuments());
    }

    /**
     * Byte PDF cho trình xem trong app. Phân quyền nằm trong service: học sinh chỉ đọc được
     * tài liệu đã mở cho học sinh và chưa bị ẩn.
     */
    @GetMapping("/{id}/content")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ResponseEntity<byte[]> content(@PathVariable Long id) {
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .body(documentService.readDocumentBytes(id));
    }

    // ==================== TEXTBOOK (SGK/SBT) — Public cho Student/Teacher ====================

    @GetMapping("/textbooks")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<List<TextbookListResponse>> listTextbooks(
            @RequestParam(required = false) Long gradeId,
            @RequestParam(required = false) Long subjectId
    ) {
        return ApiResponse.ok("Lấy danh sách sách giáo khoa thành công",
                documentService.listTextbooks(gradeId, subjectId));
    }

    @GetMapping("/textbooks/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<TextbookDetailResponse> getTextbook(@PathVariable Long id) {
        return ApiResponse.ok("Lấy chi tiết sách thành công", documentService.getTextbook(id));
    }

    @PostMapping("/textbooks/{id}/open")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<TextbookOpenResponse> openTextbook(
            @PathVariable Long id,
            @RequestParam(required = false) Integer bookPage
    ) {
        return ApiResponse.ok("Mở sách thành công", documentService.openTextbook(id, bookPage));
    }
}
