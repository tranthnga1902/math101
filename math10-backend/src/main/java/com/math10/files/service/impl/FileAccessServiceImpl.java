package com.math10.files.service.impl;

import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.SecurityService;
import com.math10.files.dto.FileAssetResponse;
import com.math10.files.repository.FileAssetRepository;
import com.math10.files.service.FileAccessService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FileAccessServiceImpl implements FileAccessService {

    private final FileAssetRepository fileAssetRepository;
    private final SecurityService securityService;

    @Override
    @Transactional(readOnly = true)
    public FileAssetResponse getAuthorizedFile(Long fileId) {
        var asset = fileAssetRepository.findById(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy file: " + fileId));

        securityService.checkFileAccess(asset.getId());
        return new FileAssetResponse(
                asset.getId(),
                asset.getFileName(),
                asset.getFileUrl(),
                asset.getMimeType(),
                asset.getFileSize()
        );
    }
}
