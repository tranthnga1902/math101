package com.math10.common.storage;

import com.math10.common.exception.BusinessException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Suy ra object key trên R2 từ fileUrl đang lưu trong DB.
 *
 * <p>Đây là guard bảo mật của mọi endpoint trả byte file, nên chỉ giữ ở một chỗ:
 * fileUrl phải nằm dưới đúng domain công khai đã cấu hình, và key không được chứa
 * ".." để không leo ra ngoài thư mục.
 */
@Component
public class StorageUrlSupport {

    @Value("${math10.cloudflare.r2.public-url:}")
    private String publicUrl;

    public String objectKeyFor(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank()) {
            throw new BusinessException("Đường dẫn tài liệu không hợp lệ");
        }
        String allowedBase = publicUrl == null ? "" : publicUrl.strip().replaceAll("/+$", "");
        if (allowedBase.isBlank() || !(fileUrl.equals(allowedBase) || fileUrl.startsWith(allowedBase + "/"))) {
            throw new BusinessException("Đường dẫn tài liệu không hợp lệ");
        }
        String objectKey = fileUrl.substring(allowedBase.length()).replaceFirst("^/+", "");
        if (objectKey.isBlank() || objectKey.contains("..")) {
            throw new BusinessException("Đường dẫn tài liệu không hợp lệ");
        }
        return objectKey;
    }
}
