package com.math10.taxonomy.controller;

import com.math10.audit.dto.AuditLogResponse;
import com.math10.common.dto.ApiResponse;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.taxonomy.dto.ArchiveResultResponse;
import com.math10.taxonomy.dto.DuplicateSuggestionResponse;
import com.math10.taxonomy.dto.MergeRequest;
import com.math10.taxonomy.dto.TaxonomyAliasRequest;
import com.math10.taxonomy.dto.TaxonomyNodeRequest;
import com.math10.taxonomy.dto.TaxonomyNodeResponse;
import com.math10.taxonomy.service.TaxonomyService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/taxonomy")
@PreAuthorize("hasRole('ADMIN')")
public class TaxonomyController {

    private final TaxonomyService taxonomyService;

    @GetMapping("/tree")
    public ApiResponse<List<TaxonomyNodeResponse>> tree(@RequestParam(required = false) String subject) {
        return ApiResponse.ok("Lấy cây phân loại thành công", taxonomyService.tree(subject));
    }

    @PostMapping("/nodes")
    public ApiResponse<TaxonomyNodeResponse> create(@RequestParam(required = false) Long parentId,
                                                      @Valid @RequestBody TaxonomyNodeRequest request) {
        return ApiResponse.created("Tạo mục phân loại thành công", taxonomyService.create(parentId, request));
    }

    @PutMapping("/nodes/{id}")
    public ApiResponse<TaxonomyNodeResponse> update(@PathVariable Long id, @Valid @RequestBody TaxonomyNodeRequest request) {
        return ApiResponse.ok("Cập nhật mục phân loại thành công", taxonomyService.update(id, request));
    }

    /** Chuyển một mục (kèm cả nhánh con) sang mục cha khác; newParentId để trống nghĩa là đưa lên làm Chuyên đề. */
    @PatchMapping("/nodes/{id}/move")
    public ApiResponse<TaxonomyNodeResponse> move(@PathVariable Long id, @RequestParam(required = false) Long newParentId) {
        return ApiResponse.ok("Chuyển mục thành công", taxonomyService.move(id, newParentId));
    }

    @DeleteMapping("/nodes/{id}")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        taxonomyService.delete(id);
        return ApiResponse.noContent("Xóa mục phân loại thành công");
    }

    @PatchMapping("/reorder")
    public ApiResponse<Void> reorder(@RequestParam(required = false) Long parentId, @Valid @RequestBody ReorderRequest request) {
        taxonomyService.reorder(parentId, request);
        return ApiResponse.ok("Sắp xếp thành công", null);
    }

    @PostMapping("/nodes/{id}/aliases")
    public ApiResponse<TaxonomyNodeResponse> addAlias(@PathVariable Long id, @Valid @RequestBody TaxonomyAliasRequest request) {
        return ApiResponse.created("Thêm tên gọi khác thành công", taxonomyService.addAlias(id, request));
    }

    @DeleteMapping("/nodes/{id}/aliases/{aliasId}")
    public ApiResponse<TaxonomyNodeResponse> removeAlias(@PathVariable Long id, @PathVariable Long aliasId) {
        return ApiResponse.ok("Xóa tên gọi khác thành công", taxonomyService.removeAlias(id, aliasId));
    }

    @PostMapping("/nodes/{id}/archive")
    public ApiResponse<ArchiveResultResponse> archive(@PathVariable Long id) {
        return ApiResponse.ok("Lưu trữ thành công", taxonomyService.archive(id));
    }

    @PostMapping("/nodes/{id}/archive-branch")
    public ApiResponse<ArchiveResultResponse> archiveBranch(@PathVariable Long id) {
        return ApiResponse.ok("Lưu trữ cả nhánh thành công", taxonomyService.archiveBranch(id));
    }

    @PostMapping("/nodes/{id}/unarchive")
    public ApiResponse<TaxonomyNodeResponse> unarchive(@PathVariable Long id) {
        return ApiResponse.ok("Khôi phục thành công", taxonomyService.unarchive(id));
    }

    @PostMapping("/merge")
    public ApiResponse<Void> merge(@Valid @RequestBody MergeRequest request) {
        taxonomyService.merge(request);
        return ApiResponse.ok("Gộp mục phân loại thành công", null);
    }

    @GetMapping("/duplicates")
    public ApiResponse<List<DuplicateSuggestionResponse>> duplicates() {
        return ApiResponse.ok("Lấy danh sách nghi trùng lặp thành công", taxonomyService.duplicateSuggestions());
    }

    @GetMapping("/nodes/{id}/history")
    public ApiResponse<List<AuditLogResponse>> history(@PathVariable Long id) {
        return ApiResponse.ok("Lấy lịch sử thành công", taxonomyService.history(id));
    }
}
