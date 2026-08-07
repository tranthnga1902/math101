package com.math10.documents.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.documents.dto.TextbookMappingHistoryEntry;
import com.math10.documents.dto.TextbookMappingHistoryResponse;
import com.math10.documents.dto.TextbookMappingProgressRequest;
import com.math10.documents.dto.TextbookMappingProgressResponse;
import com.math10.documents.service.TextbookMappingProgressService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/documents/textbooks/{id}/mapping-progress")
public class TextbookMappingProgressController {

    private final TextbookMappingProgressService service;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<TextbookMappingProgressResponse> get(@PathVariable("id") Long documentId) {
        return ApiResponse.ok("Lấy tiến độ khớp trang thành công", service.getProgress(documentId));
    }

    @PutMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<TextbookMappingProgressResponse> save(@PathVariable("id") Long documentId,
                                                            @Valid @RequestBody TextbookMappingProgressRequest request) {
        return ApiResponse.ok("Lưu tiến độ khớp trang thành công", service.saveProgress(documentId, request));
    }

    @GetMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<TextbookMappingHistoryResponse> history(@PathVariable("id") Long documentId) {
        return ApiResponse.ok("Lấy lịch sử khớp trang thành công", service.getHistory(documentId));
    }

    @PostMapping("/history")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<TextbookMappingHistoryResponse> appendHistory(@PathVariable("id") Long documentId,
                                                                    @RequestParam Integer pdfPage,
                                                                    @RequestParam Integer pdfAnchor,
                                                                    @RequestParam Integer bookAnchor,
                                                                    @RequestParam(required = false, defaultValue = "GOTO") String action) {
        return ApiResponse.ok("Ghi lịch sử khớp trang thành công",
                service.appendHistory(documentId, pdfPage, pdfAnchor, bookAnchor, action));
    }

    @GetMapping("/history/relative")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<TextbookMappingHistoryEntry> relative(@PathVariable("id") Long documentId,
                                                             @RequestParam String direction,
                                                             @RequestParam Long currentHistoryId) {
        TextbookMappingHistoryEntry entry = service.findRelative(documentId, direction, currentHistoryId);
        if (entry == null) {
            return ApiResponse.ok("Đã ở đầu/cuối lịch sử", null);
        }
        return ApiResponse.ok("Lấy lịch sử tương đối thành công", entry);
    }
}
