package com.math10.documents.support;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Quy ước đường dẫn file. Hai điều phải giữ:
 * <ul>
 *   <li>không có URL R2 nào lọt ra client — đó là cả lý do tồn tại của lớp này;</li>
 *   <li>đuôi file được giữ nguyên — frontend ({@code isPdfDocument}) phân biệt "xem trong app"
 *       hay "tải về" bằng {@code endsWith(".pdf")}, mất đuôi là PDF thôi mở trong trình xem.</li>
 * </ul>
 */
class DocumentUrlsTest {

    private static final String R2 = "https://files.example.com/documents/abc-123.pdf";

    @Test
    void contentUrlKhongTraUrlR2VaGiuDuoiFile() {
        String url = DocumentUrls.contentUrl(7L, "CHUYEN_DE", R2);

        assertThat(url).isEqualTo("/api/documents/7/content.pdf");
        assertThat(url).doesNotContain("files.example.com");
    }

    @Test
    void contentUrlGiuDuoiDocxDeFrontendBietLaTaiVe() {
        assertThat(DocumentUrls.contentUrl(7L, "CHUYEN_DE", "https://files.example.com/a/b.DOCX"))
                .isEqualTo("/api/documents/7/content.docx");
    }

    @Test
    void videoGiuNguyenViLaLinkNgoaiKhongNamTrenR2() {
        String youtube = "https://www.youtube.com/watch?v=abc";

        assertThat(DocumentUrls.contentUrl(7L, "VIDEO", youtube)).isEqualTo(youtube);
    }

    @Test
    void videoTaiLenNamTrenR2ThiVanDiQuaBackend() {
        String url = DocumentUrls.contentUrl(7L, "VIDEO", "https://files.example.com/documents/bai-giang.mp4");

        assertThat(url).isEqualTo("/api/documents/7/content.mp4");
        assertThat(DocumentUrls.contentUrl(7L, "VIDEO", "https://youtu.be/abc")).isEqualTo("https://youtu.be/abc");
        assertThat(DocumentUrls.contentUrl(7L, "VIDEO", "https://youtube.com.evil.example/x.mp4"))
                .isEqualTo("/api/documents/7/content.mp4");
    }

    @Test
    void khongDoanDuocDuoiThiCoiNhuPdf() {
        assertThat(DocumentUrls.contentUrl(7L, "CHUYEN_DE", "https://files.example.com/a/khong-duoi"))
                .isEqualTo("/api/documents/7/content.pdf");
        assertThat(DocumentUrls.contentUrl(7L, "CHUYEN_DE", "https://files.example.com/a/b.a-b-c"))
                .isEqualTo("/api/documents/7/content.pdf");
    }

    @Test
    void khongCoFileThiKhongDungRaDuongDan() {
        assertThat(DocumentUrls.contentUrl(7L, "CHUYEN_DE", null)).isNull();
        assertThat(DocumentUrls.contentUrl(7L, "CHUYEN_DE", "  ")).isEqualTo("  ");
    }

    @Test
    void taiLieuTrongBaiHocDiDuongRiengCuaBaiHoc() {
        // Quyền đến từ việc đang học bài đó, không từ audience của tài liệu — dùng
        // /api/documents/{id}/content sẽ chặn nhầm học sinh.
        assertThat(DocumentUrls.lessonContentUrl(3L, 9L, "CHUYEN_DE", R2))
                .isEqualTo("/api/lessons/3/documents/9/content.pdf");
    }

    @Test
    void anhBiaCungDiQuaBackend() {
        assertThat(DocumentUrls.thumbnailUrl(7L, "https://files.example.com/thumbs/7.png"))
                .isEqualTo("/api/documents/7/thumbnail");
        assertThat(DocumentUrls.thumbnailUrl(7L, null)).isNull();
    }

    @Test
    void maskGhiDeUrlThoTrenDongTruyVanNative() {
        Map<String, Object> row = new HashMap<>();
        row.put("document_id", 7L);
        row.put("doc_type", "CHUYEN_DE");
        row.put("file_url", R2);
        row.put("thumbnail_url", "https://files.example.com/thumbs/7.png");

        DocumentUrls.maskContent(row, "document_id", "doc_type", "file_url");
        DocumentUrls.maskThumbnail(row, "document_id", "thumbnail_url");

        assertThat(row.get("file_url")).isEqualTo("/api/documents/7/content.pdf");
        assertThat(row.get("thumbnail_url")).isEqualTo("/api/documents/7/thumbnail");
    }

    @Test
    void maskChiuDuocDongKhongCoTaiLieu() {
        // left join không khớp: mọi cột null, không được ném lỗi.
        Map<String, Object> row = new HashMap<>();
        row.put("document_id", null);
        row.put("doc_type", null);
        row.put("file_url", null);

        DocumentUrls.maskContent(row, "document_id", "doc_type", "file_url");

        assertThat(row.get("file_url")).isNull();
    }
}
