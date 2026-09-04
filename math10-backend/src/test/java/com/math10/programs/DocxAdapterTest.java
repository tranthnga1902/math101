package com.math10.programs;

import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DocxAdapterTest {

    @Test
    void docBangKhdhVaChuyenDeThanhCauTrucBonTang() throws Exception {
        RawTable result = DocxAdapter.read(fileKhdh());

        assertThat(result.detectedBookSeries()).isEqualTo("KNTT");
        assertThat(result.rows()).hasSize(4);

        RawRow lesson = result.rows().get(0);
        assertThat(lesson.namespace()).isEqualTo("MAIN");
        assertThat(lesson.chapterNumeral()).isEqualTo("I");
        assertThat(lesson.lessonName()).isEqualTo("Bài 1. Mệnh đề");
        assertThat(lesson.periodRange()).isEqualTo("1-4");
        assertThat(lesson.weekRange()).isEqualTo("1+2");

        RawRow review = result.rows().get(1);
        assertThat(review.chapterNumeral()).isEqualTo("I");
        assertThat(review.kind()).isEqualTo("REVIEW");

        RawRow exam = result.rows().get(2);
        assertThat(exam.semester()).isEqualTo("2");
        assertThat(exam.chapterNumeral()).isEqualTo("ĐG");
        assertThat(exam.chapterName()).isEqualTo("Kiểm tra và đánh giá");

        RawRow special = result.rows().get(3);
        assertThat(special.namespace()).isEqualTo("CĐ");
        assertThat(special.periodRange()).isEqualTo("1-5");
        assertThat(special.chapterNumeral()).isEqualTo("CĐ1");
        assertThat(special.chapterName()).isEqualTo("Chuyên đề 1");
        assertThat(special.lessonName()).isEqualTo("Bài 1. Hệ phương trình bậc nhất ba ẩn");
    }

    @Test
    void phanBoDaiTietQuaNhieuTuanKhongNhanCheo() {
        RawRow raw = RawRow.of(1, "MAIN", "DAI_SO", "Đại số", "1",
                "7-10", "2+3", "I", "Chương I", "Bài 2. Tập hợp", "LESSON");
        ProgramCourseImportService service = new ProgramCourseImportService(null, null, null, null, null);

        var rows = service.convertRawToRows(new RawTable(
                List.of(raw), RawTable.PeriodNumberingStyle.GLOBAL, "KNTT"));

        assertThat(rows).extracting(r -> r.periodNo()).containsExactly(7, 8, 9, 10);
        assertThat(rows).extracting(r -> r.weekNo()).containsExactly(2, 2, 3, 3);
    }

    @Test
    void kiemTongTietTheoDaiTietThayViDemDongDocx() {
        RawRow first = RawRow.of(1, "MAIN", "DAI_SO", "Đại số", "1",
                "1-4", "1+2", "I", "Chương I", "Bài 1. Mệnh đề", "LESSON");
        RawRow second = RawRow.of(2, "MAIN", "DAI_SO", "Đại số", "1",
                "5", "2", "I", "Chương I", "Bài tập cuối chương I", "REVIEW");

        var validation = RawTableValidator.validate(
                new RawTable(List.of(first, second), RawTable.PeriodNumberingStyle.GLOBAL, "KNTT"),
                5, 35);

        assertThat(validation.errors())
                .noneMatch(issue -> "TOTAL_MISMATCH".equals(issue.code()));
    }

    private byte[] fileKhdh() throws Exception {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            doc.createParagraph().createRun().setText("Kế hoạch dạy học Toán 10 - Kết nối tri thức");

            XWPFTable main = doc.createTable(1, 3);
            row(main.getRow(0), "Tuần", "Tên chủ đề/bài", "Tiết");
            row(main.createRow(), "", "HỌC KỲ I", "");
            row(main.createRow(), "1+2", "Chương I.Bài 1. Mệnh đề", "1 - 4");
            row(main.createRow(), "3", "Bài tập cuối chương I", "5");
            row(main.createRow(), "", "HỌC KỲ II", "");
            row(main.createRow(), "19", "KIỂM TRA GIỮA HỌC KÌ II", "54-55");

            XWPFTable special = doc.createTable(1, 3);
            row(special.getRow(0), "Tuần", "BÀI", "Số tiết");
            row(special.createRow(), "5+6", "Chuyên đề 1. Bài 1. Hệ phương trình bậc nhất ba ẩn", "CĐ1-CĐ5");

            doc.write(out);
            return out.toByteArray();
        }
    }

    private void row(XWPFTableRow row, String... values) {
        for (int i = 0; i < values.length; i++) row.getCell(i).setText(values[i]);
    }
}
