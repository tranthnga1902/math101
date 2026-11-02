package com.math10.documents.support;

import com.math10.common.exception.BusinessException;
import com.math10.documents.entity.FileFormat;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class FileFormatDetectorTest {

    private static final FileFormatDetector.InputStreamSource KHONG_DUOC_MO = () -> {
        throw new AssertionError("Không phải .zip thì không được mở nội dung");
    };

    @Test
    void nhanTheoDuoiKhongPhanBietHoaThuong() {
        assertThat(FileFormatDetector.detect("De thi.DOCX", KHONG_DUOC_MO)).isEqualTo(FileFormat.WORD);
        assertThat(FileFormatDetector.detect("bang.xlsx", KHONG_DUOC_MO)).isEqualTo(FileFormat.EXCEL);
        assertThat(FileFormatDetector.detect("slide.ppt", KHONG_DUOC_MO)).isEqualTo(FileFormat.POWERPOINT);
        assertThat(FileFormatDetector.detect("sach.pdf", KHONG_DUOC_MO)).isEqualTo(FileFormat.PDF);
        assertThat(FileFormatDetector.detect("bai-giang.mov", KHONG_DUOC_MO)).isEqualTo(FileFormat.VIDEO);
    }

    @Test
    void fileHtmlDonLaHtml() {
        assertThat(FileFormatDetector.detect("Tap-hop.HTML", KHONG_DUOC_MO)).isEqualTo(FileFormat.HTML);
        assertThat(FileFormatDetector.detect("bai.htm", KHONG_DUOC_MO)).isEqualTo(FileFormat.HTML);
    }

    @Test
    void goiCoIndexHtmlMaKhongCoMoTaLaHtml() throws IOException {
        byte[] zip = zipOf("bai-1/index.html", "bai-1/css/style.css", "bai-1/images/hinh.png");
        assertThat(FileFormatDetector.detect("bai-1.zip", () -> new ByteArrayInputStream(zip))).isEqualTo(FileFormat.HTML);
    }

    @Test
    void duoiLaThiTuChoi() {
        assertThatThrownBy(() -> FileFormatDetector.detect("virus.exe", KHONG_DUOC_MO))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> FileFormatDetector.detect("khong-duoi", KHONG_DUOC_MO))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void goiCoTincanLaXapi() throws IOException {
        byte[] zip = zipOf("course/imsmanifest.xml", "course/tincan.xml");
        assertThat(FileFormatDetector.detect("goi.zip", () -> new ByteArrayInputStream(zip))).isEqualTo(FileFormat.XAPI);
    }

    @Test
    void goiCoCmi5LaXapi() throws IOException {
        byte[] zip = zipOf("cmi5.xml", "index.html");
        assertThat(FileFormatDetector.detect("goi.zip", () -> new ByteArrayInputStream(zip))).isEqualTo(FileFormat.XAPI);
    }

    @Test
    void goiCoImsmanifestLaScorm() throws IOException {
        byte[] zip = zipOf("imsmanifest.xml", "shared/launch.html");
        assertThat(FileFormatDetector.detect("goi.ZIP", () -> new ByteArrayInputStream(zip))).isEqualTo(FileFormat.SCORM);
    }

    @Test
    void zipThuongBiTuChoi() throws IOException {
        byte[] zip = zipOf("anh.png", "ghi-chu.txt");
        assertThatThrownBy(() -> FileFormatDetector.detect("anh.zip", () -> new ByteArrayInputStream(zip)))
                .isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> FileFormatDetector.detect("hong.zip", () -> new ByteArrayInputStream(new byte[]{1, 2, 3})))
                .isInstanceOf(BusinessException.class);
    }

    private static byte[] zipOf(String... names) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (String name : names) {
                zip.putNextEntry(new ZipEntry(name));
                zip.write("x".getBytes());
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }
}
