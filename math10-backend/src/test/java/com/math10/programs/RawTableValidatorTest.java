package com.math10.programs;

import com.math10.programs.RawRow.InferredBy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RawTableValidator — kiểm tra tính thích ứng và toàn vẹn của RawTable")
class RawTableValidatorTest {

    @Nested
    @DisplayName("Kiểu đánh số GLOBAL vs PER_STRAND")
    class PeriodStyles {

        @Test
        @DisplayName("GLOBAL style: Tiết tăng đơn điệu xuyên suốt (1→105) hợp lệ dù chuyển mạch")
        void globalStyleHopLe() {
            List<RawRow> rows = List.of(
                    RawRow.of(1, "MAIN", "DS", "Đại số", "1", "1-4", "1", "I", "Chương I", "Bài 1. Mệnh đề", "LESSON"),
                    RawRow.of(2, "MAIN", "HH", "Hình học", "1", "5-6", "2", "III", "Chương III", "Bài 5. Giá trị lượng giác", "LESSON"),
                    RawRow.of(3, "MAIN", "DS", "Đại số", "1", "7-10", "2+3", "I", "Chương I", "Bài 2. Tập hợp", "LESSON")
            );
            RawTable table = new RawTable(rows, RawTable.PeriodNumberingStyle.GLOBAL, "KNTT");
            var res = RawTableValidator.validate(table, null, null);
            assertThat(res.hasErrors()).isFalse();
        }

        @Test
        @DisplayName("GLOBAL style: Tiết bị giảm giữa các dòng sẽ báo lỗi")
        void globalStyleGiamTietLoi() {
            List<RawRow> rows = List.of(
                    RawRow.of(1, "MAIN", "DS", "Đại số", "1", "1-4", "1", "I", "Chương I", "Bài 1", "LESSON"),
                    RawRow.of(2, "MAIN", "HH", "Hình học", "1", "2-3", "2", "III", "Chương III", "Bài 2", "LESSON")
            );
            RawTable table = new RawTable(rows, RawTable.PeriodNumberingStyle.GLOBAL, null);
            var res = RawTableValidator.validate(table, null, null);
            assertThat(res.hasErrors()).isTrue();
            assertThat(res.errors()).anyMatch(e -> e.code().equals("PERIOD_DECREASES"));
        }

        @Test
        @DisplayName("PER_STRAND style: Mỗi mạch đánh lại từ 1 là hợp lệ")
        void perStrandStyleHopLe() {
            List<RawRow> rows = List.of(
                    RawRow.of(1, "MAIN", "DS", "Đại số", "1", "1", "1", "I", "Chương I", "Bài 1", "LESSON"),
                    RawRow.of(2, "MAIN", "DS", "Đại số", "1", "2", "1", "I", "Chương I", "Bài 2", "LESSON"),
                    RawRow.of(3, "MAIN", "HH", "Hình học", "1", "1", "1", "IV", "Chương IV", "Bài 3", "LESSON")
            );
            RawTable table = new RawTable(rows, RawTable.PeriodNumberingStyle.PER_STRAND, null);
            var res = RawTableValidator.validate(table, null, null);
            assertThat(res.hasErrors()).isFalse();
        }
    }

    @Nested
    @DisplayName("Chuẩn hóa tên bài và kiểm tra quan hệ chương-mạch")
    class NormalizationAndHierarchy {

        @Test
        @DisplayName("Chuẩn hóa tên bài: 'Bài 2. Tập hợp' khớp 'Bài 2.Tập hợp'")
        void chuanHoaTenBaiDauCham() {
            RawRow r1 = RawRow.of(1, "MAIN", "DS", "Đại số", "1", "1", "1", "I", "Chương I", "Bài 2. Tập hợp", "LESSON");
            RawRow r2 = RawRow.of(2, "MAIN", "DS", "Đại số", "1", "2", "1", "I", "Chương I", "Bài 2.Tập hợp", "LESSON");
            assertThat(r1.normalizedLessonName()).isEqualTo(r2.normalizedLessonName());
        }

        @Test
        @DisplayName("Một bài xuất hiện ở 2 chương khác nhau sẽ bị báo lỗi")
        void baiThuocHaiChuong() {
            List<RawRow> rows = List.of(
                    RawRow.of(1, "MAIN", "DS", "Đại số", "1", "1", "1", "I", "Chương I", "Bài 1. Mệnh đề", "LESSON"),
                    RawRow.of(2, "MAIN", "DS", "Đại số", "1", "2", "1", "II", "Chương II", "Bài 1. Mệnh đề", "LESSON")
            );
            RawTable table = new RawTable(rows, RawTable.PeriodNumberingStyle.GLOBAL, null);
            var res = RawTableValidator.validate(table, null, null);
            assertThat(res.hasErrors()).isTrue();
            assertThat(res.errors()).anyMatch(e -> e.code().equals("LESSON_IN_MULTIPLE_CHAPTERS"));
        }

        @Test
        @DisplayName("Một chương xuất hiện ở 2 mạch khác nhau sẽ bị báo lỗi")
        void chuongThuocHaiMach() {
            List<RawRow> rows = List.of(
                    RawRow.of(1, "MAIN", "DS", "Đại số", "1", "1", "1", "I", "Mệnh đề", "Bài 1", "LESSON"),
                    RawRow.of(2, "MAIN", "HH", "Hình học", "1", "2", "1", "I", "Mệnh đề", "Bài 2", "LESSON")
            );
            RawTable table = new RawTable(rows, RawTable.PeriodNumberingStyle.GLOBAL, null);
            var res = RawTableValidator.validate(table, null, null);
            assertThat(res.hasErrors()).isTrue();
            assertThat(res.errors()).anyMatch(e -> e.code().equals("CHAPTER_IN_MULTIPLE_STRANDS"));
        }
    }

    @Nested
    @DisplayName("Cảnh báo thông minh theo nhịp sư phạm")
    class PedagogicalWarnings {

        @Test
        @DisplayName("Chương kế thừa (INHERITED) sinh cảnh báo, không chặn")
        void chuongKeThuaCanhBao() {
            List<RawRow> rows = List.of(
                    new RawRow(28, "MAIN", "TK", "Thống kê", "1", "55-57", "18", "V", "Chương V", "Hàm số", "LESSON", InferredBy.INHERITED)
            );
            RawTable table = new RawTable(rows, RawTable.PeriodNumberingStyle.GLOBAL, null);
            var res = RawTableValidator.validate(table, null, null);
            assertThat(res.hasErrors()).isFalse();
            assertThat(res.warnings()).anyMatch(w -> w.code().contains("CHAPTER_INFERRED"));
            assertThat(res.warnings()).anyMatch(w -> w.code().contains("LESSON_NUMBER_MISSING"));
        }

        @Test
        @DisplayName("Bài tập cuối chương > 1 tiết cảnh báo")
        void baiTapCuoiChuongNhieuTiet() {
            List<RawRow> rows = List.of(
                    RawRow.of(1, "MAIN", "DS", "Đại số", "1", "1-2", "1", "I", "Chương I", "Bài tập cuối chương I", "REVIEW")
            );
            RawTable table = new RawTable(rows, RawTable.PeriodNumberingStyle.GLOBAL, null);
            var res = RawTableValidator.validate(table, null, null);
            assertThat(res.warnings()).anyMatch(w -> w.code().contains("REVIEW_PERIOD_COUNT"));
        }

        @Test
        @DisplayName("Bài kiểm tra khác 2 tiết cảnh báo")
        void baiKiemTraKhacHaiTiet() {
            List<RawRow> rows = List.of(
                    RawRow.of(1, "MAIN", "DS", "Đại số", "1", "1", "1", "", "", "Kiểm tra giữa kỳ", "EXAM")
            );
            RawTable table = new RawTable(rows, RawTable.PeriodNumberingStyle.GLOBAL, null);
            var res = RawTableValidator.validate(table, null, null);
            assertThat(res.warnings()).anyMatch(w -> w.code().contains("EXAM_PERIOD_COUNT"));
        }
    }
}
