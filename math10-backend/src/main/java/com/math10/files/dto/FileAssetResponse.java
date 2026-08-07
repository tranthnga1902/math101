package com.math10.files.dto;

public record FileAssetResponse(
        Long id,
        String fileName,
        String fileUrl,
        String mimeType,
        Long fileSize
) {
}
