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
 * Cổng tải tệp phải hỏi cùng một luật với màn hình đã hiện ra tệp ấy.
 *
 * <p>Danh sách học liệu và cổng tải tệp là hai cửa của cùng một câu hỏi, và mỗi cửa đang tự trả lời
 * theo bảng riêng: danh sách vừa chuyển sang {@code program_resources}, còn cổng tệp vẫn lần từ
 * {@code file_assets} qua {@code lesson_resources} lên tới lớp. Hai bảng, hai câu trả lời.
 *
 * <p>Lệch theo cả hai chiều, và chiều nào cũng hỏng thật:
 * <ul>
 *   <li>tệp gắn qua đường mới thì <em>không</em> có dòng cũ nào, nên cổng từ chối thứ mà màn hình
 *       vừa mời học sinh bấm vào;
 *   <li>và khi nối cổng sang bảng mới, nếu nối bằng một câu truy vấn viết riêng thì nó sẽ chỉ biết
 *       hỏi "tệp này thuộc bài nào, bài ấy thuộc lớp nào" — đúng câu mà bảng cũ hỏi được — mà quên
 *       mất hai cột bảng mới có thêm. Đáp án đã bị giấu khỏi danh sách vẫn tải về được bằng số hiệu
 *       tệp, và không màn hình nào cho thấy điều đó.
 * </ul>
 *
 * <p>Nên ca đầu là ca đỏ hôm nay, còn ba ca sau đang xanh một cách rỗng: cổng chưa nhìn tới bảng
 * mới nên nó từ chối tất, kể cả những thứ đáng ra phải từ chối. Chúng chỉ thành ca thật sau khi
 * cổng chuyển sang ống mới — và chính vì thế phải viết trước, để lượt chuyển ấy không lặng lẽ mở
 * một cửa sau.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Cổng tải tệp đi theo luồng nội dung")
class MoTepTheoLuongNoiDungTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long bai;
    private long trongLop;
    private long ngoaiLop;

    private long tepHocLieu;
    private long tepDapAn;
    private long tepBanNhap;

    @BeforeAll
    void dungDuLieu() {
        Long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-MOTEP', 'Toan 10 mo tep theo luong', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        Long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 1 - Hàm số bậc hai', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        bai = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Bài 1 - Đồ thị hàm số bậc hai', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);

        tepHocLieu = tep("phieu-bai-tap-ham-so.pdf");
        tepDapAn = tep("dap-an-phieu-ham-so.pdf");
        tepBanNhap = tep("ban-nhap-ham-so.pdf");

        ganVaoLuong(taiLieu("Phieu bai tap ham so", tepHocLieu), 1, "PUBLISHED", "STUDENT_ALLOWED");
        ganVaoLuong(taiLieu("Dap an phieu ham so", tepDapAn), 2, "PUBLISHED", "TEACHER_ONLY");
        ganVaoLuong(taiLieu("Ban nhap ham so", tepBanNhap), 3, "DRAFT", "STUDENT_ALLOWED");

        trongLop = ghiDanh(chuongTrinh);
        // Tên tài khoản phải riêng của lớp phép thử này, cùng lý do với năm học ở dưới.
        ngoaiLop = hocSinh("binh@motep.test", "Bình ngoài lớp", "binh.ngoai.lop.motep");
    }

    @Test
    @DisplayName("Tệp gắn qua luồng nội dung thì học sinh trong lớp mở được")
    void tepGanQuaLuongMoDuoc() throws Exception {
        assertThat(moTep(tepHocLieu, trongLop))
                .as("màn hình vừa mời em bấm vào mà cổng lại từ chối thì em không đọc được bằng đường nào")
                .isEqualTo(200);
    }

    @Test
    @DisplayName("Tệp đáp án không mở được dù biết số hiệu")
    void tepDapAnKhongMoDuoc() throws Exception {
        assertThat(moTep(tepDapAn, trongLop))
                .as("giấu khỏi danh sách mà vẫn tải về được bằng số hiệu thì chỉ là giấu, không phải chặn")
                .isEqualTo(403);
    }

    @Test
    @DisplayName("Tệp của bản nháp không mở được dù biết số hiệu")
    void tepBanNhapKhongMoDuoc() throws Exception {
        assertThat(moTep(tepBanNhap, trongLop))
                .as("mục chưa xuất bản thì chưa có gì để phát, kể cả tệp của nó")
                .isEqualTo(403);
    }

    @Test
    @DisplayName("Học sinh ngoài lớp không mở được tệp của lớp")
    void tepNgoaiLopKhongMoDuoc() throws Exception {
        assertThat(moTep(tepHocLieu, ngoaiLop))
                .as("đổi bảng nào thì đổi, câu hỏi 'em có thuộc lớp được cấp không' vẫn phải còn")
                .isEqualTo(403);
    }

    // ==================== dựng dữ liệu ====================

    private long tep(String ten) {
        return jdbc.queryForObject("""
                insert into file_assets (file_name, file_url, mime_type, file_size, created_at, updated_at)
                values (?, ?, 'application/pdf', 1024, now(), now())
                returning id""", Long.class, ten, "https://vi-du.test/" + ten);
    }

    private long taiLieu(String ten, long tep) {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, file_asset_id, status, created_at, updated_at)
                values (?, 'KHBD', 'STUDENT_ALLOWED', '', ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, ten, tep);
    }

    private void ganVaoLuong(long taiLieu, int thuTu, String trangThai, String doiTuong) {
        jdbc.update("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience, created_at, updated_at)
                values (?, 'DOCUMENT', ?, ?, ?, ?::varchar, ?::varchar, now(), now())""",
                bai, taiLieu, jdbc.queryForObject("select title from documents where id=?", String.class, taiLieu),
                thuTu, trangThai, doiTuong);
    }

    private long ghiDanh(long chuongTrinh) {
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        Long lop = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values ('MOTEP-10A', 'Lớp 10A mở tệp', ?, 'ACTIVE', now(), now())
                returning id""", Long.class, khoi);
        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu mở tệp', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        // Năm học không phép thử nào khác dùng — các phép thử cùng ngữ cảnh Spring chia chung một CSDL.
        Long khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Khóa mở tệp 2094/2095', '2094-2095', '2094-08-01'::date, '2095-05-31'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau);
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())",
                lop, khoa);
        long em = hocSinh("an@motep.test", "An trong lớp", "an.trong.lop.motep");
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())",
                lop, em);
        return em;
    }

    private long hocSinh(String thu, String ten, String taiKhoan) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, 'STUDENT', 'ACTIVE', now(), now())
                returning id""", Long.class, thu, ten, taiKhoan);
    }

    /** Trả mã trạng thái thay vì ném, vì ca cần phân biệt 200 với 403 chứ không phải đỗ hay trượt. */
    private int moTep(long tep, long em) throws Exception {
        var phanHoi = mockMvc.perform(get("/api/files/{id}", tep).with(authentication(ai(em))))
                .andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus())
                .as("GET /api/files/%s → %s", tep, noiDung)
                .isIn(200, 403);
        return phanHoi.getStatus();
    }

    private Authentication ai(long em) {
        Math10Principal principal = new Math10Principal(em, "hoc-sinh@motep.test", "STUDENT");
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
    }
}
