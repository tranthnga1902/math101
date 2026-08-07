package com.math10.common.storage;

import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;

public interface StorageService {
    String upload(MultipartFile file, String folder) throws IOException;
    String uploadBytes(byte[] bytes, String contentType, String folder, String extension) throws IOException;
    byte[] readObject(String objectKey);
    void delete(String fileUrl);
}
