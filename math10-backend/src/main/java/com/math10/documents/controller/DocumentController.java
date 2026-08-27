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
import java.util.Locale;

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
     * Byte file cho trình xem trong app — cửa duy nhất tới file trên R2. Phân quyền nằm trong
     * service: học sinh chỉ đọc được tài liệu đã mở cho mình hoặc gắn vào lớp mình học, giáo
     * viên không đọc được tài liệu riêng của giáo viên khác.
     *
     * <p>Dạng có đuôi ({@code /content.pdf}) để trình duyệt và frontend biết đây là file gì;
     * dạng không đuôi giữ lại cho link cũ.
     */
    @GetMapping({"/{id}/content", "/{id}/content.{ext}"})
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ResponseEntity<byte[]> content(@PathVariable Long id,
                                          @PathVariable(required = false) String ext) {
        return ResponseEntity.ok()
                .contentType(mediaTypeFor(ext))
                .body(documentService.readDocumentBytes(id));
    }

    /** Ảnh bìa đi qua backend để bucket R2 có thể để private mà bìa vẫn hiện. */
    @GetMapping("/{id}/thumbnail")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ResponseEntity<byte[]> thumbnail(@PathVariable Long id) {
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .body(documentService.readDocumentThumbnailBytes(id));
    }

    /** Content-Type suy từ đuôi trong đường dẫn; đuôi do chính backend sinh ra nên tin được. */
    static MediaType mediaTypeFor(String extension) {
        if (extension == null || "pdf".equalsIgnoreCase(extension)) {
            return MediaType.APPLICATION_PDF;
        }
        return switch (extension.toLowerCase(Locale.ROOT)) {
            case "doc" -> MediaType.parseMediaType("application/msword");
            case "docx" -> MediaType.parseMediaType(
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
            default -> MediaType.APPLICATION_OCTET_STREAM;
        };
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
