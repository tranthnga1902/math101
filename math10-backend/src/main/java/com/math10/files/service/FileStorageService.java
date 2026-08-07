package com.math10.files.service;

import com.math10.files.dto.FileAssetResponse;
import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface FileStorageService {
    FileAssetResponse store(MultipartFile file);

    Resource load(String fileUrl);
}
