package com.math10.taxonomy.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.taxonomy.dto.TaxonomyNodeResponse;
import com.math10.taxonomy.service.TaxonomyService;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Cây phân loại ở chế độ chỉ đọc. Nội dung học do Admin biên soạn; giáo viên chỉ xem,
 * không thêm/sửa/xóa và cũng không đề xuất — mọi endpoint ghi đều nằm ở /api/admin/taxonomy.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/taxonomy")
public class TaxonomyReadController {

    private final TaxonomyService taxonomyService;

    @GetMapping("/tree")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
    public ApiResponse<List<TaxonomyNodeResponse>> tree(@RequestParam(required = false) String subject) {
        return ApiResponse.ok("Lấy cây phân loại thành công", taxonomyService.activeTree(subject));
    }
}
