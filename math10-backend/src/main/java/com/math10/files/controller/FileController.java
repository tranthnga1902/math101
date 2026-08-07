package com.math10.files.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.files.dto.FileAssetResponse;
import com.math10.files.service.FileAccessService;
import com.math10.files.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.charset.StandardCharsets;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/files")
public class FileController {

    private final FileAccessService fileAccessService;
    private final FileStorageService fileStorageService;

    @PostMapping(consumes = "multipart/form-data")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<FileAssetResponse> upload(@RequestParam("file") MultipartFile file) {
        return ApiResponse.created("Tai file len thanh cong", fileStorageService.store(file));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER', 'STUDENT')")
    public ApiResponse<FileAssetResponse> viewFile(@PathVariable Long id) {
        return ApiResponse.ok("Lay thong tin file thanh cong", fileAccessService.getAuthorizedFile(id));
    }

    @GetMapping("/{id}/download")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER', 'STUDENT')")
    public ResponseEntity<Resource> download(@PathVariable Long id) {
        FileAssetResponse file = fileAccessService.getAuthorizedFile(id);
        Resource resource = fileStorageService.load(file.fileUrl());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(file.fileName(), StandardCharsets.UTF_8)
                        .build()
                        .toString())
                .contentType(MediaType.parseMediaType(file.mimeType()))
                .body(resource);
    }
}
