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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Thứ admin gắn thêm từ hôm nay phải tới được màn học sinh.
 *
 * <p>Lượt chuyển ống ở lát này mới dời <em>cửa đọc</em> sang {@code program_resources}. Màn soạn bài
 * của admin thì vẫn ghi vào {@code lesson_resources} — bảng giờ không còn cửa đọc nào. Di dân đã
 * mang hết những gì có sẵn lúc chạy migration sang ống mới, nhưng migration chạy một lần: mọi thứ
 * gắn thêm <em>sau</em> đó rơi vào bảng chết. Không lỗi, không màn hình trống, không dòng nhật ký —
 * admin bấm lưu, thấy học liệu nằm trong danh sách của mình, và học sinh không bao giờ thấy nó.
 *
 * <p>Đó là hình dạng tệ nhất trong hệ này: dữ liệu sai mà không nhìn thấy được. Nên hai ca đầu là
 * hai ca đỏ hôm nay, và chúng đo đúng một việc — gắn xong thì em có thấy không.
 *
 * <p>Ba ca sau viết lúc chưa có endpoint nào để gọi, nên khi ấy chúng xanh rỗng: chưa gắn được gì
 * thì cũng chẳng có gì lọt ra. Viết trước là để đường ghi mới không mở rộng hơn đường cũ trong lúc
 * dựng. Ống mới có hai cột mà ống cũ không có — trạng thái và đối tượng — nên đây là lần đầu tiên
 * màn quản trị <em>phải</em> khai hai điều ấy, và cũng là lần đầu tiên nó có thể khai sai.
 *
 * <p>Endpoint đã dựng xong và vòng đột biến đã đo lại: bỏ trần đối tượng thì
 * {@code chiGiaoVienGanVaoKhongLotRa} đỏ, bỏ hàng rào che đường dẫn thô thì
 * {@code duongDanThoKhongLotRaManHocSinh} đỏ. Không còn ca nào ở đây xanh rỗng.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Gắn học liệu từ màn quản trị")
class GanHocLieuTuManQuanTriTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long bai;
    private long hocSinh;
    private long tep;

    @BeforeAll
    void dungDuLieu() {
        Long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-GANMOI', 'Toan 10 gan hoc lieu moi', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        Long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 1 - Bất phương trình', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        bai = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Bài 1 - Bất phương trình bậc nhất', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);
        tep = jdbc.queryForObject("""
                insert into file_assets (file_name, file_url, mime_type, file_size, created_at, updated_at)
                values ('phieu-bpt.pdf', 'https://vi-du.test/phieu-bpt.pdf', 'application/pdf', 2048, now(), now())
                returning id""", Long.class);

        hocSinh = ghiDanh(chuongTrinh);
    }

    @Test
    @DisplayName("Tài liệu admin vừa gắn hiện ngay trên màn học sinh")
    void taiLieuAdminGanHienNgayTrenManHocSinh() throws Exception {
        assertThat(gan("""
                {"resourceType":"DOCUMENT","title":"Phieu luyen bat phuong trinh","fileAssetId":%d,
                 "orderIndex":1,"status":"PUBLISHED","audience":"STUDENT_ALLOWED"}""".formatted(tep), quanTri()))
                .as("admin bấm lưu xong mà không có cửa nào nhận thì học liệu rơi vào bảng chết")
                .isEqualTo(200);
        assertThat(manKhoaHoc())
                .as("gắn từ màn quản trị mà màn chính không thấy là dữ liệu sai không nhìn thấy được")
                .contains("Phieu luyen bat phuong trinh");
    }

    @Test
    @DisplayName("Video admin vừa gắn hiện ngay trên màn học sinh")
    void videoAdminGanHienNgayTrenManHocSinh() throws Exception {
        assertThat(gan("""
                {"resourceType":"VIDEO","title":"Chua bai bat phuong trinh",
                 "videoUrl":"https://www.youtube.com/watch?v=bpt-01",
                 "orderIndex":2,"status":"PUBLISHED","audience":"STUDENT_ALLOWED"}""", quanTri()))
                .as("video đi đường riêng của nó nên phải thử riêng, không suy từ ca tài liệu ra được")
                .isEqualTo(200);
        assertThat(manKhoaHoc())
                .as("hai loại nội dung, hai bảng đích, cùng một màn hình phải thấy")
                .contains("Chua bai bat phuong trinh");
    }

    @Test
    @DisplayName("Bản nháp vừa gắn không lọt ra màn học sinh")
    void banNhapGanVaoKhongLotRa() throws Exception {
        gan("""
                {"resourceType":"DOCUMENT","title":"Ban nhap bat phuong trinh","fileAssetId":%d,
                 "orderIndex":3,"status":"DRAFT","audience":"STUDENT_ALLOWED"}""".formatted(tep), quanTri());
        assertThat(manKhoaHoc())
                .as("ống cũ không có cột trạng thái nên màn quản trị chưa từng phải khai; khai rồi mà không ai đọc thì như chưa khai")
                .doesNotContain("Ban nhap bat phuong trinh");
    }

    @Test
    @DisplayName("Tài liệu chỉ dành cho giáo viên vừa gắn không lọt ra màn học sinh")
    void chiGiaoVienGanVaoKhongLotRa() throws Exception {
        gan("""
                {"resourceType":"DOCUMENT","title":"Dap an bat phuong trinh","fileAssetId":%d,
                 "orderIndex":4,"status":"PUBLISHED","audience":"TEACHER_ONLY"}""".formatted(tep), quanTri());
        assertThat(manKhoaHoc())
                .as("đây là lần đầu màn quản trị khai được đối tượng, nên cũng là lần đầu nó khai hụt được")
                .doesNotContain("Dap an bat phuong trinh");
        // Dấu chỉ-giáo-viên phải nằm trên chính tài liệu, không chỉ trên dòng gắn: lần gắn sau vào
        // bài khác đọc trần từ tài liệu, nên ghi lệch hai chỗ là mở đường cho lần gắn sau nới rộng.
        assertThat(jdbc.queryForObject(
                "select audience from documents where title='Dap an bat phuong trinh'", String.class))
                .as("dòng gắn và tài liệu gốc phải nói cùng một điều về cùng một tệp")
                .isEqualTo("TEACHER_ONLY");
    }

    @Test
    @DisplayName("Đường dẫn thô của tệp không lọt ra màn học sinh")
    void duongDanThoKhongLotRaManHocSinh() throws Exception {
        gan("""
                {"resourceType":"DOCUMENT","title":"Tai lieu co tep bat phuong trinh","fileAssetId":%d,
                 "orderIndex":6,"status":"PUBLISHED","audience":"STUDENT_ALLOWED"}""".formatted(tep), quanTri());
        assertThat(manKhoaHoc())
                .as("""
                    đường dẫn kho là đường không hỏi ai: gửi cho người ngoài lớp thì vẫn mở được, và \
                    mở được mãi. Em đọc được tài liệu không có nghĩa cả internet đọc được — đó là \
                    hai câu hỏi khác nhau, và cổng /api/files mới là chỗ trả lời câu thứ hai""")
                .contains("Tai lieu co tep bat phuong trinh")
                .doesNotContain("vi-du.test/phieu-bpt.pdf");
    }

    @Test
    @DisplayName("Giáo viên không gắn được học liệu vào bài")
    void giaoVienKhongGanDuoc() throws Exception {
        assertThat(gan("""
                {"resourceType":"DOCUMENT","title":"Giao vien tu gan bat phuong trinh","fileAssetId":%d,
                 "orderIndex":5,"status":"PUBLISHED","audience":"STUDENT_ALLOWED"}""".formatted(tep), giaoVien()))
                .as("đường ghi dời chỗ là lúc dễ đánh rơi cổng vai trò nhất, vì cổng cũ nằm ở tệp cũ")
                .isEqualTo(403);
        assertThat(manKhoaHoc()).doesNotContain("Giao vien tu gan bat phuong trinh");
    }

    // ==================== dựng dữ liệu ====================

    /** Trả mã trạng thái thay vì ném, vì có ca cần 403 và có ca cần 200. */
    private int gan(String than, Authentication ai) throws Exception {
        return mockMvc.perform(post("/api/admin/lessons/{id}/resources/new", bai)
                        .with(authentication(ai))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(than))
                .andReturn().getResponse().getStatus();
    }

    private long ghiDanh(long chuongTrinh) {
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        Long lop = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values ('GANMOI-10A', 'Lớp 10A gắn mới', ?, 'ACTIVE', now(), now())
                returning id""", Long.class, khoi);
        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu gắn mới', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        // Năm học và tên tài khoản đều phải riêng: các phép thử cùng ngữ cảnh Spring chia chung một
        // CSDL nhúng, và users có chỉ mục duy nhất trên username còn sống.
        Long khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Khóa gắn mới 2096/2097', '2096-2097', '2096-08-01'::date, '2097-05-31'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau);
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())",
                lop, khoa);
        Long em = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values ('an@ganmoi.test', 'khong-dung-toi', 'An gắn mới', 'an.gan.moi', 'STUDENT', 'ACTIVE', now(), now())
                returning id""", Long.class);
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())",
                lop, em);
        return em;
    }

    private String manKhoaHoc() throws Exception {
        var phanHoi = mockMvc.perform(get("/api/student/courses")
                        .with(authentication(ai(hocSinh, "an@ganmoi.test", "STUDENT")))
                        .contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET /api/student/courses → %s", noiDung).isEqualTo(200);
        return noiDung;
    }

    private Authentication quanTri() {
        return ai(900_001L, "quan.tri@ganmoi.test", "ADMIN");
    }

    private Authentication giaoVien() {
        return ai(900_002L, "giao.vien@ganmoi.test", "TEACHER");
    }

    private Authentication ai(long ai, String thu, String vai) {
        Math10Principal principal = new Math10Principal(ai, thu, vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
