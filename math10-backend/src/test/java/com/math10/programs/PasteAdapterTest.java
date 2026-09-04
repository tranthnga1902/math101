package com.math10.programs;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.*;

@DisplayName("PasteAdapter + ColumnMatcher — parse clipboard TSV")
class PasteAdapterTest {

    // ==================== PasteAdapter.parseTsv ====================

    @Nested
    @DisplayName("parseTsv")
    class ParseTsv {

        @Test
        @DisplayName("Bảng đơn giản 3 cột × 2 dòng")
        void bangDonGian() {
            String tsv = "A\tB\tC\nX\tY\tZ";
            var result = PasteAdapter.parseTsv(tsv);
            assertThat(result).hasSize(2);
            assertThat(result.get(0)).containsExactly("A", "B", "C");
            assertThat(result.get(1)).containsExactly("X", "Y", "Z");
        }

        @Test
        @DisplayName("Ô bọc nháy kép chứa tab")
        void oChaNhayKepTabBenTrong() {
            String tsv = "\"A\tB\"\tC";
            var result = PasteAdapter.parseTsv(tsv);
            assertThat(result.get(0)).containsExactly("A\tB", "C");
        }

        @Test
        @DisplayName("Ô bọc nháy kép chứa newline (Word style)")
        void oChaNhayKepNewlineBenTrong() {
            String tsv = "\"Dòng 1\nDòng 2\"\tB";
            var result = PasteAdapter.parseTsv(tsv);
            assertThat(result).hasSize(1);
            assertThat(result.get(0).get(0)).isEqualTo("Dòng 1\nDòng 2");
        }

        @Test
        @DisplayName("Nháy kép thoát \"\" trong ô")
        void nhayKepThoat() {
            String tsv = "\"Nháy \"\"kép\"\"\"\tB";
            var result = PasteAdapter.parseTsv(tsv);
            assertThat(result.get(0).get(0)).isEqualTo("Nháy \"kép\"");
        }

        @Test
        @DisplayName("CRLF \\r\\n tách dòng")
        void crlf() {
            String tsv = "A\tB\r\nX\tY";
            var result = PasteAdapter.parseTsv(tsv);
            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("Trailing newline không tạo dòng rỗng thừa")
        void trailingNewline() {
            String tsv = "A\tB\nX\tY\n";
            var result = PasteAdapter.parseTsv(tsv);
            assertThat(result).hasSize(2);
        }
    }

    // ==================== PasteAdapter.parse ====================

    @Nested
    @DisplayName("parse — full pipeline")
    class Parse {

        @Test
        @DisplayName("105 dòng bài học → 105 dòng RawRow (không có header)")
        void tramNamDong() {
            StringBuilder sb = new StringBuilder();
            for (int i = 1; i <= 105; i++) {
                // namespace, strandCode, strandName, semester, periodRange, weekRange,
                // chapterNumeral, chapterName, lessonName, kind
                sb.append("MAIN\tDS\tĐại số\t1\t").append(i).append("\t")
                  .append((i / 3) + 1).append("\tI\tChương I\tBài ").append(i).append("\tLESSON\n");
            }
            RawTable table = PasteAdapter.parse(sb.toString(), false);
            assertThat(table.rows()).hasSize(105);
            assertThat(table.style()).isEqualTo(RawTable.PeriodNumberingStyle.GLOBAL);
        }

        @Test
        @DisplayName("Có dòng header — bỏ dòng đầu, đọc đúng cột qua ColumnMatcher")
        void voDongHeader() {
            String tsv = "MẠCH\tBÀI HỌC\tTIẾT\tHỌC KỲ\tLOẠI\n" +
                         "DS\tBài 1\t1\t1\tLESSON\n" +
                         "DS\tBài 2\t2\t1\tLESSON";
            RawTable table = PasteAdapter.parse(tsv, true);
            assertThat(table.rows()).hasSize(2);
            assertThat(table.rows().get(0).strandCode()).isEqualTo("DS");
            assertThat(table.rows().get(0).lessonName()).isEqualTo("Bài 1");
            assertThat(table.rows().get(0).periodRange()).isEqualTo("1");
            assertThat(table.rows().get(0).semester()).isEqualTo("1");
        }

        @Test
        @DisplayName("Dòng trống bị bỏ qua")
        void dongTrongBoQua() {
            String tsv = "MAIN\tDS\t\t1\t1\t1\t\t\tBài 1\tLESSON\n" +
                         "\t\t\t\t\t\t\t\t\t\n" +  // dòng trống
                         "MAIN\tDS\t\t1\t2\t1\t\t\tBài 2\tLESSON";
            RawTable table = PasteAdapter.parse(tsv, false);
            assertThat(table.rows()).hasSize(2);
        }

        @Test
        @DisplayName("Namespace mặc định MAIN nếu không có cột namespace")
        void namespaceMacDinh() {
            // Chỉ 9 cột — không có cột namespace ở đầu
            // Khi dùng mapping tường minh bỏ qua cột 0 (strandCode vào index 0)
            Map<Integer, String> mapping = Map.of(
                    0, "strandCode",
                    1, "semester",
                    2, "periodRange",
                    3, "lessonName",
                    4, "kind"
            );
            String tsv = "DS\t1\t1\tBài 1\tLESSON";
            RawTable table = PasteAdapter.parse(tsv, false, mapping);
            assertThat(table.rows().get(0).namespace()).isEqualTo("MAIN");
        }
    }

    // ==================== ColumnMatcher ====================

    @Nested
    @DisplayName("ColumnMatcher")
    class ColMatch {

        private final Map<String, String> sampleDict = Map.of(
                "tuan", "weekRange",
                "tiet", "periodRange",
                "tiet hoc", "periodRange",
                "hoc ky", "semester",
                "mach", "strandCode",
                "bai hoc", "lessonName",
                "loai", "kind",
                "week", "weekRange",
                "semester", "semester",
                "lesson", "lessonName"
        );

        @Test
        @DisplayName("Tên tiếng Việt có dấu khớp đúng")
        void tiengViet() {
            assertThat(ColumnMatcher.matchSingle("Tuần", sampleDict)).isEqualTo("weekRange");
            assertThat(ColumnMatcher.matchSingle("TIẾT", sampleDict)).isEqualTo("periodRange");
            assertThat(ColumnMatcher.matchSingle("Học kỳ", sampleDict)).isEqualTo("semester");
            assertThat(ColumnMatcher.matchSingle("Mạch", sampleDict)).isEqualTo("strandCode");
            assertThat(ColumnMatcher.matchSingle("Bài học", sampleDict)).isEqualTo("lessonName");
            assertThat(ColumnMatcher.matchSingle("Loại", sampleDict)).isEqualTo("kind");
        }

        @Test
        @DisplayName("Tên tiếng Anh khớp đúng")
        void tiengAnh() {
            assertThat(ColumnMatcher.matchSingle("Week", sampleDict)).isEqualTo("weekRange");
            assertThat(ColumnMatcher.matchSingle("Semester", sampleDict)).isEqualTo("semester");
            assertThat(ColumnMatcher.matchSingle("Lesson", sampleDict)).isEqualTo("lessonName");
        }

        @Test
        @DisplayName("Không dấu tiếng Việt khớp đúng")
        void khongDau() {
            assertThat(ColumnMatcher.matchSingle("Tuan", sampleDict)).isEqualTo("weekRange");
            assertThat(ColumnMatcher.matchSingle("Tiet", sampleDict)).isEqualTo("periodRange");
        }

        @Test
        @DisplayName("matchHeaders gán đúng cho dòng header thực tế")
        void matchHeadersDong() {
            List<String> headers = List.of("MẠCH", "HỌC KỲ", "TIẾT", "TUẦN", "BÀI HỌC", "LOẠI");
            Map<Integer, String> result = ColumnMatcher.matchHeaders(headers, sampleDict);
            assertThat(result.get(0)).isEqualTo("strandCode");
            assertThat(result.get(1)).isEqualTo("semester");
            assertThat(result.get(2)).isEqualTo("periodRange");
            assertThat(result.get(3)).isEqualTo("weekRange");
            assertThat(result.get(4)).isEqualTo("lessonName");
            assertThat(result.get(5)).isEqualTo("kind");
        }

        @Test
        @DisplayName("Fuzzy: 'Tiet hoc' (lỗi gõ) vẫn khớp periodRange")
        void fuzzyTyoError() {
            String f = ColumnMatcher.matchSingle("Tiết học", sampleDict);
            assertThat(f).isEqualTo("periodRange");
        }
    }
}
