package com.math10.common.storage;

import com.math10.common.exception.BusinessException;
import jakarta.annotation.PostConstruct;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.IOException;
import java.net.URI;
import java.time.Duration;
import java.util.UUID;

@Slf4j
@Service
public class R2StorageServiceImpl implements StorageService {

    @Value("${math10.cloudflare.r2.account-id:}")
    private String accountId;

    @Value("${math10.cloudflare.r2.access-key:}")
    private String accessKey;

    @Value("${math10.cloudflare.r2.secret-key:}")
    private String secretKey;

    @Value("${math10.cloudflare.r2.bucket:}")
    private String bucket;

    @Value("${math10.cloudflare.r2.public-url:}")
    private String publicUrl;

    private S3Client s3;
    private S3Presigner presigner;

    @PostConstruct
    public void init() {
        if (accountId == null || accountId.isBlank()
                || accessKey == null || accessKey.isBlank()
                || secretKey == null || secretKey.isBlank()
                || bucket == null || bucket.isBlank()) {
            log.warn("⚠️ R2 Storage chưa được cấu hình đầy đủ — upload sẽ bị lỗi");
            return;
        }
        URI endpoint = URI.create("https://" + accountId + ".r2.cloudflarestorage.com");
        StaticCredentialsProvider credentials = StaticCredentialsProvider.create(
                AwsBasicCredentials.create(accessKey, secretKey));
        this.s3 = S3Client.builder()
                .endpointOverride(endpoint)
                .credentialsProvider(credentials)
                .region(Region.of("auto"))
                .build();
        this.presigner = S3Presigner.builder()
                .endpointOverride(endpoint)
                .credentialsProvider(credentials)
                .region(Region.of("auto"))
                .build();
        log.info("✅ R2StorageService connected | bucket={}", bucket);
    }

    @Override
    public String upload(MultipartFile file, String folder) throws IOException {
        if (file == null || file.isEmpty() || file.getOriginalFilename() == null) {
            throw new BusinessException("File không được rỗng");
        }
        if (s3 == null) {
            throw new BusinessException("R2 Storage chưa được cấu hình");
        }
        long sizeBytes = file.getSize();
        if (sizeBytes > 500L * 1024L * 1024L) {
            throw new BusinessException("File vượt quá 500MB");
        }

        String ext = getExtension(file.getOriginalFilename());
        String key = (folder == null ? "" : folder + "/")
                + UUID.randomUUID() + "." + ext;

        log.info("Uploading → R2 key={} size={}KB", key, sizeBytes / 1024);

        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(file.getContentType())
                        .contentLength(sizeBytes)
                        .build(),
                RequestBody.fromBytes(file.getBytes())
        );

        String fileUrl = (publicUrl == null || publicUrl.isBlank()
                ? "https://" + bucket + ".r2.dev"
                : publicUrl)
                + "/" + key;
        log.info("Upload success → {}", fileUrl);
        return fileUrl;
    }

    @Override
    public String uploadBytes(byte[] bytes, String contentType, String folder, String extension) throws IOException {
        if (bytes == null || bytes.length == 0) {
            throw new BusinessException("Dữ liệu upload rỗng");
        }
        if (s3 == null) {
            throw new BusinessException("R2 Storage chưa được cấu hình");
        }
        String key = (folder == null ? "" : folder + "/")
                + UUID.randomUUID() + "." + extension;
        log.info("Uploading bytes → R2 key={} size={}B", key, bytes.length);
        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(contentType)
                        .contentLength((long) bytes.length)
                        .build(),
                RequestBody.fromBytes(bytes)
        );
        String fileUrl = (publicUrl == null || publicUrl.isBlank()
                ? "https://" + bucket + ".r2.dev"
                : publicUrl)
                + "/" + key;
        log.info("Upload bytes success → {}", fileUrl);
        return fileUrl;
    }

    @Override
    public void delete(String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank() || s3 == null) return;

        String key;
        if (publicUrl != null && !publicUrl.isBlank()
                && fileUrl.startsWith(publicUrl + "/")) {
            key = fileUrl.substring(publicUrl.length() + 1);
        } else if (fileUrl.contains("/")) {
            key = fileUrl.substring(fileUrl.indexOf("/", fileUrl.indexOf("://") + 3) + 1);
        } else {
            return;
        }

        log.info("Deleting from R2: key={}", key);
        s3.deleteObject(DeleteObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .build());
    }

    public URI presignPut(String objectKey, String contentType, Duration duration) {
        if (presigner == null) {
            throw new BusinessException("R2 Storage chưa được cấu hình");
        }
        PutObjectRequest objectRequest = PutObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .contentType(contentType)
                .build();
        return URI.create(presigner.presignPutObject(PutObjectPresignRequest.builder()
                        .signatureDuration(duration)
                        .putObjectRequest(objectRequest)
                        .build())
                .url().toString());
    }

    /** Upload to a caller-owned private object key (used by server-proxied imports). */
    public void putObject(String objectKey, byte[] bytes, String contentType) {
        if (s3 == null) {
            throw new BusinessException("R2 Storage chưa được cấu hình");
        }
        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(objectKey)
                        .contentType(contentType)
                        .contentLength((long) bytes.length)
                        .build(),
                RequestBody.fromBytes(bytes)
        );
    }

    public byte[] readObject(String objectKey) {
        if (s3 == null) {
            throw new BusinessException("R2 Storage chưa được cấu hình");
        }
        // Không chặn dung lượng ở đây: hàm này còn dùng để đọc PDF (sách giáo khoa vài trăm
        // trang thường nặng hơn 10MB). Giới hạn của luồng import Excel nằm trong UserImportService.
        return s3.getObjectAsBytes(GetObjectRequest.builder()
                .bucket(bucket)
                .key(objectKey)
                .build()).asByteArray();
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "bin";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}
