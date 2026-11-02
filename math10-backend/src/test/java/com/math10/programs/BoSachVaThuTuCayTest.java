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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Bộ SGK và thứ tự cây chương trình.
 *
 * <p>Phép thử trọng tâm là {@link #xoaMemChuongTraLaiSoThuTu()}. Ràng buộc thứ tự đã có từ
 * baseline, nhưng nó là ràng buộc bảng nên tính cả dòng đã xoá mềm: xoá Chương 3 rồi tạo Chương 3
 * mới thì CSDL từ chối, trong khi trên màn hình không có chương nào mang số 3. Không ai đoán ra
 * được từ thông báo lỗi, và cũng không chữa được ngoài việc đánh số lại cả cây. Chỉ mục duy nhất
 * từng phần đóng đúng khe đó mà không nới lỏng luật với các chương đang sống — nên
 * {@link #haiChuongDangSongKhongDuocTrungSo()} đi kèm, để lần sau không ai gỡ luôn ràng buộc.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Bộ SGK và thứ tự cây chương trình")
class BoSachVaThuTuCayTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long chuongTrinh;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-BO-SACH', 'Toán 10 thử bộ sách', 'PUBLISHED', now(), now())
                returning id""", Long.class);
    }

    @Test
    @DisplayName("Xoá mềm một chương thì trả lại số thứ tự cho chương mới")
    void xoaMemChuongTraLaiSoThuTu() {
        Long cu = themChuong(31, "Chương cũ");
        jdbc.update("update chapters set deleted_at = now() where id = ?", cu);

        assertThat(themChuong(31, "Chương mới thay chỗ"))
                .as("số thứ tự của chương đã xoá phải dùng lại được")
                .isNotNull();
    }

    @Test
    @DisplayName("Xoá mềm một bài thì trả lại số thứ tự cho bài mới")
    void xoaMemBaiTraLaiSoThuTu() {
        Long chuong = themChuong(32, "Chương chứa bài");
        Long cu = themBai(chuong, 1, "Bài cũ");
        jdbc.update("update lessons set deleted_at = now() where id = ?", cu);

        assertThat(themBai(chuong, 1, "Bài mới thay chỗ")).isNotNull();
    }

    @Test
    @DisplayName("Hai chương đang sống không được trùng số thứ tự")
    void haiChuongDangSongKhongDuocTrungSo() {
        themChuong(33, "Chương giữ chỗ");

        assertThatThrownBy(() -> themChuong(33, "Chương đòi cùng số"))
                .as("thứ tự đổi giữa hai lượt gọi là lỗi đã làm hỏng sổ điểm — CSDL phải chặn")
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Giáo viên không tạo được bộ SGK")
    void giaoVienKhongTaoDuocBoSgk() throws Exception {
        var phanHoi = mockMvc.perform(post("/api/admin/book-series")
                        .with(authentication(vai(501L, "co.hoa", "TEACHER")))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"KNTT\",\"name\":\"Kết nối tri thức\"}"))
                .andReturn().getResponse();

        assertThat(phanHoi.getStatus())
                .as("bộ SGK là dữ liệu hệ thống: %s", phanHoi.getContentAsString(StandardCharsets.UTF_8))
                .isEqualTo(403);
    }

    @Test
    @DisplayName("Xoá bộ SGK còn chương trình đang dùng thì bị chặn và nói rõ còn bao nhiêu")
    void xoaBoSgkConChuongTrinhDungThiBiChan() throws Exception {
        Long bo = jdbc.queryForObject("""
                insert into book_series (code, name, publisher, status, order_no, created_at, updated_at)
                values ('CTST', 'Chân trời sáng tạo', 'NXB Giáo dục', 'ACTIVE', 1, now(), now())
                returning id""", Long.class);
        jdbc.update("update courses set book_series_id = ? where id = ?", bo, chuongTrinh);

        var phanHoi = mockMvc.perform(delete("/api/admin/book-series/" + bo)
                        .with(authentication(vai(601L, "quantri", "ADMIN"))))
                .andReturn().getResponse();
        String than = phanHoi.getContentAsString(StandardCharsets.UTF_8);

        assertThat(than).as("phải nói ra số chương trình đang vướng: %s", than).contains("Còn 1 chương trình");
        assertThat(jdbc.queryForObject("select deleted_at is null from book_series where id = ?", Boolean.class, bo))
                .as("lượt gọi bị chặn thì không được kịp xoá mềm gì")
                .isTrue();
    }

    private Long themChuong(int thuTu, String ten) {
        return jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh, ten, thuTu);
    }

    private Long themBai(Long chuong, int thuTu, String ten) {
        return jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong, ten, thuTu);
    }

    private Authentication vai(long id, String ten, String vaiTro) {
        Math10Principal principal = new Math10Principal(id, ten + "@bosach.test", vaiTro);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vaiTro)));
    }
}
