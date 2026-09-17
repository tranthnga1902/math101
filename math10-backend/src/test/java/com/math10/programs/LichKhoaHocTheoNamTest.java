package com.math10.programs;

import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Một mẫu chương trình phải mở được nhiều năm học, mỗi năm giữ buổi học riêng.
 *
 * <p>Đây là lý do cả ba tầng tồn tại: {@code courses} là chương trình, {@code program_templates} là
 * mẫu tái dùng, {@code course_instances} là lần triển khai theo năm. Buổi học của khóa
 * ({@code course_delivery_sessions}) không mang ngày — nhưng vẫn phải tách riêng theo từng
 * course_instance, vì hai năm học cùng một mẫu sẽ có hai lớp khác nhau dùng buổi khác nhau.
 * Tách ba tầng mà năm thứ hai đè lên buổi của năm thứ nhất thì việc tách ra không mang lại gì.
 *
 * <p>Phép thử canh đúng một khẳng định, và nó chỉ hỏng vào năm học thứ hai — tức là sau khi hệ
 * thống đã chạy êm một năm, lúc dữ liệu đã nhiều và chỗ sửa đã đắt. Chạy thử bằng tay trong năm
 * đầu không bao giờ thấy.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Buổi học của khóa theo từng năm")
class LichKhoaHocTheoNamTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long chuongTrinh;
    private long mau;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, description, status, created_at, updated_at)
                values ('TOAN10-KNTT', 'Toán 10 Kết nối tri thức', null, 'PUBLISHED', now(), now())
                returning id""", Long.class);

        mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Toán 10 - KNTT - Chuẩn', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);

        long mach = jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, 'DAI_SO', 'Đại số', 1, now(), now())
                returning id""", Long.class, chuongTrinh);

        jdbc.update("""
                insert into program_periods (strand_id, period_no, week_no, term, title, period_kind, created_at, updated_at)
                values (?, 1, 1, 1, 'Mệnh đề', 'BAI_MOI', now(), now())""", mach);
        jdbc.update("""
                insert into program_periods (strand_id, period_no, week_no, term, title, period_kind, created_at, updated_at)
                values (?, 2, 1, 1, 'Tập hợp', 'BAI_MOI', now(), now())""", mach);
    }

    @Test
    @DisplayName("Cùng một mẫu mở được hai năm học, mỗi năm giữ buổi học riêng")
    void haiNamHocCungMotMau() throws Exception {
        long namDau = moKhoaHoc("Toán 10 - 2026/2027", "2026-2027", "2026-09-05", "2027-05-25");
        long namSau = moKhoaHoc("Toán 10 - 2027/2028", "2027-2028", "2027-09-04", "2028-05-23");

        sinhBuoiHoc(namDau);

        // Sinh buổi cho năm sau không được đụng vào buổi đã sinh của năm trước.
        assertThat(soBuoi(namDau)).as("buổi của năm 2026/2027 trước khi sinh năm 2027/2028").isEqualTo(2);

        sinhBuoiHoc(namSau);

        assertThat(soBuoi(namDau)).as("buổi của năm 2026/2027 sau khi sinh buổi năm 2027/2028").isEqualTo(2);
        assertThat(soBuoi(namSau)).as("buổi của năm 2027/2028").isEqualTo(2);

        // Buổi của năm này không được lẫn sang năm kia.
        Integer lan=jdbc.queryForObject("""
                select count(*) from course_delivery_sessions
                where course_instance_id = ? and deleted_at is null""", Integer.class, namDau);
        Integer lan2=jdbc.queryForObject("""
                select count(*) from course_delivery_sessions
                where course_instance_id = ? and deleted_at is null""", Integer.class, namSau);
        assertThat(lan).isEqualTo(2);
        assertThat(lan2).isEqualTo(2);
    }

    @Test
    @DisplayName("Cập nhật thông tin khóa học qua PUT /api/admin/course-instances/{id}")
    void capNhatKhoaHoc() throws Exception {
        long khoa = moKhoaHoc("Toán 10 - Gốc", "2028-2029", "2028-09-01", "2029-05-30");
        String thanSua = """
                {"templateId":%d,"name":"Toán 10 - Đã sửa","schoolYear":"2028-2029","startsOn":"2028-09-10","endsOn":"2029-06-05","status":"ACTIVE"}
                """.formatted(mau);
        goi(HttpMethod.PUT, "/api/admin/course-instances/" + khoa, thanSua);

        String tenMoi = jdbc.queryForObject("select name from course_instances where id = ?", String.class, khoa);
        String trangThaiMoi = jdbc.queryForObject("select status from course_instances where id = ?", String.class, khoa);
        assertThat(tenMoi).isEqualTo("Toán 10 - Đã sửa");
        assertThat(trangThaiMoi).isEqualTo("ACTIVE");
    }

    @Test
    @DisplayName("Xóa khóa học qua DELETE /api/admin/course-instances/{id}")
    void xoaKhoaHoc() throws Exception {
        long khoa = moKhoaHoc("Toán 10 - Cần xóa", "2029-2030", "2029-09-01", "2030-05-30");
        sinhBuoiHoc(khoa);

        goi(HttpMethod.DELETE, "/api/admin/course-instances/" + khoa, "");

        Integer khoaConTonTai = jdbc.queryForObject(
                "select count(*) from course_instances where id = ? and deleted_at is null", Integer.class, khoa);
        assertThat(khoaConTonTai).isEqualTo(0);
    }

    private long moKhoaHoc(String ten, String namHoc, String tu, String den) throws Exception {
        String than = """
                {"templateId":%d,"name":"%s","schoolYear":"%s","startsOn":"%s","endsOn":"%s","status":"PUBLISHED"}
                """.formatted(mau, ten, namHoc, tu, den);
        goi(HttpMethod.POST, "/api/admin/course-instances", than);
        return jdbc.queryForObject(
                "select id from course_instances where school_year = ? and deleted_at is null",
                Long.class, namHoc);
    }

    private void sinhBuoiHoc(long khoaHoc) throws Exception {
        goi(HttpMethod.POST, "/api/admin/course-instances/" + khoaHoc + "/delivery-sessions/generate", "");
    }

    private int soBuoi(long khoaHoc) {
        Integer n = jdbc.queryForObject("""
                select count(*) from course_delivery_sessions
                where course_instance_id = ? and deleted_at is null""", Integer.class, khoaHoc);
        return n == null ? 0 : n;
    }

    private void goi(HttpMethod phuongThuc, String duongDan, String than) throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(phuongThuc, duongDan)
                .with(authentication(quanTri()))
                .contentType(MediaType.APPLICATION_JSON)
                .content(than);
        var phanHoi = mockMvc.perform(yeuCau).andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("%s %s → %s", phuongThuc, duongDan, noiDung).isEqualTo(200);
    }

    private Authentication quanTri() {
        Math10Principal principal = new Math10Principal(1L, "admin@lichkhoahoc.test", "ADMIN");
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }
}
