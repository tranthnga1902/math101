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
 * Một mẫu chương trình phải mở được nhiều năm học, mỗi năm giữ lịch riêng.
 *
 * <p>Đây là lý do cả ba tầng tồn tại: {@code courses} là chương trình, {@code program_templates} là
 * mẫu tái dùng, {@code course_instances} là lần triển khai theo năm. Tách ba tầng mà năm thứ hai
 * không xếp được lịch thì việc tách ra không mang lại gì.
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
@DisplayName("Lịch khóa học theo từng năm")
class LichKhoaHocTheoNamTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long chuongTrinh;
    private long chuongMot;
    private long mau;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, description, status, created_at, updated_at)
                values ('TOAN10-KNTT', 'Toán 10 Kết nối tri thức', null, 'PUBLISHED', now(), now())
                returning id""", Long.class);

        chuongMot = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 1 - Mệnh đề và tập hợp', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);

        mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Toán 10 - KNTT - Chuẩn', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);

        jdbc.update("""
                insert into program_template_chapters
                    (template_id, chapter_id, order_index, recommended_days, created_at, updated_at)
                values (?, ?, 1, 14, now(), now())""", mau, chuongMot);
    }

    @Test
    @DisplayName("Cùng một mẫu mở được hai năm học, mỗi năm giữ lịch riêng")
    void haiNamHocCungMotMau() throws Exception {
        long namDau = moKhoaHoc("Toán 10 - 2026/2027", "2026-2027", "2026-09-05", "2027-05-25");
        long namSau = moKhoaHoc("Toán 10 - 2027/2028", "2027-2028", "2027-09-04", "2028-05-23");

        xepLich(namDau, "2026-09-05", "2026-09-19");
        xepLich(namSau, "2027-09-04", "2027-09-18");

        // Xếp lịch năm sau không được xóa lịch năm trước.
        assertThat(soDongLich(namDau)).as("lịch năm 2026/2027 sau khi xếp lịch 2027/2028").isEqualTo(1);
        assertThat(soDongLich(namSau)).as("lịch năm 2027/2028").isEqualTo(1);

        // Và mỗi năm phải trả về đúng khoảng ngày của chính nó.
        assertThat(ngayBatDau(namDau)).isEqualTo("2026-09-05");
        assertThat(ngayBatDau(namSau)).isEqualTo("2027-09-04");
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

    private void xepLich(long khoaHoc, String tu, String den) throws Exception {
        String than = """
                [{"chapterId":%d,"startsOn":"%s","endsOn":"%s"}]""".formatted(chuongMot, tu, den);
        goi(HttpMethod.PUT, "/api/admin/courses/" + khoaHoc + "/schedule", than);
    }

    private int soDongLich(long khoaHoc) {
        Integer n = jdbc.queryForObject("""
                select count(*) from program_schedules
                where course_instance_id = ? and deleted_at is null""", Integer.class, khoaHoc);
        return n == null ? 0 : n;
    }

    private String ngayBatDau(long khoaHoc) {
        return jdbc.queryForObject("""
                select starts_on::text from program_schedules
                where course_instance_id = ? and deleted_at is null""", String.class, khoaHoc);
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
