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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Màn khóa học của học sinh phải đọc chung một ống với mọi cửa còn lại.
 *
 * <p>Trước lát này hệ có hai ống song song. Admin thêm học liệu ở màn soạn bài thì nó rơi vào
 * {@code lesson_resources}; còn {@code /api/student/courses} — màn học sinh mở nhiều nhất — đọc
 * đúng bảng ấy và <em>chỉ</em> bảng ấy. Ống kia, {@code program_resources}, có trạng thái và có
 * đối tượng, nhưng chỉ hai cửa nhỏ đọc tới. Nên thứ admin gắn qua luồng nội dung không tới được
 * màn chính, và thứ tới được màn chính thì không đi qua luật nào cả.
 *
 * <p>Ca đầu là ca thật sự đỏ hôm nay: gắn đúng cách rồi mà học sinh vẫn không thấy. Ba ca sau đang
 * xanh một cách rỗng — bảng cũ không có gì để lọc nên chẳng có gì lọt — và chúng chỉ có nghĩa sau
 * khi cửa này chuyển sang ống mới. Viết trước là để lượt chuyển không lặng lẽ đánh rơi một trong
 * ba điều kiện: {@code lesson_resources} không có cột trạng thái lẫn cột đối tượng, nên chuyển
 * xong mà quên lọc thì không có gì đỏ lên báo.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Một ống nội dung cho mọi cửa đọc")
class MotOngNoiDungTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long bai;
    private long hocSinh;

    @BeforeAll
    void dungDuLieu() {
        Long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-MOTONG', 'Toan 10 mot ong noi dung', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        Long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 1 - Mệnh đề và tập hợp', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        bai = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Bài 1 - Mệnh đề toán học', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);

        ganVaoLuong(taiLieu("Phieu on tap menh de", "STUDENT_ALLOWED", "PUBLISHED"), 1, "PUBLISHED", "STUDENT_ALLOWED");
        ganVaoLuong(taiLieu("Dap an phieu on tap menh de", "TEACHER_ONLY", "PUBLISHED"), 2, "PUBLISHED", "TEACHER_ONLY");
        ganVaoLuong(taiLieu("Ban nhap chua soat menh de", "STUDENT_ALLOWED", "PUBLISHED"), 3, "DRAFT", "STUDENT_ALLOWED");
        long daXoa = taiLieu("Tai lieu da go khoi kho menh de", "STUDENT_ALLOWED", "PUBLISHED");
        ganVaoLuong(daXoa, 4, "PUBLISHED", "STUDENT_ALLOWED");
        jdbc.update("update documents set deleted_at=now() where id=?", daXoa);

        hocSinh = ghiDanh(chuongTrinh);
    }

    @Test
    @DisplayName("Học liệu gắn qua luồng nội dung hiện trên màn khóa học")
    void hocLieuGanQuaLuongHienTrenManKhoaHoc() throws Exception {
        assertThat(manKhoaHoc())
                .as("gắn đúng đường mà màn chính không thấy thì luồng nội dung mới đi tới đâu?")
                .contains("Phieu on tap menh de");
    }

    @Test
    @DisplayName("Đáp án không lọt ra màn khóa học")
    void dapAnKhongLotRaManKhoaHoc() throws Exception {
        assertThat(manKhoaHoc())
                .as("cửa này phải trả lời về đối tượng giống hệt hai cửa kia")
                .doesNotContain("Dap an phieu on tap");
    }

    @Test
    @DisplayName("Bản nháp không lọt ra màn khóa học")
    void banNhapKhongLotRaManKhoaHoc() throws Exception {
        assertThat(manKhoaHoc())
                .as("soạn dở mà học sinh đọc được là mất luôn quãng soạn dở")
                .doesNotContain("Ban nhap chua soat");
    }

    @Test
    @DisplayName("Tài liệu đã gỡ khỏi kho không lọt ra màn khóa học")
    void taiLieuDaXoaKhongLotRaManKhoaHoc() throws Exception {
        assertThat(manKhoaHoc())
                .as("dòng gắn còn sống nhưng thứ nó trỏ tới đã mất thì không còn gì để phát")
                .doesNotContain("Tai lieu da go khoi kho");
    }

    // ==================== dựng dữ liệu ====================

    private long taiLieu(String ten, String doiTuong, String trangThai) {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, created_at, updated_at)
                values (?, 'KHBD', ?::varchar, '', ?::varchar, now(), now())
                returning id""", Long.class, ten, doiTuong, trangThai);
    }

    private void ganVaoLuong(long taiLieu, int thuTu, String trangThai, String doiTuong) {
        jdbc.update("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience, created_at, updated_at)
                values (?, 'DOCUMENT', ?, ?, ?, ?::varchar, ?::varchar, now(), now())""",
                bai, taiLieu, jdbc.queryForObject("select title from documents where id=?", String.class, taiLieu),
                thuTu, trangThai, doiTuong);
    }

    /** Lớp → khóa → mẫu → chương trình: chuỗi mà {@code /api/student/courses} đi ngược lên. */
    private long ghiDanh(long chuongTrinh) {
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        Long lop = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values ('MOTONG-10A', 'Lớp 10A một ống', ?, 'ACTIVE', now(), now())
                returning id""", Long.class, khoi);
        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu một ống', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        // Năm học không phép thử nào khác dùng: các phép thử cùng ngữ cảnh Spring chia chung một
        // CSDL nhúng, và có phép thử tra khóa bằng school_year trên toàn bảng.
        Long khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Khóa một ống 2092/2093', '2092-2093', '2092-08-01'::date, '2093-05-31'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau);
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())",
                lop, khoa);
        Long em = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values ('an@motong.test', 'khong-dung-toi', 'An một ống', 'an.mot.ong', 'STUDENT', 'ACTIVE', now(), now())
                returning id""", Long.class);
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())",
                lop, em);
        return em;
    }

    private String manKhoaHoc() throws Exception {
        var phanHoi = mockMvc.perform(get("/api/student/courses")
                        .with(authentication(ai()))
                        .contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET /api/student/courses → %s", noiDung).isEqualTo(200);
        return noiDung;
    }

    private Authentication ai() {
        Math10Principal principal = new Math10Principal(hocSinh, "an@motong.test", "STUDENT");
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
    }
}
