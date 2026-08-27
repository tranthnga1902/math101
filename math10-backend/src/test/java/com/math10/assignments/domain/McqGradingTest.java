package com.math10.assignments.domain;

import com.math10.common.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Chấm trắc nghiệm. Ba chỗ trong hệ thống từng tự chấm theo ba luật hơi khác nhau; test ở đây
 * khoá lại đúng một luật để cả ba dùng chung.
 */
class McqGradingTest {

    private static List<McqGrading.Key> de(String... dapAn) {
        List<McqGrading.Key> keys = new java.util.ArrayList<>();
        for (int i = 0; i < dapAn.length; i++) keys.add(new McqGrading.Key((long) (i + 1), dapAn[i]));
        return keys;
    }

    private static Map<Long, String> baiLam(String... traLoi) {
        Map<Long, String> answers = new LinkedHashMap<>();
        for (int i = 0; i < traLoi.length; i++) if (traLoi[i] != null) answers.put((long) (i + 1), traLoi[i]);
        return answers;
    }

    private static BigDecimal diem(String value) {
        return new BigDecimal(value);
    }

    @Nested
    @DisplayName("Đếm câu đúng")
    class DemCauDung {

        @Test
        void dungHetThiDuocDiemToiDa() {
            McqGrading.Result result = McqGrading.grade(de("A", "B", "C", "D"), baiLam("A", "B", "C", "D"));

            assertThat(result.correct()).isEqualTo(4);
            assertThat(result.total()).isEqualTo(4);
            assertThat(result.rawScore()).isEqualByComparingTo(diem("10.00"));
        }

        @Test
        void saiHetThiKhongDiem() {
            McqGrading.Result result = McqGrading.grade(de("A", "B", "C", "D"), baiLam("B", "C", "D", "A"));

            assertThat(result.correct()).isZero();
            assertThat(result.rawScore()).isEqualByComparingTo(diem("0.00"));
        }

        @Test
        void dungMotNuaThiDuocNuaDiem() {
            McqGrading.Result result = McqGrading.grade(de("A", "B", "C", "D"), baiLam("A", "B", "A", "A"));

            assertThat(result.correct()).isEqualTo(2);
            assertThat(result.rawScore()).isEqualByComparingTo(diem("5.00"));
        }

        @Test
        @DisplayName("Câu bỏ trống tính là sai, không phải bỏ ra khỏi mẫu số")
        void boTrongTinhLaSai() {
            McqGrading.Result result = McqGrading.grade(de("A", "B", "C", "D"), baiLam("A", null, null, null));

            assertThat(result.correct()).isEqualTo(1);
            assertThat(result.total()).isEqualTo(4);
            assertThat(result.rawScore()).isEqualByComparingTo(diem("2.50"));
        }

        @Test
        @DisplayName("Học sinh gõ thường, đề ghi hoa — vẫn phải tính là đúng")
        void khongPhanBietHoaThuong() {
            McqGrading.Result result = McqGrading.grade(de("A", "B"), baiLam("a", " b "));

            assertThat(result.correct()).isEqualTo(2);
        }

        @Test
        @DisplayName("Trả lời id của câu không có trong đề thì không được cộng điểm")
        void traLoiCauLaKhongTinh() {
            Map<Long, String> answers = new LinkedHashMap<>();
            answers.put(99L, "A");

            McqGrading.Result result = McqGrading.grade(de("A", "B"), answers);

            assertThat(result.correct()).isZero();
        }
    }

    @Nested
    @DisplayName("Làm tròn điểm")
    class LamTron {

        @Test
        @DisplayName("1/3 câu đúng ra 3.33, không phải 3.3 hay 3")
        void chiaKhongHetThiLamTronHaiChuSo() {
            assertThat(McqGrading.grade(de("A", "A", "A"), baiLam("A", "B", "B")).rawScore())
                    .isEqualByComparingTo(diem("3.33"));
        }

        @Test
        @DisplayName("2/3 câu đúng làm tròn lên 6.67")
        void lamTronLen() {
            assertThat(McqGrading.grade(de("A", "A", "A"), baiLam("A", "A", "B")).rawScore())
                    .isEqualByComparingTo(diem("6.67"));
        }

        @Test
        void deBayCauVanChiaDuoc() {
            assertThat(McqGrading.grade(de("A", "A", "A", "A", "A", "A", "A"), baiLam("A", "A", "B", "B", "B", "B", "B")).rawScore())
                    .isEqualByComparingTo(diem("2.86"));
        }
    }

    @Nested
    @DisplayName("Đề không chấm được")
    class DeKhongChamDuoc {

        @Test
        @DisplayName("Đề rỗng thì báo lỗi chứ không chia cho 0")
        void deRongThiBaoLoi() {
            assertThatThrownBy(() -> McqGrading.grade(List.of(), Map.of()))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("chưa có câu hỏi");
        }

        @Test
        @DisplayName("Câu thiếu đáp án thì dừng lại, không được lặng lẽ tính cả lớp là sai")
        void thieuDapAnThiBaoLoi() {
            assertThatThrownBy(() -> McqGrading.grade(de("A", null, "C"), baiLam("A", "B", "C")))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("chưa được cấu hình đáp án");
        }

        @Test
        @DisplayName("Lỗi phải chỉ ra câu nào thiếu, để giáo viên còn biết đường sửa")
        void loiChiRaCauThieu() {
            assertThatThrownBy(() -> McqGrading.grade(de("A", null, null), baiLam("A", "B", "C")))
                    .hasMessageContaining("2")
                    .hasMessageContaining("3");
        }

        @Test
        @DisplayName("Đáp án đúng ghi là E thì cũng là đề hỏng")
        void dapAnNgoaiBonPhuongAnLaDeHong() {
            assertThatThrownBy(() -> McqGrading.grade(de("A", "E"), baiLam("A", "E")))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("chưa được cấu hình đáp án");
        }
    }

    @Nested
    @DisplayName("Soát bài nộp")
    class SoatBaiNop {

        @Test
        void traLoiDuVaHopLeThiQua() {
            assertThatCode(() -> McqGrading.requireCompleteAnswers(de("A", "B"), baiLam("A", "B")))
                    .doesNotThrowAnyException();
        }

        @Test
        void thieuCauThiKhongChoNop() {
            assertThatThrownBy(() -> McqGrading.requireCompleteAnswers(de("A", "B"), baiLam("A")))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("đầy đủ");
        }

        @Test
        @DisplayName("Đủ số lượng nhưng sai id câu hỏi thì vẫn là thiếu bài")
        void duSoLuongNhungSaiIdVanLaThieu() {
            Map<Long, String> answers = new LinkedHashMap<>();
            answers.put(1L, "A");
            answers.put(99L, "B");

            assertThatThrownBy(() -> McqGrading.requireCompleteAnswers(de("A", "B"), answers))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("đầy đủ");
        }

        @Test
        void traLoiNgoaiBonPhuongAnThiKhongHopLe() {
            assertThatThrownBy(() -> McqGrading.requireCompleteAnswers(de("A", "B"), baiLam("A", "Z")))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("không hợp lệ");
        }
    }

    @Nested
    @DisplayName("So sánh từng câu — dùng cho bảng thống kê")
    class SoSanhTungCau {

        @Test
        void dungThiTra() {
            assertThat(McqGrading.isCorrect(new McqGrading.Key(1L, "A"), "a")).isTrue();
        }

        @Test
        void saiThiKhongTra() {
            assertThat(McqGrading.isCorrect(new McqGrading.Key(1L, "A"), "B")).isFalse();
        }

        @Test
        @DisplayName("Câu chưa có đáp án thì không ai đúng — kể cả người bỏ trống")
        void chuaCoDapAnThiKhongAiDung() {
            assertThat(McqGrading.isCorrect(new McqGrading.Key(1L, null), null)).isFalse();
            assertThat(McqGrading.isCorrect(new McqGrading.Key(1L, null), "A")).isFalse();
        }

        @Test
        void boTrongThiKhongDung() {
            assertThat(McqGrading.isCorrect(new McqGrading.Key(1L, "A"), null)).isFalse();
            assertThat(McqGrading.isCorrect(new McqGrading.Key(1L, "A"), "  ")).isFalse();
        }
    }
}
