package com.math10.assignments.domain;

import com.math10.common.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Chia điểm cho phiếu trộn trắc nghiệm với tự luận.
 *
 * <p>Ba đường phải cùng ra một con số: học sinh nộp bài, giáo viên chấm từng câu, giáo viên chấm
 * lại cả lớp. Luật gom về {@link WorksheetScoring}, và test ở đây khoá lại ba điều dễ làm sai mà
 * sai thì im lặng:
 *
 * <ol>
 *   <li><b>Tổng là tỉ lệ, không phải phép cộng thẳng.</b> Cộng thẳng thì đề 3 câu có điểm tối đa
 *       9.99 — một con số không ai đạt tới được.</li>
 *   <li><b>Chưa chấm khác 0 điểm.</b> Trả 0 cho câu chưa ai đọc là chốt cho học sinh một con số
 *       thấp hơn thật, và đó là con số họ đi khiếu nại.</li>
 *   <li><b>Đề toàn trắc nghiệm phải ra đúng điểm cũ.</b> Công thức mới rút gọn về đúng
 *       {@code soCauDung / soCau × 10}, nếu không thì điểm của mọi bài đã chấm trước đây đổi hết.</li>
 * </ol>
 */
class WorksheetScoringTest {

    /** Đề trắc nghiệm: mỗi tham số là đáp án đúng của một câu. */
    private static List<McqGrading.Key> deTracNghiem(String... dapAn) {
        List<McqGrading.Key> keys = new ArrayList<>();
        for (int i = 0; i < dapAn.length; i++) keys.add(new McqGrading.Key((long) (i + 1), dapAn[i]));
        return keys;
    }

    /** Đề trộn: {@code null} ở vị trí nào thì câu đó là tự luận. */
    private static List<McqGrading.Key> deTron(String... dapAn) {
        List<McqGrading.Key> keys = new ArrayList<>();
        for (int i = 0; i < dapAn.length; i++) {
            keys.add(new McqGrading.Key((long) (i + 1), dapAn[i], dapAn[i] != null));
        }
        return keys;
    }

    private static Map<Long, String> baiLam(String... traLoi) {
        Map<Long, String> answers = new LinkedHashMap<>();
        for (int i = 0; i < traLoi.length; i++) if (traLoi[i] != null) answers.put((long) (i + 1), traLoi[i]);
        return answers;
    }

    private static Map<Long, BigDecimal> diemTay(Object... capSoCauVaDiem) {
        Map<Long, BigDecimal> ket = new LinkedHashMap<>();
        for (int i = 0; i < capSoCauVaDiem.length; i += 2) {
            ket.put(((Number) capSoCauVaDiem[i]).longValue(), new BigDecimal((String) capSoCauVaDiem[i + 1]));
        }
        return ket;
    }

    @Nested
    @DisplayName("Điểm tối đa mỗi câu")
    class DiemMoiCau {

        @Test
        @DisplayName("Chia đều thang 10, làm tròn hai chữ số")
        void chiaDeu() {
            assertThat(WorksheetScoring.diemToiDaMoiCau(4)).isEqualByComparingTo(new BigDecimal("2.50"));
            assertThat(WorksheetScoring.diemToiDaMoiCau(3)).isEqualByComparingTo(new BigDecimal("3.33"));
            assertThat(WorksheetScoring.diemToiDaMoiCau(7)).isEqualByComparingTo(new BigDecimal("1.43"));
        }

        @Test
        @DisplayName("Đề rỗng thì báo lỗi chứ không chia cho 0")
        void deRong() {
            assertThatThrownBy(() -> WorksheetScoring.diemToiDaMoiCau(0))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("chưa có câu hỏi");
        }
    }

    @Nested
    @DisplayName("Đề chấm được")
    class DeChamDuoc {

        @Test
        @DisplayName("Câu tự luận không có đáp án là bình thường, không phải đề hỏng")
        void tuLuanKhongCanDapAn() {
            assertThatCode(() -> WorksheetScoring.requireGradable(deTron("A", null, "C")))
                    .doesNotThrowAnyException();
        }

        /**
         * Lưới quan trọng nhất của lớp này. Bỏ nó đi thì một câu trắc nghiệm quên đáp án sẽ âm
         * thầm chuyển thành câu chờ chấm tay: bài không tự lên điểm, giáo viên không hiểu vì sao,
         * và cái sai nằm ở đề chứ không ở bài nộp.
         */
        @Test
        @DisplayName("Câu trắc nghiệm quên đáp án thì vẫn là đề hỏng, và lỗi chỉ đúng câu nào")
        void tracNghiemQuenDapAnVanLaDeHong() {
            List<McqGrading.Key> keys = List.of(
                    new McqGrading.Key(1L, "A", true),
                    new McqGrading.Key(2L, null, true),
                    new McqGrading.Key(3L, null, false));

            assertThatThrownBy(() -> WorksheetScoring.requireGradable(keys))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("chưa được cấu hình đáp án")
                    .hasMessageContaining("2");
            assertThat(WorksheetScoring.coCauTuLuan(keys)).isTrue();
        }

        @Test
        @DisplayName("Đề rỗng không chấm được")
        void deRong() {
            assertThatThrownBy(() -> WorksheetScoring.requireGradable(List.of()))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("chưa có câu hỏi");
        }
    }

    @Nested
    @DisplayName("Máy chấm phần trắc nghiệm")
    class MayCham {

        @Test
        @DisplayName("Câu tự luận không có mặt trong kết quả — chờ người chấm, không phải 0 điểm")
        void tuLuanKhongCoMat() {
            Map<Long, BigDecimal> tuDong = WorksheetScoring.diemTuDong(deTron("A", null, "C"), baiLam("A", "gì đó", "C"));

            assertThat(tuDong).containsOnlyKeys(1L, 3L);
            assertThat(tuDong.get(1L)).isEqualByComparingTo(new BigDecimal("3.33"));
        }

        @Test
        @DisplayName("Trắc nghiệm sai hoặc bỏ trống thì 0, đúng thì trọn điểm câu")
        void dungSaiVaBoTrong() {
            Map<Long, BigDecimal> tuDong = WorksheetScoring.diemTuDong(deTracNghiem("A", "B", "C", "D"),
                    baiLam("A", "C", null, "D"));

            assertThat(tuDong.get(1L)).isEqualByComparingTo(new BigDecimal("2.50"));
            assertThat(tuDong.get(2L)).isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(tuDong.get(3L)).as("bỏ trống là 0, không phải chưa chấm").isEqualByComparingTo(BigDecimal.ZERO);
            assertThat(tuDong.get(4L)).isEqualByComparingTo(new BigDecimal("2.50"));
        }

        /**
         * Hai cột {@code correct_count} / {@code total_questions} hiện lên màn hình là "3/5 câu
         * đúng". Đếm cả câu tự luận vào đó là câu chữ vô nghĩa: câu tự luận không có đúng hay sai,
         * chỉ có được bao nhiêu điểm.
         */
        @Test
        @DisplayName("Thống kê chỉ đếm phần trắc nghiệm, không đếm cả phiếu")
        void thongKeChiDemTracNghiem() {
            var thongKe = WorksheetScoring.thongKeTracNghiem(deTron("A", null, "C", null, "D"),
                    baiLam("A", "bài giải", "B", "bài giải", "D"));

            assertThat(thongKe.tong()).as("chỉ 3 câu trắc nghiệm").isEqualTo(3);
            assertThat(thongKe.dung()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("Gộp điểm về thang 10")
    class GopDiem {

        /**
         * Lý do phải quy về tỉ lệ. Cộng thẳng điểm từng câu thì đề 3 câu có điểm tối đa 9.99, và
         * học sinh làm đúng cả bài vẫn không được 10 — sai lệch nhỏ nhưng nhìn thấy trên học bạ.
         */
        @Test
        @DisplayName("Đề 3 câu đúng hết được đúng 10.00, không phải 9.99")
        void baCauDungHetVanLaMuoi() {
            var ketQua = WorksheetScoring.tongHop(deTron("A", "B", null), baiLam("A", "B", "bài giải"),
                    diemTay(3, "3.33"));

            assertThat(ketQua.rawScore()).isEqualByComparingTo(new BigDecimal("10.00"));
            assertThat(ketQua.chamXong()).isTrue();
        }

        /**
         * Cách chữa "cộng thẳng" bằng rải phần dư (3.34 / 3.33 / 3.33) còn hỏng nặng hơn: hai em
         * cùng đúng 2 trên 3 câu lại nhận điểm khác nhau tuỳ đúng câu nào. Quy về tỉ lệ thì chỗ
         * bất công đó biến mất — và phép thử này chính là chỗ nó sẽ lộ ra nếu ai đó đổi lại.
         */
        @Test
        @DisplayName("Cùng đúng 2 trên 3 câu thì cùng điểm, bất kể đúng câu nào")
        void dungBaoNhieuCauMoiLaQuanTrong() {
            BigDecimal bo12 = WorksheetScoring.tongHop(deTracNghiem("A", "A", "A"), baiLam("A", "A", "B"), Map.of()).rawScore();
            BigDecimal bo23 = WorksheetScoring.tongHop(deTracNghiem("A", "A", "A"), baiLam("B", "A", "A"), Map.of()).rawScore();
            BigDecimal bo13 = WorksheetScoring.tongHop(deTracNghiem("A", "A", "A"), baiLam("A", "B", "A"), Map.of()).rawScore();

            assertThat(bo12).isEqualByComparingTo(bo23).isEqualByComparingTo(bo13);
            assertThat(bo12).isEqualByComparingTo(new BigDecimal("6.67"));
        }

        /**
         * Phép thử giữ điểm cũ. Trước lát này mọi bài đều chấm bằng {@link McqGrading#grade}; công
         * thức mới phải rút gọn về đúng nó cho đề toàn trắc nghiệm, nếu không thì điểm của mọi bài
         * đã lưu trong sổ đều đổi mà không ai chủ ý.
         */
        @Test
        @DisplayName("Đề toàn trắc nghiệm ra đúng con số của cách chấm cũ, với mọi số câu từ 1 đến 12")
        void detoanTracNghiemGiuNguyenDiemCu() {
            for (int soCau = 1; soCau <= 12; soCau++) {
                for (int soDung = 0; soDung <= soCau; soDung++) {
                    String[] dapAn = new String[soCau];
                    String[] traLoi = new String[soCau];
                    for (int i = 0; i < soCau; i++) {
                        dapAn[i] = "A";
                        traLoi[i] = i < soDung ? "A" : "B";
                    }
                    BigDecimal cu = McqGrading.grade(deTracNghiem(dapAn), baiLam(traLoi)).rawScore();
                    BigDecimal moi = WorksheetScoring.tongHop(deTracNghiem(dapAn), baiLam(traLoi), Map.of()).rawScore();

                    assertThat(moi).as("đề %d câu, đúng %d câu", soCau, soDung).isEqualByComparingTo(cu);
                }
            }
        }

        @Test
        @DisplayName("Còn câu tự luận chưa chấm thì chưa chốt tổng — null, không phải 0")
        void chuaChamXongThiChuaCoTong() {
            var ketQua = WorksheetScoring.tongHop(deTron("A", null, null), baiLam("A", "bài giải", "bài giải"),
                    diemTay(2, "3.33"));

            assertThat(ketQua.rawScore()).as("chưa chốt được tổng").isNull();
            assertThat(ketQua.conThieu()).isEqualTo(1);
            assertThat(ketQua.daCham()).isEqualTo(2);
            assertThat(ketQua.tongSoCau()).isEqualTo(3);
            assertThat(ketQua.chamXong()).isFalse();
        }

        /**
         * Ranh giới đắt nhất của cả module: "chưa ai chấm" và "chấm rồi, được 0" phải là hai
         * trạng thái khác nhau. Gộp chúng lại thì bài nào giáo viên chưa mở ra cũng tự chốt điểm.
         */
        @Test
        @DisplayName("Cho 0 điểm là đã chấm, khác hẳn với chưa chấm")
        void choKhongDiemKhacVoiChuaCham() {
            var chamKhong = WorksheetScoring.tongHop(deTron("A", null), baiLam("A", "bài giải"), diemTay(2, "0"));
            var chuaCham = WorksheetScoring.tongHop(deTron("A", null), baiLam("A", "bài giải"), Map.of());

            assertThat(chamKhong.chamXong()).isTrue();
            assertThat(chamKhong.rawScore()).isEqualByComparingTo(new BigDecimal("5.00"));
            assertThat(chuaCham.chamXong()).isFalse();
            assertThat(chuaCham.rawScore()).isNull();
        }

        @Test
        @DisplayName("Điểm tự luận lẻ vẫn quy đúng về thang 10")
        void diemTuLuanLe() {
            // Đề 4 câu, trần mỗi câu 2.50. Trắc nghiệm đúng 1 (2.50), tự luận được 1.25 + 2.50 + 0.
            var ketQua = WorksheetScoring.tongHop(deTron("A", null, null, null),
                    baiLam("A", "bài giải", "bài giải", "bài giải"),
                    diemTay(2, "1.25", 3, "2.50", 4, "0"));

            assertThat(ketQua.rawScore()).isEqualByComparingTo(new BigDecimal("6.25"));
        }

        @Test
        @DisplayName("Đề toàn tự luận chưa chấm câu nào thì tổng vẫn để trống")
        void toanTuLuanChuaCham() {
            var ketQua = WorksheetScoring.tongHop(deTron(null, null), baiLam("bài giải", "bài giải"), Map.of());

            assertThat(ketQua.rawScore()).isNull();
            assertThat(ketQua.conThieu()).isEqualTo(2);
        }

        /**
         * Điểm người chấm chỉ được dùng cho câu tự luận. Nếu tổng hợp lấy điểm tay đè lên câu trắc
         * nghiệm thì đáp án của đề không còn là chỗ duy nhất quyết định điểm câu đó nữa.
         */
        @Test
        @DisplayName("Điểm nhập tay cho câu trắc nghiệm bị bỏ qua, máy chấm vẫn thắng")
        void diemTayKhongDeDuocLenTracNghiem() {
            var ketQua = WorksheetScoring.tongHop(deTron("A", null), baiLam("B", "bài giải"),
                    diemTay(1, "5.00", 2, "5.00"));

            assertThat(ketQua.rawScore()).as("câu 1 sai vẫn là 0").isEqualByComparingTo(new BigDecimal("5.00"));
        }
    }

    @Nested
    @DisplayName("Câu trả lời tự luận")
    class TraLoiTuLuan {

        @Test
        @DisplayName("Cắt khoảng trắng thừa hai đầu")
        void catKhoangTrang() {
            assertThat(WorksheetScoring.chuanHoaTuLuan("  x = 2  ")).isEqualTo("x = 2");
        }

        @Test
        @DisplayName("Gõ vài dấu cách rồi nộp là bỏ trống, không phải đã trả lời")
        void toanKhoangTrangLaBoTrong() {
            assertThat(WorksheetScoring.chuanHoaTuLuan("   ")).isNull();
            assertThat(WorksheetScoring.chuanHoaTuLuan("\n\t ")).isNull();
            assertThat(WorksheetScoring.chuanHoaTuLuan(null)).isNull();
        }

        @Test
        @DisplayName("Đúng bằng trần độ dài thì vẫn nhận")
        void dungBangTranThiNhan() {
            String vuaDu = "x".repeat(WorksheetScoring.MAX_DO_DAI_TU_LUAN);

            assertThat(WorksheetScoring.chuanHoaTuLuan(vuaDu)).hasSize(WorksheetScoring.MAX_DO_DAI_TU_LUAN);
        }

        /**
         * {@code answer_json} là cột text không giới hạn, mà sổ điểm và hàng chờ chấm đọc cả cột
         * đó cho từng bài — một em dán vào vài megabyte là cả bảng điểm của lớp nặng theo.
         */
        @Test
        @DisplayName("Quá trần một ký tự là chặn")
        void quaTranThiChan() {
            String quaDai = "x".repeat(WorksheetScoring.MAX_DO_DAI_TU_LUAN + 1);

            assertThatThrownBy(() -> WorksheetScoring.chuanHoaTuLuan(quaDai))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("không được dài quá");
        }

        @Test
        @DisplayName("Đo độ dài sau khi cắt: khoảng trắng thừa không làm bài bị từ chối")
        void doDoDaiSauKhiCat() {
            String vuaDu = "  " + "x".repeat(WorksheetScoring.MAX_DO_DAI_TU_LUAN) + "  ";

            assertThatCode(() -> WorksheetScoring.chuanHoaTuLuan(vuaDu)).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("Soát bài nộp của phiếu trộn")
    class SoatBaiNop {

        @Test
        @DisplayName("Tự luận nhận văn bản tự do, trắc nghiệm chỉ nhận A/B/C/D")
        void moiLoaiMotLuat() {
            assertThatCode(() -> WorksheetScoring.requireCompleteAnswers(deTron("A", null),
                    baiLam("A", "Ta có delta = 4 nên phương trình có hai nghiệm."))).doesNotThrowAnyException();
        }

        /**
         * Chỗ hỏng sẽ xảy ra nếu màn hình học sinh tự đoán loại câu sai: em gõ lời giải vào một câu
         * mà máy chủ coi là trắc nghiệm.
         */
        @Test
        @DisplayName("Gõ lời giải vào câu trắc nghiệm thì báo đáp án không hợp lệ")
        void goLoiGiaiVaoCauTracNghiem() {
            assertThatThrownBy(() -> WorksheetScoring.requireCompleteAnswers(deTron("A", null),
                    baiLam("Ta có delta = 4", "bài giải")))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("không hợp lệ");
        }

        @Test
        @DisplayName("Bỏ trống câu tự luận là nộp thiếu")
        void boTrongTuLuanLaThieu() {
            assertThatThrownBy(() -> WorksheetScoring.requireCompleteAnswers(deTron("A", null), baiLam("A", null)))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("đầy đủ");
        }

        @Test
        @DisplayName("Gõ mỗi khoảng trắng vào câu tự luận cũng là nộp thiếu")
        void khoangTrangCungLaThieu() {
            assertThatThrownBy(() -> WorksheetScoring.requireCompleteAnswers(deTron("A", null), baiLam("A", "   ")))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("đầy đủ");
        }

        @Test
        @DisplayName("Câu tự luận dài quá trần thì chặn ngay lúc nộp")
        void tuLuanQuaDaiThiChanLucNop() {
            assertThatThrownBy(() -> WorksheetScoring.requireCompleteAnswers(deTron("A", null),
                    baiLam("A", "x".repeat(WorksheetScoring.MAX_DO_DAI_TU_LUAN + 1))))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("không được dài quá");
        }

        @Test
        @DisplayName("Đủ số lượng nhưng sai id câu hỏi thì vẫn là thiếu bài")
        void saiIdVanLaThieu() {
            Map<Long, String> answers = new LinkedHashMap<>();
            answers.put(1L, "A");
            answers.put(99L, "bài giải");

            assertThatThrownBy(() -> WorksheetScoring.requireCompleteAnswers(deTron("A", null), answers))
                    .isInstanceOf(BusinessException.class).hasMessageContaining("đầy đủ");
        }
    }
}
