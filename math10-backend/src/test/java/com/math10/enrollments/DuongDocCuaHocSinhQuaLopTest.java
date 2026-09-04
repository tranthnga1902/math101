package com.math10.enrollments;

import com.math10.configuration.security.Math10Principal;
import com.math10.lessons.repository.LessonRepository;
import com.math10.programs.support.LuongNoiDung;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Đường đi từ học sinh tới học liệu: học sinh → lớp → chương trình → chương → bài → tệp.
 *
 * <p>Ba chỗ đọc trên đường này là SQL viết tay ({@code LessonRepository.studentCanAccess},
 * {@code LuongNoiDung.moDuocTep}, {@code /api/student/courses}), và cả ba
 * đều đi xuyên {@code class_courses}. Trình biên dịch không đọc chuỗi SQL, nên khi khoá ngoại của
 * bảng đó đổi chỗ trỏ thì không có gì báo động: câu lệnh vẫn dịch được, chỉ trả về sai. Sai theo
 * hướng thiếu thì học sinh mất học liệu; sai theo hướng thừa thì học sinh lớp này đọc được bài của
 * lớp khác. Phép thử ở đây chốt cả hai hướng <em>trước</em> khi đổi.
 *
 * <p>Mọi khẳng định nói bằng hành vi ("thấy / không thấy"), không nhắc tên cột. Việc nối lớp với
 * chương trình gom vào đúng một chỗ là {@link #ganChuongTrinhChoLop(long, long)} — đổi mô hình thì
 * sửa cái đó, còn khẳng định giữ nguyên. Nếu phải sửa khẳng định mới xanh lại thì đó không còn là
 * đổi cách nối, mà là đổi quyền đọc của học sinh.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Đường đọc của học sinh qua lớp")
class DuongDocCuaHocSinhQuaLopTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired LessonRepository lessons;
    @Autowired LuongNoiDung luongNoiDung;

    private static final String TEN_CHUONG_TRINH = "Toan 10 duong doc qua lop";

    private long chuongTrinh;
    private long bai;
    private long tep;
    private long lop;
    private long trongLop;
    private long ngoaiLop;
    private long ganLopVaoChuongTrinh;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-DUONG-DOC', ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, TEN_CHUONG_TRINH);

        Long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 1 - Mệnh đề', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);

        bai = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Bài 1 - Mệnh đề toán học', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);

        tep = jdbc.queryForObject("""
                insert into file_assets (file_name, file_url, mime_type, file_size, created_at, updated_at)
                values ('menh-de.pdf', 'https://vi-du/menh-de.pdf', 'application/pdf', 1024, now(), now())
                returning id""", Long.class);

        // Học liệu gắn qua luồng nội dung: tệp nằm ở kho tài liệu, còn dòng gắn chỉ trỏ tới nó.
        Long taiLieu = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, file_asset_id, status, created_at, updated_at)
                values ('Tài liệu mệnh đề', 'KHBD', 'STUDENT_ALLOWED', '', ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, tep);
        jdbc.update("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience, created_at, updated_at)
                values (?, 'DOCUMENT', ?, 'Tài liệu mệnh đề', 1, 'PUBLISHED', 'STUDENT_ALLOWED', now(), now())""",
                bai, taiLieu);

        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        lop = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values ('DUONGDOC-10A', 'Lớp 10A đường đọc', ?, 'ACTIVE', now(), now())
                returning id""", Long.class, khoi);

        trongLop = taoHocSinh("an.trong.lop");
        ngoaiLop = taoHocSinh("binh.ngoai.lop");
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?, ?, now(), now())",
                lop, trongLop);

        ganLopVaoChuongTrinh = ganChuongTrinhChoLop(lop, chuongTrinh);
    }

    @Test
    @DisplayName("Học sinh trong lớp thấy chương trình của lớp mình")
    void hocSinhTrongLopThayChuongTrinh() throws Exception {
        assertThat(goi("/api/student/courses", hocSinh(trongLop, "an")))
                .as("lớp đã được gán chương trình thì học sinh của lớp phải thấy nó")
                .contains(TEN_CHUONG_TRINH);
    }

    @Test
    @DisplayName("Học sinh không thuộc lớp nào thì không thấy chương trình của lớp đó")
    void hocSinhNgoaiLopKhongThayChuongTrinh() throws Exception {
        assertThat(goi("/api/student/courses", hocSinh(ngoaiLop, "binh")))
                .as("chương trình đi theo lớp, không phải ai đăng nhập cũng có")
                .doesNotContain(TEN_CHUONG_TRINH);
    }

    @Test
    @DisplayName("Học sinh trong lớp mở được bài của chương trình lớp đang học")
    void hocSinhTrongLopMoDuocBai() {
        assertThat(lessons.studentCanAccess(bai, trongLop)).isTrue();
    }

    @Test
    @DisplayName("Học sinh ngoài lớp không mở được bài")
    void hocSinhNgoaiLopKhongMoDuocBai() {
        assertThat(lessons.studentCanAccess(bai, ngoaiLop))
                .as("mất câu điều kiện theo học sinh thì đây là chỗ đỏ lên")
                .isFalse();
    }

    @Test
    @DisplayName("Học sinh trong lớp mở được tệp học liệu của bài")
    void hocSinhTrongLopMoDuocTep() {
        assertThat(luongNoiDung.moDuocTep(tep, trongLop)).isTrue();
    }

    @Test
    @DisplayName("Học sinh ngoài lớp không mở được tệp học liệu")
    void hocSinhNgoaiLopKhongMoDuocTep() {
        assertThat(luongNoiDung.moDuocTep(tep, ngoaiLop)).isFalse();
    }

    /**
     * Gỡ chương trình khỏi lớp là xoá mềm. Đường đọc phải nhìn thấy dấu xoá đó; nếu một lần viết
     * lại câu SQL nào đó bỏ sót {@code deleted_at is null} thì mọi phép thử khác vẫn xanh, chỉ
     * riêng chỗ này đỏ — nên nó ở đây một mình.
     */
    @Test
    @DisplayName("Gỡ chương trình khỏi lớp thì học sinh mất quyền đọc")
    void goChuongTrinhKhoiLopThiMatQuyenDoc() throws Exception {
        long lopRieng = taoLop("DUONGDOC-10B", "Lớp 10B đã gỡ");
        long hocSinhRieng = taoHocSinh("cuong.lop.da.go");
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?, ?, now(), now())",
                lopRieng, hocSinhRieng);
        long gan = ganChuongTrinhChoLop(lopRieng, chuongTrinh);
        assertThat(lessons.studentCanAccess(bai, hocSinhRieng)).as("trước khi gỡ thì đọc được").isTrue();

        goChuongTrinhKhoiLop(gan);

        assertThat(lessons.studentCanAccess(bai, hocSinhRieng)).as("đã gỡ thì không đọc được bài nữa").isFalse();
        assertThat(luongNoiDung.moDuocTep(tep, hocSinhRieng)).as("và không mở được tệp nữa").isFalse();
        assertThat(goi("/api/student/courses", hocSinh(hocSinhRieng, "cuong")))
                .as("và chương trình biến khỏi danh sách")
                .doesNotContain(TEN_CHUONG_TRINH);
    }

    /**
     * Gỡ rồi gán lại là việc bình thường: xếp nhầm khóa cho lớp thì gỡ ra, gán lại khóa đúng —
     * hoặc gán lại chính khóa đó sau khi sửa. Ràng buộc duy nhất cũ tính cả dòng đã xoá mềm nên
     * lượt gán lại vỡ, và vỡ ở chỗ khó đoán nhất: đường ghi hỏi qua thực thể có lọc {@code
     * deleted_at} nên tưởng lớp chưa có khóa, rồi mới đâm vào ràng buộc và trả 500.
     */
    @Test
    @DisplayName("Gỡ khóa khỏi lớp rồi gán lại được")
    void goKhoaRoiGanLaiDuoc() {
        long lopRieng = taoLop("DUONGDOC-10C", "Lớp 10C gán lại");
        goChuongTrinhKhoiLop(ganChuongTrinhChoLop(lopRieng, chuongTrinh));

        assertThat(ganChuongTrinhChoLop(lopRieng, chuongTrinh))
                .as("khóa đã gỡ phải trả lại chỗ cho lượt gán sau")
                .isPositive();
    }

    @Test
    @DisplayName("Hai lần gán cùng một khóa đang sống cho một lớp thì bị chặn")
    void ganTrungKhoaDangSongThiBiChan() {
        long lopRieng = taoLop("DUONGDOC-10D", "Lớp 10D gán trùng");
        ganChuongTrinhChoLop(lopRieng, chuongTrinh);

        assertThatThrownBy(() -> ganChuongTrinhChoLop(lopRieng, chuongTrinh))
                .as("nới ràng buộc để chữa lỗi gán lại thì đây là chỗ đỏ lên")
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Bảng điều khiển của Admin đếm đúng số chương trình của lớp")
    void adminDemDungSoChuongTrinhCuaLop() {
        assertThat(jdbc.queryForObject("""
                select count(*) from class_courses cco where cco.class_id = ? and cco.deleted_at is null
                """, Integer.class, lop))
                .as("lớp gán một chương trình thì Admin thấy đúng một")
                .isEqualTo(1);
        assertThat(ganLopVaoChuongTrinh).isPositive();
    }

    // ----- dựng dữ liệu: đổi mô hình nối lớp ↔ chương trình thì sửa ở đây, không sửa khẳng định -----

    /**
     * Lớp gắn vào khóa, khóa là lần triển khai chương trình trong một năm học. Phép thử vẫn nói
     * "gán chương trình cho lớp" vì đó là việc người dùng làm; đường đi qua khóa là chuyện của mô
     * hình và nằm gọn trong hàm này.
     *
     * @return id của dòng nối, để {@link #goChuongTrinhKhoiLop(long)} gỡ đúng dòng đó.
     */
    private long ganChuongTrinhChoLop(long lop, long chuongTrinh) {
        return jdbc.queryForObject("""
                insert into class_courses (class_id, course_instance_id, created_at, updated_at)
                values (?, ?, now(), now())
                returning id""", Long.class, lop, khoaCua(chuongTrinh));
    }

    /** Một khóa cho mỗi chương trình, dùng lại giữa các phép thử. */
    private long khoaCua(long chuongTrinh) {
        List<Long> daCo = jdbc.queryForList("""
                select ci.id from course_instances ci
                join program_templates pt on pt.id = ci.template_id and pt.deleted_at is null
                where pt.program_id = ? and ci.deleted_at is null
                order by ci.id limit 1""", Long.class, chuongTrinh);
        if (!daCo.isEmpty()) return daCo.get(0);

        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu đường đọc', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        // Năm học không phép thử nào khác dùng: các phép thử cùng ngữ cảnh Spring chia chung một
        // CSDL nhúng, và có phép thử tra khóa bằng school_year trên toàn bảng.
        return jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Khóa đường đọc 2094/2095', '2094-2095', '2094-08-01'::date, '2095-05-31'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau);
    }

    private void goChuongTrinhKhoiLop(long ganId) {
        jdbc.update("update class_courses set deleted_at = now() where id = ?", ganId);
    }

    private long taoLop(String ma, String ten) {
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        return jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, ma, ten, khoi);
    }

    private long taoHocSinh(String ten) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, 'STUDENT', 'ACTIVE', now(), now())
                returning id""", Long.class, ten + "@duongdoc.test", ten, ten);
    }

    private String goi(String duongDan, Authentication ai) throws Exception {
        var phanHoi = mockMvc.perform(get(duongDan).with(authentication(ai)).contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET %s → %s", duongDan, noiDung).isEqualTo(200);
        return noiDung;
    }

    private Authentication hocSinh(long id, String ten) {
        Math10Principal principal = new Math10Principal(id, ten + "@duongdoc.test", "STUDENT");
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
    }
}
