package com.math10.taxonomy.dto;

public record DuplicateSuggestionResponse(
        Long nodeAId,
        String nodeATitle,
        Long nodeBId,
        String nodeBTitle,
        double similarity
) {
}
