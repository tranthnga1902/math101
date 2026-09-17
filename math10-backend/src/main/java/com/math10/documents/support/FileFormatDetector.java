package com.math10.documents.support;

import com.math10.common.exception.BusinessException;
import com.math10.documents.entity.FileFormat;

import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Nhận định dạng file lúc tải lên. Quyết định theo đuôi file chứ không theo Content-Type trình duyệt
 * gửi: cùng một file .zip, Chrome trên Windows báo {@code application/x-zip-compressed}, nơi khác báo
 * {@code application/zip} hay {@code application/octet-stream}.
 *
 * <p>Gói .zip phải được mở ra xem: có {@code tincan.xml}/{@code cmi5.xml} là xAPI, có
 * {@code imsmanifest.xml} là SCORM. Chỉ đọc tên mục trong gói, không giải nén nội dung.
 */
public final class FileFormatDetector {

    private static final Map<String, FileFormat> BY_EXTENSION = Map.ofEntries(
            Map.entry("pdf", FileFormat.PDF),
            Map.entry("doc", FileFormat.WORD),
            Map.entry("docx", FileFormat.WORD),
            Map.entry("xls", FileFormat.EXCEL),
            Map.entry("xlsx", FileFormat.EXCEL),
            Map.entry("ppt", FileFormat.POWERPOINT),
            Map.entry("pptx", FileFormat.POWERPOINT),
            Map.entry("mp4", FileFormat.VIDEO),
            Map.entry("webm", FileFormat.VIDEO),
            Map.entry("mov", FileFormat.VIDEO),
            Map.entry("m4v", FileFormat.VIDEO)
    );

    public static final String ALLOWED_HINT =
            "Chỉ hỗ trợ Word (.doc, .docx), Excel (.xls, .xlsx), PowerPoint (.ppt, .pptx), PDF, "
                    + "video (.mp4, .webm, .mov, .m4v) và gói SCORM/xAPI (.zip)";

    private FileFormatDetector() {
    }

    public static String extensionOf(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        return dot < 0 ? "" : filename.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    /** @param zipContent chỉ được mở khi đuôi là .zip */
    public static FileFormat detect(String filename, InputStreamSource zipContent) {
        String extension = extensionOf(filename);
        FileFormat format = BY_EXTENSION.get(extension);
        if (format != null) {
            return format;
        }
        if (!"zip".equals(extension)) {
            throw new BusinessException(ALLOWED_HINT);
        }
        try (InputStream in = zipContent.open()) {
            return detectPackage(in);
        } catch (IOException e) {
            throw new BusinessException("Không đọc được file .zip: " + e.getMessage());
        }
    }

    static FileFormat detectPackage(InputStream in) throws IOException {
        boolean scorm = false;
        boolean anyEntry = false;
        try (ZipInputStream zip = new ZipInputStream(in)) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                anyEntry = true;
                String name = entry.getName().replace('\\', '/');
                String base = name.substring(name.lastIndexOf('/') + 1).toLowerCase(Locale.ROOT);
                if ("tincan.xml".equals(base) || "cmi5.xml".equals(base)) {
                    return FileFormat.XAPI;
                }
                if ("imsmanifest.xml".equals(base)) {
                    scorm = true;
                }
            }
        }
        if (scorm) {
            return FileFormat.SCORM;
        }
        throw new BusinessException(anyEntry
                ? "File .zip không phải gói SCORM (thiếu imsmanifest.xml) hay xAPI (thiếu tincan.xml/cmi5.xml)"
                : "File .zip rỗng hoặc hỏng");
    }

    @FunctionalInterface
    public interface InputStreamSource {
        InputStream open() throws IOException;
    }
}
