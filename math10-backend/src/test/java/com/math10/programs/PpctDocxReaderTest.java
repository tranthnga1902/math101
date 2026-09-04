package com.math10.programs;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Unit test cho PpctDocxReader — các hàm thuần không cần DB.
 */
@DisplayName("PpctDocxReader — bung tiết/tuần, nhận diện HK, phân loại")
class PpctDocxReaderTest {

    // ==================== Bung khoảng tiết ====================

    @Nested
    @DisplayName("bungTiet")
    class BungTiet {

        @Test
        @DisplayName("Tiết đơn '5' → [5]")
        void tietDon() {
            assertThat(PpctDocxReader.bungTiet("5")).containsExactly(5);
        }

        @Test
        @DisplayName("Khoảng gạch ngang '1-4' → [1,2,3,4]")
        void khoangGachNgang() {
            assertThat(PpctDocxReader.bungTiet("1-4")).containsExactly(1, 2, 3, 4);
        }

        @Test
        @DisplayName("Khoảng gạch dài '1–3' (en-dash) → [1,2,3]")
        void khoangGachDai() {
            assertThat(PpctDocxReader.bungTiet("1\u20133")).containsExactly(1, 2, 3);
        }

        @Test
        @DisplayName("Khoảng có khoảng trắng '2 - 5' → [2,3,4,5]")
        void khoangCoKhoangTrang() {
            assertThat(PpctDocxReader.bungTiet("2 - 5")).containsExactly(2, 3, 4, 5);
        }

        @Test
        @DisplayName("Chuỗi rỗng → []")
        void rong() {
            assertThat(PpctDocxReader.bungTiet("")).isEmpty();
        }

        @Test
        @DisplayName("Chuỗi null → []")
        void nullable() {
            assertThat(PpctDocxReader.bungTiet(null)).isEmpty();
        }

        @Test
        @DisplayName("Khoảng đảo ngược '4-1' (bất thường) → []")
        void khoangDaoNguoc() {
            assertThat(PpctDocxReader.bungTiet("4-1")).isEmpty();
        }
    }

    // ==================== Bung nhiều tuần ====================

    @Nested
    @DisplayName("bungTuan")
    class BungTuan {

        @Test
        @DisplayName("Tuần đơn '5' → [5]")
        void tuanDon() {
            assertThat(PpctDocxReader.bungTuan("5")).containsExactly(5);
        }

        @Test
        @DisplayName("Dấu cộng '2+3' → [2,3]")
        void dauCong() {
            assertThat(PpctDocxReader.bungTuan("2+3")).containsExactly(2, 3);
        }

        @Test
        @DisplayName("Dấu phẩy '2, 3' → [2,3]")
        void dauPhay() {
            assertThat(PpctDocxReader.bungTuan("2, 3")).containsExactly(2, 3);
        }

        @Test
        @DisplayName("Ba tuần '1+2+3' → [1,2,3]")
        void baTuan() {
            assertThat(PpctDocxReader.bungTuan("1+2+3")).containsExactly(1, 2, 3);
        }
    }

    // ==================== Nhận diện học kỳ ====================

    @Nested
    @DisplayName("phatHienHocKy")
    class PhatHienHocKy {

        @Test
        @DisplayName("'Học kỳ I' → 1")
        void hocKy1() {
            assertThat(PpctDocxReader.phatHienHocKy("Học kỳ I")).isEqualTo(1);
        }

        @Test
        @DisplayName("'HKI' → 1")
        void hki() {
            assertThat(PpctDocxReader.phatHienHocKy("HKI")).isEqualTo(1);
        }

        @Test
        @DisplayName("'Học kỳ II' → 2")
        void hocKy2() {
            assertThat(PpctDocxReader.phatHienHocKy("Học kỳ II")).isEqualTo(2);
        }

        @Test
        @DisplayName("'HKII' → 2")
        void hkii() {
            assertThat(PpctDocxReader.phatHienHocKy("HKII")).isEqualTo(2);
        }

        @Test
        @DisplayName("'Semester 2' → 2")
        void semester2() {
            assertThat(PpctDocxReader.phatHienHocKy("Semester 2")).isEqualTo(2);
        }

        @Test
        @DisplayName("Chuỗi rỗng → 1 (mặc định)")
        void macDinh() {
            assertThat(PpctDocxReader.phatHienHocKy("")).isEqualTo(1);
        }

        @Test
        @DisplayName("'HKII' không bị nhận nhầm là HK1 (HKI là tiền tố của HKII)")
        void hkiiKhongNhamHki() {
            // HKII phải được phát hiện là học kỳ 2, không phải 1
            assertThat(PpctDocxReader.phatHienHocKy("HKII - Toán 10")).isEqualTo(2);
        }
    }

    // ==================== Suy phân loại tiết ====================

    @Nested
    @DisplayName("suyPhanLoai")
    class SuyPhanLoai {

        @Test
        @DisplayName("'Kiểm tra giữa kỳ' → KIEM_TRA")
        void kiemTra() {
            assertThat(PpctDocxReader.suyPhanLoai("Kiểm tra giữa kỳ")).isEqualTo("KIEM_TRA");
        }

        @Test
        @DisplayName("'Ôn tập chương 1' → ON_TAP")
        void onTap() {
            assertThat(PpctDocxReader.suyPhanLoai("Ôn tập chương 1")).isEqualTo("ON_TAP");
        }

        @Test
        @DisplayName("'Bài tập cuối chương' → ON_TAP")
        void baiTapCuoiChuong() {
            assertThat(PpctDocxReader.suyPhanLoai("Bài tập cuối chương")).isEqualTo("ON_TAP");
        }

        @Test
        @DisplayName("'Luyện tập' → ON_TAP")
        void luyenTap() {
            assertThat(PpctDocxReader.suyPhanLoai("Luyện tập")).isEqualTo("ON_TAP");
        }

        @Test
        @DisplayName("'Thực hành 1' → THUC_HANH")
        void thucHanh() {
            assertThat(PpctDocxReader.suyPhanLoai("Thực hành 1")).isEqualTo("THUC_HANH");
        }

        @Test
        @DisplayName("'Bài 1: Mệnh đề toán học' → BAI_MOI")
        void baiMoi() {
            assertThat(PpctDocxReader.suyPhanLoai("Bài 1: Mệnh đề toán học")).isEqualTo("BAI_MOI");
        }

        @Test
        @DisplayName("null → BAI_MOI")
        void nullable() {
            assertThat(PpctDocxReader.suyPhanLoai(null)).isEqualTo("BAI_MOI");
        }
    }
}
