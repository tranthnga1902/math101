package com.math10.taxonomy.dto;

public record ArchiveResultResponse(
        TaxonomyNodeResponse node,
        int nodesArchivedCount,
        int openAssignmentsAffected,
        int questionsKept
) {
}
