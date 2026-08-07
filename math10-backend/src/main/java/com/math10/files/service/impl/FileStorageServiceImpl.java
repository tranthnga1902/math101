package com.math10.files.service.impl;

import com.math10.common.exception.BusinessException;
import com.math10.files.dto.FileAssetResponse;
import com.math10.files.entity.FileAsset;
import com.math10.files.repository.FileAssetRepository;
import com.math10.files.service.FileStorageService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class FileStorageServiceImpl implements FileStorageService {

    private static final Set<String> TYPES = Set.of("application/pdf", "image/png", "image/jpeg", "image/webp");

    private final FileAssetRepository repository;

    @Value("${math10.file-storage-path}")
    private String storagePath;

    @Override
    @Transactional
    public FileAssetResponse store(MultipartFile file) {
        if (file.isEmpty() || file.getOriginalFilename() == null) {
            throw new BusinessException("File rong");
        }
        String mime = Optional.ofNullable(file.getContentType()).orElse("application/octet-stream");
        if (!TYPES.contains(mime)) {
            throw new BusinessException("Chi ho tro PDF, PNG, JPG hoac WebP");
        }

        String original = Paths.get(file.getOriginalFilename()).getFileName().toString();
        String extension = original.contains(".")
                ? original.substring(original.lastIndexOf('.')).toLowerCase(Locale.ROOT)
                : "";
        String stored = UUID.randomUUID() + extension;

        try {
            Path root = storageRoot();
            Files.createDirectories(root);
            Path target = root.resolve(stored).normalize();
            if (!target.startsWith(root)) {
                throw new BusinessException("Ten file khong hop le");
            }
            file.transferTo(target);
        } catch (Exception e) {
            throw new BusinessException("Khong the luu file: " + e.getMessage());
        }

        FileAsset asset = new FileAsset();
        asset.setFileName(original);
        asset.setFileUrl("/protected-files/" + stored);
        asset.setMimeType(mime);
        asset.setFileSize(file.getSize());
        asset = repository.save(asset);
        return new FileAssetResponse(asset.getId(), asset.getFileName(), asset.getFileUrl(), asset.getMimeType(), asset.getFileSize());
    }

    @Override
    public Resource load(String fileUrl) {
        String storedName = Paths.get(fileUrl).getFileName().toString();
        try {
            Path root = storageRoot();
            Path target = root.resolve(storedName).normalize();
            if (!target.startsWith(root)) {
                throw new BusinessException("Duong dan file khong hop le");
            }
            Resource resource = new UrlResource(target.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw new BusinessException("File khong ton tai hoac khong doc duoc");
            }
            return resource;
        } catch (MalformedURLException e) {
            throw new BusinessException("Duong dan file khong hop le");
        }
    }

    private Path storageRoot() {
        return Paths.get(storagePath).toAbsolutePath().normalize();
    }
}
