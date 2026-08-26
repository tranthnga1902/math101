package com.math10.documents.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.documents.dto.DocumentResponse;
import com.math10.documents.dto.DocumentUpdateRequest;
import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentType;
import com.math10.documents.service.DocumentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
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
@RequestMapping("/api/teacher/documents")
@PreAuthorize("hasRole('TEACHER')")
public class TeacherDocumentController {

    private final DocumentService documentService;

    @GetMapping
    public ApiResponse<List<DocumentResponse>> list() {
        return ApiResponse.ok("Lấy tài liệu của giáo viên thành công", documentService.listMyDocuments());
    }

    @PostMapping
    public ApiResponse<DocumentResponse> upload(
            @RequestParam String title,
            @RequestParam DocumentType docType,
            @RequestParam DocumentAudience audience,
            @RequestParam(required = false) Long gradeId,
            @RequestParam(required = false) Long chapterId,
            @RequestParam(required = false) MultipartFile file,
            @RequestParam(required = false) String videoUrl
    ) {
        return ApiResponse.ok("Tải tài liệu lên thành công",
                documentService.uploadMyDocument(title, docType, audience, gradeId, chapterId, file, videoUrl));
    }

    @PutMapping("/{id}")
    public ApiResponse<DocumentResponse> update(@PathVariable Long id, @Valid @RequestBody DocumentUpdateRequest request) {
        return ApiResponse.ok("Cập nhật tài liệu thành công", documentService.updateMyDocument(id, request));
    }

    @PatchMapping("/{id}/archive")
    public ApiResponse<DocumentResponse> archive(@PathVariable Long id) {
        return ApiResponse.ok("Lưu trữ tài liệu thành công", documentService.archiveMyDocument(id));
    }

    @PatchMapping("/{id}/restore")
    public ApiResponse<DocumentResponse> restore(@PathVariable Long id) {
        return ApiResponse.ok("Khôi phục tài liệu thành công", documentService.restoreMyDocument(id));
    }
}
