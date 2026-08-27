package com.math10.documents.support;

import java.util.Locale;
import java.util.Map;

/**
 * Quy ước đường dẫn file tài liệu trả ra cho client.
 *
 * <p>API <b>không bao giờ</b> trả URL R2 thô: trình duyệt mở URL đó là bỏ qua toàn bộ kiểm
 * quyền (audience, chủ sở hữu, tài liệu bị ẩn), vì R2 không biết gì về người đang đăng nhập.
 * Mọi byte file đi qua endpoint có xác thực của backend, nơi guard thật sự chạy.
 *
 * <p>Đuôi file được giữ lại trong đường dẫn ({@code /content.pdf}, {@code /content.docx}) vì
 * frontend phân biệt "xem được trong app" hay "tải về" bằng đuôi file. Riêng VIDEO là link
 * YouTube ngoài, không nằm trên R2 nên giữ nguyên.
 */
public final class DocumentUrls {

    private static final String VIDEO = "VIDEO";
    private static final String DEFAULT_EXTENSION = "pdf";

    private DocumentUrls() {
    }

    public static String contentUrl(Long documentId, String docType, String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank() || documentId == null) {
            return fileUrl;
        }
        if (VIDEO.equals(docType)) {
            return fileUrl;
        }
        return "/api/documents/" + documentId + "/content." + extensionOf(fileUrl);
    }

    public static String lessonContentUrl(Long lessonId, Long lessonDocumentId, String docType, String fileUrl) {
        if (fileUrl == null || fileUrl.isBlank() || lessonId == null || lessonDocumentId == null) {
            return fileUrl;
        }
        if (VIDEO.equals(docType)) {
            return fileUrl;
        }
        return "/api/lessons/" + lessonId + "/documents/" + lessonDocumentId + "/content." + extensionOf(fileUrl);
    }

    public static String thumbnailUrl(Long documentId, String thumbnailUrl) {
        if (thumbnailUrl == null || thumbnailUrl.isBlank() || documentId == null) {
            return null;
        }
        return "/api/documents/" + documentId + "/thumbnail";
    }

    /** Đuôi file suy từ tên object trên R2; không đoán được thì coi như PDF. */
    public static String extensionOf(String fileUrl) {
        if (fileUrl == null) {
            return DEFAULT_EXTENSION;
        }
        int dot = fileUrl.lastIndexOf('.');
        if (dot < 0 || dot == fileUrl.length() - 1) {
            return DEFAULT_EXTENSION;
        }
        String extension = fileUrl.substring(dot + 1).toLowerCase(Locale.ROOT);
        return extension.matches("[a-z0-9]{1,8}") ? extension : DEFAULT_EXTENSION;
    }

    /**
     * Áp quy ước trên các dòng của một truy vấn native (những chỗ dùng {@code JdbcTemplate}
     * nên không đi qua mapper). Viết lại ngay trên map trả về, khoá cột do nơi gọi truyền vào
     * vì mỗi truy vấn đặt alias một kiểu.
     *
     * <p>Cố ý làm bằng Java chứ không viết {@code case when} trong SQL: quy ước đường dẫn chỉ
     * có một chỗ định nghĩa, sửa một lần là mọi endpoint theo.
     */
    public static void maskContent(Map<String, Object> row, String idKey, String docTypeKey, String fileUrlKey) {
        row.put(fileUrlKey, contentUrl(longOf(row.get(idKey)),
                (String) row.get(docTypeKey), (String) row.get(fileUrlKey)));
    }

    /** @see #maskContent */
    public static void maskThumbnail(Map<String, Object> row, String idKey, String thumbnailKey) {
        row.put(thumbnailKey, thumbnailUrl(longOf(row.get(idKey)), (String) row.get(thumbnailKey)));
    }

    private static Long longOf(Object value) {
        return value instanceof Number number ? number.longValue() : null;
    }
}
