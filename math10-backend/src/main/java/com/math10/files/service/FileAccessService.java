package com.math10.files.service;

import com.math10.files.dto.FileAssetResponse;

public interface FileAccessService {

    FileAssetResponse getAuthorizedFile(Long fileId);
}
