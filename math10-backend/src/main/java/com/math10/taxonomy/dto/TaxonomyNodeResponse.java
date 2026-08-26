package com.math10.taxonomy.dto;

import com.math10.taxonomy.entity.TaxonomyStatus;

import java.util.List;

public record TaxonomyNodeResponse(
        Long id,
        Long parentId,
        Integer depth,
        String title,
        String description,
        String slug,
        Integer orderNo,
        Long proposedBy,
        TaxonomyStatus status,
        Long mergedInto,
        int questionCountShared,
        int questionCountPrivate,
        int documentCount,
        int worksheetCount,
        List<TaxonomyAliasView> aliases
) {
}
