package com.math10.documents.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.documents.service.AdminDocumentFolderService;
import com.math10.documents.service.AdminDocumentFolderService.FolderView;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/** Cây thư mục của kho tài liệu dùng chung. Không dùng @Valid: kiểm dữ liệu nằm trong service, để cổng vai trò chặn trước khi thân yêu cầu bị đọc. Danh sách trả phẳng kèm parentId; giao diện tự dựng cây. */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/document-folders")
@PreAuthorize("hasRole('ADMIN')")
public class AdminDocumentFolderController {

    private final AdminDocumentFolderService service;

    @GetMapping
    public ApiResponse<List<FolderView>> list() {
        return ApiResponse.ok("Danh sách thư mục", service.list());
    }

    @PostMapping
    public ApiResponse<FolderView> create(@RequestBody CreateRequest request) {
        return ApiResponse.created("Tạo thư mục thành công", service.create(request.name(), request.parentId()));
    }

    @PutMapping("/{id}")
    public ApiResponse<FolderView> rename(@PathVariable Long id, @RequestBody RenameRequest request) {
        return ApiResponse.ok("Đổi tên thư mục thành công", service.rename(id, request.name()));
    }

    @PatchMapping("/{id}/parent")
    public ApiResponse<FolderView> move(@PathVariable Long id, @RequestBody MoveFolderRequest request) {
        return ApiResponse.ok("Đã chuyển thư mục", service.move(id, request.parentId()));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ApiResponse.noContent("Đã xóa thư mục; nội dung bên trong được chuyển lên thư mục cha");
    }

    @PatchMapping("/documents")
    public ApiResponse<Integer> moveDocuments(@RequestBody MoveDocumentsRequest request) {
        return ApiResponse.ok("Đã chuyển tài liệu", service.moveDocuments(request.documentIds(), request.folderId()));
    }

    public record CreateRequest(String name, Long parentId) {
    }

    public record RenameRequest(String name) {
    }

    public record MoveFolderRequest(Long parentId) {
    }

    public record MoveDocumentsRequest(List<Long> documentIds, Long folderId) {
    }
}
