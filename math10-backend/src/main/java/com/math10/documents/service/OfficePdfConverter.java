package com.math10.documents.service;

import com.math10.common.exception.BusinessException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import java.util.stream.Stream;

/**
 * Đổi Word/Excel/PowerPoint sang PDF bằng LibreOffice headless, để trình xem PDF trong app hiển
 * thị được mọi tài liệu Office giống bản gốc (kể cả slide PowerPoint).
 *
 * <p>Mỗi file chỉ đổi <b>một lần</b>: kết quả lưu ở đĩa, khóa theo URL object trên R2 — thay file
 * là URL đổi nên bản cũ tự hết hiệu lực. Mất thư mục cache (redeploy) thì lần xem kế tiếp đổi lại.
 */
@Slf4j
@Service
public class OfficePdfConverter {

    /** LibreOffice ngốn RAM; chạy song song quá nhiều là máy chủ nghẹt. */
    private static final Semaphore SLOTS = new Semaphore(2);
    private static final long TIMEOUT_SECONDS = 180;

    private final String sofficePath;
    private final Path cacheDir;

    public OfficePdfConverter(@Value("${math10.office.soffice-path:soffice}") String sofficePath,
                              @Value("${math10.file-storage-path}") String storagePath) {
        this.sofficePath = sofficePath;
        this.cacheDir = Path.of(storagePath, "previews").toAbsolutePath().normalize();
    }

    /**
     * @param cacheKey định danh bản gốc (URL object); cùng key thì dùng lại PDF đã đổi
     * @param extension đuôi file gốc (docx, xlsx, pptx…) — LibreOffice chọn bộ lọc theo đuôi
     * @param source chỉ được gọi khi chưa có bản PDF trong cache
     */
    public byte[] toPdf(String cacheKey, String extension, Supplier<byte[]> source) {
        Path cached = cacheDir.resolve(sha256(cacheKey) + ".pdf");
        try {
            if (Files.isRegularFile(cached) && Files.size(cached) > 0) {
                return Files.readAllBytes(cached);
            }
            Files.createDirectories(cacheDir);
            byte[] pdf = convert(source.get(), extension);
            Path temp = Files.createTempFile(cacheDir, "tmp-", ".pdf");
            Files.write(temp, pdf);
            Files.move(temp, cached, java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                    java.nio.file.StandardCopyOption.ATOMIC_MOVE);
            return pdf;
        } catch (IOException e) {
            throw new BusinessException("Không đọc/ghi được bản xem trước: " + e.getMessage());
        }
    }

    private byte[] convert(byte[] original, String extension) throws IOException {
        if (!SLOTS.tryAcquire()) {
            try {
                if (!SLOTS.tryAcquire(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                    throw new BusinessException("Máy chủ đang bận chuyển đổi tài liệu, vui lòng thử lại sau ít phút");
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new BusinessException("Chuyển đổi tài liệu bị hủy");
            }
        }
        Path work = Files.createTempDirectory("math10-office-");
        try {
            Path input = work.resolve("source." + extension);
            Files.write(input, original);
            // Mỗi lần chạy một hồ sơ người dùng riêng: hai tiến trình soffice dùng chung hồ sơ
            // thì tiến trình sau thoát ngay mà không đổi gì.
            String profile = work.resolve("profile").toUri().toString();
            ProcessBuilder builder = new ProcessBuilder(List.of(
                    sofficePath, "-env:UserInstallation=" + profile,
                    "--headless", "--norestore", "--nolockcheck",
                    "--convert-to", "pdf", "--outdir", work.toString(), input.toString()))
                    .redirectErrorStream(true)
                    .redirectOutput(work.resolve("soffice.log").toFile());
            Process process;
            try {
                process = builder.start();
            } catch (IOException e) {
                log.warn("Không chạy được LibreOffice ({}): {}", sofficePath, e.getMessage());
                throw new BusinessException("Máy chủ chưa cài LibreOffice nên chưa xem được Word/Excel/PowerPoint "
                        + "trong app. Hãy tải file về để xem.");
            }
            if (!process.waitFor(TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new BusinessException("Chuyển đổi tài liệu quá lâu, vui lòng tải file về để xem");
            }
            Path output = work.resolve("source.pdf");
            if (process.exitValue() != 0 || !Files.isRegularFile(output)) {
                String logText = Files.exists(work.resolve("soffice.log"))
                        ? Files.readString(work.resolve("soffice.log"), StandardCharsets.UTF_8) : "";
                log.warn("LibreOffice đổi {} thất bại (exit {}): {}", extension, process.exitValue(), logText);
                throw new BusinessException("Không chuyển được tài liệu sang dạng xem trước — file có thể bị hỏng");
            }
            return Files.readAllBytes(output);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new BusinessException("Chuyển đổi tài liệu bị hủy");
        } finally {
            SLOTS.release();
            deleteQuietly(work);
        }
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    static void deleteQuietly(Path dir) {
        try (Stream<Path> walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                    // file tạm của hệ điều hành, dọn không được thì thôi
                }
            });
        } catch (IOException ignored) {
            // như trên
        }
    }
}
