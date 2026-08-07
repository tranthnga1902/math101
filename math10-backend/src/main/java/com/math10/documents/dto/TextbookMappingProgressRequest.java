package com.math10.documents.dto;

public record TextbookMappingProgressRequest(
        Integer pdfPage,
        Integer pdfAnchor,
        Integer bookAnchor,
        Integer zoom,
        Integer thumbPage
) {}
