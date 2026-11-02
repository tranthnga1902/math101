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
 * Quy tắc gốc của lát học sinh: chương trình giống nhau cho mọi học sinh, chương hiện hành suy ra
 * từ lịch Admin đặt cộng ngày hôm nay, và tiến độ cá nhân không tham gia vào quyết định đó.
 *
 * <p>Hai phép thử ở đây canh hai chuyện khác hẳn nhau. Cái thứ nhất là <em>chốt chặn</em>: hôm nay
 * nó đậu hiển nhiên, vì câu truy vấn chương hiện hành không hề nhận tham số người dùng. Nó chỉ có
 * giá trị vào ngày ai đó nối bảng tiến độ vào truy vấn ấy để "cá nhân hóa" — lúc đó nó đỏ.
 *
 * <p>Cái thứ hai là lỗi thật. {@code program_schedules} chạy hai chế độ: dòng cũ để
 * {@code course_instance_id} rỗng, dòng theo năm học thì có. Đường đọc học liệu của học sinh join
 * bảng này mà không chọn chế độ nào, nên một chương có cả hai loại dòng sẽ nhân đôi mọi học liệu.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Chương trình chung cho học sinh")
class ChuongTrinhChungChoHocSinhTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long chuongTrinh;
    private long chuong;
    private long bai;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-CHUNG', 'Toán 10 dùng chung', 'PUBLISHED', now(), now())
                returning id""", Long.class);

        chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 6 - Hàm số, đồ thị và ứng dụng', 6, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);

        bai = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Bài 2 - Hàm số bậc hai', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);

        // Tài liệu thật, không phải resource_ref_id=1 cho có. Luồng nội dung nay hỏi trạng thái của
        // thứ được trỏ tới, nên một mục trỏ vào khoảng không sẽ không hiện ra nữa — mà lớp này hỏi
        // chuyện nhân đôi vì lịch, không phải chuyện tham chiếu hỏng.
        Long taiLieu = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, created_at, updated_at)
                values ('Tóm tắt hàm số bậc hai', 'KHBD', 'STUDENT_ALLOWED', '', 'PUBLISHED', now(), now())
                returning id""", Long.class);

        jdbc.update("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, created_at, updated_at)
                values (?, 'DOCUMENT', ?, 'Tóm tắt hàm số bậc hai', 1, 'PUBLISHED', now(), now())""", bai, taiLieu);
    }

    @Test
    @DisplayName("Hai học sinh khác nhau nhận đúng cùng một chương hiện hành")
    void haiHocSinhCungMotChuong() throws Exception {
        xepLichCu("2026-08-01", "2026-12-31");

        String cuaAn = goi("/api/programs/" + chuongTrinh + "/chapters-by-time?at=2026-09-15", hocSinh(101L, "an"));
        String cuaBinh = goi("/api/programs/" + chuongTrinh + "/chapters-by-time?at=2026-09-15", hocSinh(202L, "binh"));

        assertThat(cuaAn).as("An chưa học xong chương trước vẫn thấy chương theo lịch").contains("CURRENT");
        assertThat(cuaBinh).isEqualTo(cuaAn);
    }

    @Test
    @DisplayName("Bài dạy trong nhiều tiết thì học liệu của bài vẫn hiện đúng một lần")
    void hocLieuKhongBiNhanDoi() throws Exception {
        // Tiền đề cũ của ca này là lịch: một chương có cả lịch cũ lẫn lịch theo năm thì phép nối
        // lịch nhân đôi dòng học liệu. Lát bốn dải bỏ hẳn phép nối ấy, nên viết y nguyên thì ca này
        // xanh mãi mãi và không còn canh gì.
        //
        // Nguy cơ nhân đôi không mất, nó chuyển chỗ: cột tuần của dòng-theo-bài hỏi "bài này dạy ở
        // tuần mấy", mà một bài thường trải hai ba tiết. Câu con đang lấy min nên ra một số; đổi
        // thành phép nối ngang thì ra hai dòng, và màn hình học sinh có hai thẻ y hệt nhau.
        daySangTietThuHai();

        String than = goi("/api/programs/" + chuongTrinh + "/resources?type=DOCUMENT", hocSinh(303L, "cuong"));

        assertThat(soLan(than, "Tóm tắt hàm số bậc hai"))
                .as("một học liệu, một lần hiện ra: %s", than)
                .isEqualTo(1);
    }

    /** Bài duy nhất của lớp này được xếp dạy ở hai tiết, tuần 3 và tuần 4. */
    private void daySangTietThuHai() {
        Long mach = jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, 'DS-CHUNG', 'Đại số', 1, now(), now())
                returning id""", Long.class, chuongTrinh);
        for (int tuan : new int[]{3, 4}) {
            jdbc.update("""
                    insert into program_periods (strand_id, period_no, week_no, term, lesson_id, title,
                                                 period_kind, created_at, updated_at)
                    values (?, ?, ?, 1, ?, ?, 'BAI_MOI', now(), now())""",
                    mach, tuan, tuan, bai, "Tiết tuần " + tuan);
        }
    }

    private void xepLichCu(String tu, String den) {
        jdbc.update("delete from program_schedules where course_id = ? and course_instance_id is null", chuongTrinh);
        jdbc.update("""
                insert into program_schedules (course_id, chapter_id, starts_on, ends_on, status, created_at, updated_at)
                values (?, ?, ?::date, ?::date, 'ACTIVE', now(), now())""", chuongTrinh, chuong, tu, den);
    }

    private void xepLichTheoNam(String tu, String den) {
        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu chuẩn', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        // Năm học phải là năm không lớp test nào khác dùng: các phép thử cùng ngữ cảnh Spring dùng
        // chung một CSDL nhúng, và LichKhoaHocTheoNamTest tra khóa học bằng school_year trên toàn
        // bảng chứ không theo id nó vừa tạo, nên trùng năm là nó vỡ.
        Long khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Toán 10 - 2098/2099', '2098-2099', ?::date, ?::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau, tu, den);
        jdbc.update("""
                insert into program_schedules
                    (course_id, course_instance_id, chapter_id, starts_on, ends_on, status, created_at, updated_at)
                values (?, ?, ?, ?::date, ?::date, 'ACTIVE', now(), now())""",
                chuongTrinh, khoa, chuong, tu, den);
    }

    private int soLan(String than, String chuoi) {
        int n = 0;
        for (int i = than.indexOf(chuoi); i >= 0; i = than.indexOf(chuoi, i + 1)) n++;
        return n;
    }

    private String goi(String duongDan, Authentication ai) throws Exception {
        var phanHoi = mockMvc.perform(get(duongDan).with(authentication(ai)).contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET %s → %s", duongDan, noiDung).isEqualTo(200);
        return noiDung;
    }

    private Authentication hocSinh(long id, String ten) {
        Math10Principal principal = new Math10Principal(id, ten + "@chuongtrinhchung.test", "STUDENT");
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
    }
}
