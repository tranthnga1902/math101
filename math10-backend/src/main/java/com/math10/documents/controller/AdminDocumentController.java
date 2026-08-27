package com.math10.documents.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.documents.dto.DocumentResponse;
import com.math10.documents.dto.DocumentUpdateRequest;
import com.math10.documents.dto.TextbookListResponse;
import com.math10.documents.dto.TextbookPageOffsetRequest;
import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentType;
import com.math10.documents.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/documents")
public class AdminDocumentController {

    private final DocumentService documentService;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<DocumentResponse>> list() {
        return ApiResponse.ok("Lấy thư viện tài liệu thành công", documentService.listDocuments());
    }

    // Đã bỏ GET /content?url= : endpoint đó nhận URL bất kỳ rồi đọc thẳng object trên R2, tức
    // là một cửa đọc toàn bộ bucket cho mọi giáo viên. Byte file giờ đi qua
    // GET /api/documents/{id}/content, nơi có kiểm quyền theo từng tài liệu.

    @PostMapping(consumes = "multipart/form-data")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<DocumentResponse> upload(
            @RequestParam String title,
            @RequestParam DocumentType docType,
            @RequestParam DocumentAudience audience,
            @RequestParam(required = false) Long gradeId,
            @RequestParam(required = false) Long taxonomyNodeId,
            @RequestParam(required = false) MultipartFile file,
            @RequestParam(required = false) String videoUrl
    ) {
        return ApiResponse.created("Tải tài liệu lên thành công", documentService.upload(title, docType, audience, gradeId, taxonomyNodeId, file, videoUrl));
    }

    /** Tài liệu học của một mục trong cây phân loại (Chuyên đề / Bài / Dạng). */
    @GetMapping("/by-node/{nodeId}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<DocumentResponse>> listByNode(@PathVariable Long nodeId) {
        return ApiResponse.ok("Lấy tài liệu của mục thành công", documentService.listByTaxonomyNode(nodeId));
    }

    /** Gắn tài liệu vào một mục, hoặc gỡ khỏi mục khi taxonomyNodeId là null. */
    @PatchMapping("/{id}/taxonomy-node")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<DocumentResponse> setTaxonomyNode(@PathVariable Long id, @RequestBody TaxonomyNodeAssignRequest request) {
        return ApiResponse.ok(request.taxonomyNodeId() == null ? "Đã gỡ tài liệu khỏi mục" : "Đã gắn tài liệu vào mục",
                documentService.attachToTaxonomyNode(id, request.taxonomyNodeId()));
    }

    public record TaxonomyNodeAssignRequest(Long taxonomyNodeId) {
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<DocumentResponse> update(@PathVariable Long id, @Valid @RequestBody DocumentUpdateRequest request) {
        return ApiResponse.ok("Cập nhật tài liệu thành công", documentService.updateDocument(id, request));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        documentService.deleteDocument(id);
        return ApiResponse.noContent("Xóa tài liệu thành công");
    }

    @PostMapping("/{id}/convert-markdown")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<DocumentResponse> convertToMarkdown(@PathVariable Long id) {
        return ApiResponse.ok("Chuyển đổi sang Markdown thành công", documentService.convertToMarkdown(id));
    }

    /**
     * Lưu Markdown do trình duyệt của Admin OCR ra (dùng cho PDF scan — backend không có OCR).
     */
    @PatchMapping("/{id}/markdown")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<DocumentResponse> saveMarkdown(@PathVariable Long id, @RequestBody MarkdownSaveRequest request) {
        return ApiResponse.ok("Lưu nội dung Markdown thành công", documentService.saveMarkdown(id, request.contentMarkdown()));
    }

    public record MarkdownSaveRequest(String contentMarkdown) {
    }

    // ==================== TEXTBOOK (SGK/SBT) ====================

    @GetMapping("/textbooks")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<TextbookListResponse>> listTextbooks() {
        return ApiResponse.ok("Lấy danh sách sách giáo khoa thành công", documentService.listAllTextbooks());
    }

    @PostMapping(value = "/textbooks", consumes = "multipart/form-data")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<TextbookListResponse> uploadTextbook(
            @RequestParam String title,
            @RequestParam DocumentType docType,
            @RequestParam DocumentAudience audience,
            @RequestParam(required = false) Long gradeId,
            @RequestParam(required = false) Long subjectId,
            @RequestParam(required = false) Integer basePageOffset,
            @RequestParam("file") MultipartFile file
    ) {
        return ApiResponse.created("Upload sách giáo khoa thành công",
                documentService.uploadTextbook(title, docType, audience, gradeId, subjectId, basePageOffset, file));
    }

    @GetMapping("/textbooks/{id}")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<TextbookListResponse> getTextbook(@PathVariable Long id) {
        return ApiResponse.ok("Lấy chi tiết sách thành công", documentService.listAllTextbooks().stream()
                .filter(t -> t.id().equals(id)).findFirst()
                .orElseThrow(() -> new com.math10.common.exception.ResourceNotFoundException("Không tìm thấy sách")));
    }

    @PutMapping("/textbooks/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<TextbookListResponse> updateTextbook(@PathVariable Long id, @Valid @RequestBody DocumentUpdateRequest request) {
        return ApiResponse.ok("Cập nhật sách giáo khoa thành công", documentService.updateTextbook(id, request));
    }

    @PatchMapping("/textbooks/{id}/page-offset")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<TextbookListResponse> setPageOffset(@PathVariable Long id, @Valid @RequestBody TextbookPageOffsetRequest request) {
        return ApiResponse.ok("Đặt khớp trang thành công", documentService.setPageOffset(id, request.pdfPageForBookPageOne()));
    }

    @PatchMapping("/textbooks/{id}/publish")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<TextbookListResponse> publishTextbook(@PathVariable Long id) {
        return ApiResponse.ok("Xuất bản sách thành công", documentService.publishTextbook(id));
    }

    @PatchMapping("/textbooks/{id}/hide")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<TextbookListResponse> hideTextbook(@PathVariable Long id) {
        return ApiResponse.ok("Ẩn sách thành công", documentService.hideTextbook(id));
    }

    @PostMapping("/backfill-thumbnails")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<java.util.Map<String, Integer>> backfillThumbnails() {
        return ApiResponse.ok("Backfill thumbnail hoàn tất", documentService.backfillThumbnails());
    }
}
