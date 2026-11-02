package com.math10.assignments;

import com.math10.assignments.domain.ChamDiemCauHoi;
import com.math10.assignments.domain.ChamDiemCauHoi.Cau;
import com.math10.common.exception.BusinessException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

/**
 * Chấm điểm là chỗ sai lặng lẽ nhất trong cả hệ: không có ngoại lệ, không có dòng log, chỉ có một
 * con số sai trong sổ điểm mà chẳng ai đối chiếu lại. Nên bốn kiểu câu được ghim ở đây bằng chính
 * những con số đề thi thật dùng.
 *
 * <p>Thuần logic, không Spring — chạy trong mili giây, nên không có cớ gì để bỏ qua.
 */
@DisplayName("Chấm điểm bốn kiểu câu")
class ChamDiemCauHoiTest {

    private static Cau cau(String kieu, String dapAn) {
        return new Cau(1L, kieu, dapAn, null, BigDecimal.ONE);
    }

    @Nested
    @DisplayName("Đúng/sai 4 ý")
    class DungSai {

        /**
         * Thang của Bộ, không tuyến tính: 0.1 / 0.25 / 0.5 / 1. Đây là <em>lý do</em> có kiểu câu
         * này thay vì bốn câu MCQ rời — đoán mò trúng một hai ý là chuyện thường, nên phần thưởng
         * dồn hết về cuối. Chấm tuyến tính (0.25/0.5/0.75/1) thì học sinh đoán bừa cả bốn ý vẫn
         * được nửa điểm, và đề đúng/sai mất hết ý nghĩa phân loại.
         */
        @ParameterizedTest(name = "đúng {1} ý → {2} điểm")
        @CsvSource({
                "SSSS, 0, 0.00",
                "DSSS, 1, 0.10",
                "DDSS, 2, 0.25",
                "DDDS, 3, 0.50",
                "DDDD, 4, 1.00"
        })
        void thangLuyTien(String baiLam, int yDung, String diem) {
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.DUNG_SAI_4Y, "DDDD"), baiLam))
                    .as("đúng %d ý", yDung)
                    .isEqualByComparingTo(diem);
        }

        @Test
        @DisplayName("Thang nhân theo điểm tối đa của câu, không cộng cứng")
        void nhanTheoDiemToiDa() {
            Cau nang = new Cau(1L, ChamDiemCauHoi.DUNG_SAI_4Y, "DDDD", null, new BigDecimal("2.00"));
            assertThat(ChamDiemCauHoi.cham(nang, "DDSS")).isEqualByComparingTo("0.50");
            assertThat(ChamDiemCauHoi.cham(nang, "DDDD")).isEqualByComparingTo("2.00");
        }

        /**
         * Trùng ý chứ không phải "chọn đúng": ý mà đáp án ghi S và học sinh cũng ghi S là một ý
         * đúng. Đếm nhầm thành "số ý học sinh ghi D mà đáp án cũng D" thì một đề toàn đáp án S sẽ
         * cho cả lớp 0 điểm dù làm đúng hết.
         */
        @Test
        @DisplayName("Ý sai mà trả lời sai vẫn là ý đúng")
        void trungYChuKhongPhaiChonDung() {
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.DUNG_SAI_4Y, "SSSS"), "SSSS"))
                    .isEqualByComparingTo("1.00");
        }

        /** Cùng một chuỗi đi qua tay người soạn đề, bộ tách tài liệu và màn làm bài của học sinh. */
        @ParameterizedTest(name = "đọc được \"{0}\"")
        @ValueSource(strings = {"DDDD", "dddd", "TTTT", "1111", "D D D D", "D,D,D,D"})
        void nhanNhieuCachViet(String baiLam) {
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.DUNG_SAI_4Y, "DDDD"), baiLam))
                    .isEqualByComparingTo("1.00");
        }

        @ParameterizedTest(name = "từ chối \"{0}\"")
        @ValueSource(strings = {"DDD", "DDDDD", "DDDX"})
        void tuChoiChuoiSaiDang(String baiLam) {
            assertThat(ChamDiemCauHoi.dungSai(baiLam)).isNull();
            assertThat(ChamDiemCauHoi.baiLamHopLe(cau(ChamDiemCauHoi.DUNG_SAI_4Y, "DDDD"), baiLam)).isFalse();
        }

        @Test
        @DisplayName("Bỏ trống tính là sai, không phải chờ chấm")
        void boTrongLaSai() {
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.DUNG_SAI_4Y, "DDDD"), null))
                    .isEqualByComparingTo("0.00");
        }
    }

    @Nested
    @DisplayName("Trả lời ngắn")
    class TraLoiNgan {

        @Test
        @DisplayName("Dung sai của đề quyết định, không phải so bằng nhau")
        void dungSaiCuaDe() {
            Cau caoSu = new Cau(1L, ChamDiemCauHoi.TRA_LOI_NGAN, "3.14", "{\"tolerance\":0.01}", BigDecimal.ONE);
            assertThat(ChamDiemCauHoi.cham(caoSu, "3.15")).isEqualByComparingTo("1.00");
            assertThat(ChamDiemCauHoi.cham(caoSu, "3.13")).isEqualByComparingTo("1.00");
            assertThat(ChamDiemCauHoi.cham(caoSu, "3.16"))
                    .as("ngoài dung sai là sai — dung sai nới rộng chứ không xoá ranh giới")
                    .isEqualByComparingTo("0.00");
        }

        /**
         * Không ghi dung sai thì mặc định rất chặt (1e-4) chứ không phải bằng tuyệt đối: học sinh
         * gõ "2.0" cho đáp án "2" vẫn phải đúng. So chuỗi ở đây là lỗi kinh điển.
         */
        @Test
        @DisplayName("Không ghi dung sai thì 2 và 2.0 vẫn là một")
        void macDinhVanSoSo() {
            Cau chat = cau(ChamDiemCauHoi.TRA_LOI_NGAN, "2");
            assertThat(ChamDiemCauHoi.cham(chat, "2.0")).isEqualByComparingTo("1.00");
            assertThat(ChamDiemCauHoi.cham(chat, "2.001")).isEqualByComparingTo("0.00");
        }

        @Test
        @DisplayName("Nhận dấu phẩy thập phân kiểu Việt")
        void dauPhayKieuViet() {
            assertThat(ChamDiemCauHoi.so("1,5")).isEqualByComparingTo("1.5");
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.TRA_LOI_NGAN, "1.5"), "1,5"))
                    .as("bàn phím tiếng Việt gõ dấu phẩy; chấm 0 vì cái dấu ấy là chấm oan")
                    .isEqualByComparingTo("1.00");
        }

        @Test
        @DisplayName("Số âm không bị nuốt mất dấu")
        void giuDauAm() {
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.TRA_LOI_NGAN, "-3"), "-3"))
                    .isEqualByComparingTo("1.00");
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.TRA_LOI_NGAN, "-3"), "3"))
                    .isEqualByComparingTo("0.00");
        }

        /**
         * "12 cm" chấm được (đọc ra 12) nhưng "khoảng mười hai" thì không — và học sinh phải biết
         * điều đó lúc nộp, không phải lúc xem điểm.
         */
        @Test
        @DisplayName("Chữ không có số bị chặn ngay lúc nộp")
        void chanChuKhongCoSo() {
            Cau c = cau(ChamDiemCauHoi.TRA_LOI_NGAN, "12");
            assertThat(ChamDiemCauHoi.baiLamHopLe(c, "khoang muoi hai")).isFalse();
            assertThat(ChamDiemCauHoi.baiLamHopLe(c, "12 cm")).isTrue();
        }

        @Test
        @DisplayName("Dung sai âm trong payload bị bỏ qua, không lật ngược phép so")
        void dungSaiAmBiBoQua() {
            Cau xau = new Cau(1L, ChamDiemCauHoi.TRA_LOI_NGAN, "5", "{\"tolerance\":-3}", BigDecimal.ONE);
            assertThat(ChamDiemCauHoi.cham(xau, "5")).isEqualByComparingTo("1.00");
            assertThat(ChamDiemCauHoi.cham(xau, "6")).isEqualByComparingTo("0.00");
        }
    }

    @Nested
    @DisplayName("Tự luận")
    class TuLuan {

        /**
         * {@code null} chứ không phải 0. Trả 0 là biến "chưa chấm" thành "chấm rồi, được 0 điểm" —
         * bài chưa ai đọc mà sổ điểm đã ghi 0, và tổng điểm của lớp trông như đã hoàn tất.
         */
        @Test
        @DisplayName("Trả null, không phải 0")
        void traNullKhongPhaiKhong() {
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.TU_LUAN, null), "Em giai nhu sau...")).isNull();
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.TU_LUAN, null), null))
                    .as("bỏ trống vẫn phải qua mắt người chấm, không tự động 0")
                    .isNull();
        }

        @Test
        @DisplayName("Không đòi đáp án, nhưng cũng không tự chấm được")
        void khongDoiDapAn() {
            Cau c = cau(ChamDiemCauHoi.TU_LUAN, null);
            assertThat(c.nguoiCham()).isTrue();
            assertThat(ChamDiemCauHoi.mayChamDuoc(c)).isFalse();
            assertThat(ChamDiemCauHoi.dapAnHopLe(c)).isTrue();
        }
    }

    @Nested
    @DisplayName("MCQ")
    class Mcq {

        @ParameterizedTest(name = "\"{0}\" là đáp án A")
        @ValueSource(strings = {"A", "a", " A "})
        void chuanHoaPhuongAn(String baiLam) {
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.MCQ, "A"), baiLam)).isEqualByComparingTo("1.00");
        }

        @Test
        @DisplayName("Chọn sai thì 0, không có điểm an ủi")
        void chonSaiThiKhong() {
            assertThat(ChamDiemCauHoi.cham(cau(ChamDiemCauHoi.MCQ, "A"), "B")).isEqualByComparingTo("0.00");
        }
    }

    @Nested
    @DisplayName("Chặn đề không chấm được")
    class DeKhongChamDuoc {

        /**
         * Đề thiếu đáp án mà vẫn phát hành được thì cả lớp mất trắng câu đó, và không một dòng log
         * nào báo. Chặn ở lúc phát hành là chỗ duy nhất còn sửa kịp.
         */
        @Test
        @DisplayName("Câu thiếu đáp án chặn cả đề")
        void thieuDapAn() {
            assertThatThrownBy(() -> ChamDiemCauHoi.requireGradable(List.of(
                    cau(ChamDiemCauHoi.MCQ, "A"), new Cau(9L, ChamDiemCauHoi.MCQ, null, null, BigDecimal.ONE))))
                    .isInstanceOf(BusinessException.class)
                    .hasMessageContaining("9");
        }

        @Test
        @DisplayName("Đáp án đúng/sai không đủ 4 ý bị chặn")
        void dapAnDungSaiSaiDang() {
            assertThatThrownBy(() -> ChamDiemCauHoi.requireGradable(
                    List.of(cau(ChamDiemCauHoi.DUNG_SAI_4Y, "DDD"))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("Đáp án trả lời ngắn không phải số bị chặn")
        void dapAnTraLoiNganSaiDang() {
            assertThatThrownBy(() -> ChamDiemCauHoi.requireGradable(
                    List.of(cau(ChamDiemCauHoi.TRA_LOI_NGAN, "ba phay bon"))))
                    .isInstanceOf(BusinessException.class);
        }

        @Test
        @DisplayName("Đề toàn tự luận vẫn hợp lệ")
        void toanTuLuanVanDuoc() {
            ChamDiemCauHoi.requireGradable(List.of(cau(ChamDiemCauHoi.TU_LUAN, null)));
        }

        @Test
        @DisplayName("Đề rỗng bị chặn")
        void deRongBiChan() {
            assertThatThrownBy(() -> ChamDiemCauHoi.requireGradable(List.of()))
                    .isInstanceOf(BusinessException.class);
        }
    }

    @Test
    @DisplayName("Điểm tối đa vô lý được kéo về 1 thay vì sinh điểm âm")
    void diemToiDaVoLy() {
        Cau am = new Cau(1L, ChamDiemCauHoi.MCQ, "A", null, new BigDecimal("-5"));
        assertThat(am.diemToiDa()).isEqualByComparingTo("1");
        assertThat(ChamDiemCauHoi.cham(am, "A").doubleValue()).isCloseTo(1.0, within(1e-9));
    }
}
