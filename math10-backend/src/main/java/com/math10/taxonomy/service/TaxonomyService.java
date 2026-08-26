package com.math10.taxonomy.service;

import com.math10.courses.dto.request.ReorderRequest;
import com.math10.taxonomy.dto.ArchiveResultResponse;
import com.math10.taxonomy.dto.DuplicateSuggestionResponse;
import com.math10.taxonomy.dto.MergeRequest;
import com.math10.taxonomy.dto.TaxonomyAliasRequest;
import com.math10.taxonomy.dto.TaxonomyNodeRequest;
import com.math10.taxonomy.dto.TaxonomyNodeResponse;
import com.math10.audit.dto.AuditLogResponse;

import java.util.List;

public interface TaxonomyService {
    /** Cây đầy đủ cho Admin — gồm cả mục đã lưu trữ để Admin còn khôi phục được. */
    List<TaxonomyNodeResponse> tree(String subject);

    /** Cây chỉ gồm mục đang hoạt động — dùng cho màn hình chỉ đọc của giáo viên. */
    List<TaxonomyNodeResponse> activeTree(String subject);

    TaxonomyNodeResponse create(Long parentId, TaxonomyNodeRequest request);

    TaxonomyNodeResponse update(Long id, TaxonomyNodeRequest request);

    TaxonomyNodeResponse move(Long id, Long newParentId);

    void delete(Long id);

    void reorder(Long parentId, ReorderRequest request);

    TaxonomyNodeResponse addAlias(Long nodeId, TaxonomyAliasRequest request);

    TaxonomyNodeResponse removeAlias(Long nodeId, Long aliasId);

    ArchiveResultResponse archive(Long id);

    ArchiveResultResponse archiveBranch(Long id);

    TaxonomyNodeResponse unarchive(Long id);

    void merge(MergeRequest request);

    List<DuplicateSuggestionResponse> duplicateSuggestions();

    List<AuditLogResponse> history(Long id);
}
