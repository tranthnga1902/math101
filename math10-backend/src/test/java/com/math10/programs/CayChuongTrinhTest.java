package com.math10.programs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;

/**
 * Cây chương trình: {@code courses → chapters → lessons → exercise_types}, cộng luồng nội dung
 * treo ở bài.
 *
 * <p>Kế hoạch ghi lát này là "không có việc riêng" vì bốn bảng đều đã tồn tại và ràng buộc thứ tự
 * đã làm ở Lát 1. Bảng tồn tại không phải là cây chạy đúng. Hai câu hỏi mà một cái cây phải trả
 * lời được, và hôm nay nó trả lời sai cả hai:
 *
 * <p><b>Cắt một cành thì lá có rụng theo không.</b> Xoá mềm chỉ đóng dấu lên đúng dòng bị xoá.
 * Các bài của chương vừa xoá vẫn còn {@code deleted_at} rỗng, nên chúng vẫn sống trên mọi đường
 * đọc hỏi thẳng bài: dạng bài, luồng nội dung, tài liệu của bài, và
 * {@code /api/public/lessons/{code}} — đường này {@code permitAll}, tức là ra tới người chưa đăng
 * nhập. Trên màn hình quản trị thì chương đã biến mất, nên không ai còn lối nào để tìm ra mấy bài
 * ấy mà dọn: đúng dạng Đ3, dữ liệu sai và vô hình.
 *
 * <p><b>Sắp xếp lại có ở trong một cành không.</b> {@code reorder} nhận một danh sách id trần,
 * không kèm cha, và đánh số 1..n cho đúng những id nhận được. Trộn id của hai chương trình vào một
 * lượt thì cả hai cây bị đánh số lại lẫn lộn mà không có lỗi nào bật lên. Gửi thiếu một id thì
 * đụng chỉ mục duy nhất và bật lên 500 "Hệ thống đang gặp lỗi" — người dùng không có cách nào biết
 * là mình gửi thiếu. Chỗ làm đúng đã có sẵn trong repo để soi: reorder của
 * {@code program_resources} ràng mọi câu lệnh {@code update} theo {@code lesson_id}.
 *
 * <p>Mỗi phép thử dựng cành riêng của nó. Xoá là phép huỷ, nên dùng chung dữ liệu giữa các ca sẽ
 * biến thứ tự chạy thành một phần của kết quả.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Cây chương trình: cắt một cành thì rụng cả cành")
class CayChuongTrinhTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;

    private final ObjectMapper json = new ObjectMapper();
    private final AtomicInteger dem = new AtomicInteger();
    private long quanTri;

    @BeforeAll
    void dungDuLieu() {
        // Người thật, không phải id bịa: xoá chương trình có ghi nhật ký, mà audit_logs.actor_user_id
        // là khoá ngoại sang users — id không có thật thì cả lượt gọi bật lên 500.
        quanTri = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values ('quantri@caychuongtrinh.test', 'khong-dung-toi', 'Quản trị', 'qt-cay', 'ADMIN', 'ACTIVE', now(), now())
                returning id""", Long.class);
    }

    @Nested
    @DisplayName("Cành đã cắt")
    class CanhDaCat {

        @Test
        @DisplayName("xoá chương thì bài của nó không còn ra đường công khai")
        void xoaChuongThiBaiKhongConRaDuongCong() throws Exception {
            Canh canh = moCanh("cong");
            assertThat(trangThaiCong(canh.maCong())).as("trước khi xoá thì bài phải ra được").isEqualTo(200);

            xoa("/api/chapters/" + canh.chuong());

            assertThat(trangThaiCong(canh.maCong()))
                    .as("đường này permitAll: bài của chương đã xoá lọt ra tới người chưa đăng nhập")
                    .isEqualTo(404);
        }

        @Test
        @DisplayName("xoá chương thì dạng bài của bài không còn hiện")
        void xoaChuongThiDangBaiKhongConHien() throws Exception {
            Canh canh = moCanh("dangbai");
            assertThat(than(goi(HttpMethod.GET, "/api/lessons/" + canh.bai() + "/exercise-types", null)))
                    .contains("Dạng bài mẫu");

            xoa("/api/chapters/" + canh.chuong());

            MvcResult ketQua = goi(HttpMethod.GET, "/api/lessons/" + canh.bai() + "/exercise-types", null);
            assertThat(ketQua.getResponse().getStatus())
                    .as("bài đã theo chương ra đi thì không còn là bài nữa: %s", than(ketQua))
                    .isEqualTo(404);
        }

        @Test
        @DisplayName("xoá chương thì luồng nội dung của bài không còn phát")
        void xoaChuongThiLuongNoiDungKhongConPhat() throws Exception {
            Canh canh = moCanh("luong-chuong");
            assertThat(soMuc(canh.bai())).as("trước khi xoá thì mục phải phát").isEqualTo(1);

            xoa("/api/chapters/" + canh.chuong());

            assertThat(soMuc(canh.bai())).as("luồng nội dung không hề hỏi bài còn sống không").isZero();
        }

        @Test
        @DisplayName("xoá bài thì luồng nội dung của chính nó không còn phát")
        void xoaBaiThiLuongNoiDungKhongConPhat() throws Exception {
            Canh canh = moCanh("luong-bai");

            xoa("/api/lessons/" + canh.bai());

            assertThat(soMuc(canh.bai())).isZero();
        }

        @Test
        @DisplayName("xoá chương trình thì cả cây rụng")
        void xoaChuongTrinhThiCaCayRung() throws Exception {
            Canh canh = moCanh("ca-cay");

            xoa("/api/courses/" + canh.chuongTrinh());

            assertThat(than(goi(HttpMethod.GET, "/api/chapters?courseId=" + canh.chuongTrinh(), null)))
                    .as("chương phải rụng theo chương trình")
                    .doesNotContain("Chương của cành ca-cay");
            assertThat(trangThaiCong(canh.maCong())).as("bài phải rụng theo").isEqualTo(404);
            assertThat(soMuc(canh.bai())).as("luồng nội dung phải rụng theo").isZero();
        }

        /**
         * Chốt chặn ngược chiều. Bốn ca trên đòi dấu xoá lan xuống; ca này đòi nó dừng đúng chỗ.
         * Thiếu nó thì "xoá cả bảng" cũng làm chúng xanh hết.
         */
        @Test
        @DisplayName("xoá một bài không đụng tới bài bên cạnh")
        void xoaMotBaiKhongDungToiBaiBenCanh() throws Exception {
            Canh canh = moCanh("hang-xom");
            long baiKhac = themBai(canh.chuong(), 2, "Bài hàng xóm", "hang-xom-2-" + dem.incrementAndGet());
            long mucKhac = themMuc(baiKhac, "Mục của hàng xóm");

            xoa("/api/lessons/" + canh.bai());

            assertThat(soMuc(baiKhac)).as("mục %d của bài bên cạnh phải còn nguyên", mucKhac).isEqualTo(1);
            assertThat(goi(HttpMethod.GET, "/api/lessons/" + baiKhac + "/exercise-types", null)
                    .getResponse().getStatus()).isEqualTo(200);
        }

        @Test
        @DisplayName("xoá một chương không đụng tới chương trình khác")
        void xoaMotChuongKhongDungToiChuongTrinhKhac() throws Exception {
            Canh mot = moCanh("lang-gieng-1");
            Canh hai = moCanh("lang-gieng-2");

            xoa("/api/chapters/" + mot.chuong());

            assertThat(trangThaiCong(hai.maCong())).isEqualTo(200);
            assertThat(soMuc(hai.bai())).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("Sắp xếp lại")
    class SapXepLai {

        @Test
        @DisplayName("sắp xếp chương lẫn id của hai chương trình thì bị từ chối, không cây nào bị đánh số lại")
        void sapXepChuongLanGiuaHaiChuongTrinh() throws Exception {
            Canh mot = moCanh("tron-1");
            Canh hai = moCanh("tron-2");

            MvcResult ketQua = goi(HttpMethod.PATCH, "/api/chapters/reorder",
                    "{\"ids\":[%d,%d]}".formatted(hai.chuong(), mot.chuong()));

            assertThat(ketQua.getResponse().getStatus())
                    .as("trộn hai cây vào một lượt: %s", than(ketQua))
                    .isEqualTo(400);
            assertThat(than(ketQua)).contains("cùng một chương trình");
            assertThat(thuTuChuong(mot.chuong())).as("cây thứ nhất không được xê dịch").isEqualTo(1);
            assertThat(thuTuChuong(hai.chuong())).as("cây thứ hai không được xê dịch").isEqualTo(1);
        }

        @Test
        @DisplayName("sắp xếp chương gửi thiếu id thì từ chối cả lượt và nói rõ là thiếu")
        void sapXepChuongThieuIdThiTuChoiCaLuot() throws Exception {
            Canh canh = moCanh("thieu");
            long chuongHai = themChuong(canh.chuongTrinh(), 2, "Chương thứ hai");

            MvcResult ketQua = goi(HttpMethod.PATCH, "/api/chapters/reorder",
                    "{\"ids\":[%d]}".formatted(chuongHai));

            assertThat(ketQua.getResponse().getStatus())
                    .as("thiếu id phải là câu người dùng đọc được, không phải 500: %s", than(ketQua))
                    .isEqualTo(400);
            assertThat(than(ketQua)).contains("đang thiếu");
            assertThat(thuTuChuong(canh.chuong())).isEqualTo(1);
            assertThat(thuTuChuong(chuongHai)).isEqualTo(2);
        }

        @Test
        @DisplayName("sắp xếp bài lẫn id của hai chương thì bị từ chối")
        void sapXepBaiLanGiuaHaiChuong() throws Exception {
            Canh mot = moCanh("bai-tron-1");
            Canh hai = moCanh("bai-tron-2");

            MvcResult ketQua = goi(HttpMethod.PATCH, "/api/lessons/reorder",
                    "{\"ids\":[%d,%d]}".formatted(hai.bai(), mot.bai()));

            assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(400);
            assertThat(than(ketQua)).contains("cùng một chương");
            assertThat(thuTuBai(mot.bai())).isEqualTo(1);
            assertThat(thuTuBai(hai.bai())).isEqualTo(1);
        }

        /**
         * Chốt chặn ngược chiều cho cả nhóm: từ chối tất cả cũng làm ba ca trên xanh.
         */
        @Test
        @DisplayName("sắp xếp gửi đủ id trong cùng một cha thì đổi đúng thứ tự")
        void sapXepDuIdThiDoiDungThuTu() throws Exception {
            Canh canh = moCanh("du");
            long chuongHai = themChuong(canh.chuongTrinh(), 2, "Chương sẽ lên đầu");

            MvcResult ketQua = goi(HttpMethod.PATCH, "/api/chapters/reorder",
                    "{\"ids\":[%d,%d]}".formatted(chuongHai, canh.chuong()));

            assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(200);
            assertThat(thuTuChuong(chuongHai)).isEqualTo(1);
            assertThat(thuTuChuong(canh.chuong())).isEqualTo(2);
        }
    }

    // ---- dựng cành ----

    /** Một cành đủ tầng: chương trình → chương → bài → dạng bài, cộng một mục luồng nội dung. */
    private record Canh(long chuongTrinh, long chuong, long bai, long maCongSo, String maCong) {}

    private Canh moCanh(String ten) {
        int so = dem.incrementAndGet();
        long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values (?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, "CAY-" + so, "Chương trình của cành " + ten);
        long chuong = themChuong(chuongTrinh, 1, "Chương của cành " + ten);
        String maCong = "cay-" + ten + "-" + so;
        long bai = themBai(chuong, 1, "Bài của cành " + ten, maCong);
        jdbc.update("""
                insert into exercise_types (lesson_id, name, order_index, status, created_at, updated_at)
                values (?, 'Dạng bài mẫu', 1, 'PUBLISHED', now(), now())""", bai);
        themMuc(bai, "Mục của cành " + ten);
        return new Canh(chuongTrinh, chuong, bai, so, maCong);
    }

    private long themChuong(long chuongTrinh, int thuTu, String ten) {
        return jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh, ten, thuTu);
    }

    private long themBai(long chuong, int thuTu, String ten, String maCong) {
        return jdbc.queryForObject("""
                insert into lessons (chapter_id, title, public_code, order_index, status, created_at, updated_at)
                values (?, ?, ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong, ten, maCong, thuTu);
    }

    private long themMuc(long bai, String tieuDe) {
        Long taiLieu = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, created_at, updated_at)
                values (?, 'KHBD', 'STUDENT_ALLOWED', '', 'PUBLISHED', now(), now())
                returning id""", Long.class, tieuDe);
        return jdbc.queryForObject("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, created_at, updated_at)
                values (?, 'DOCUMENT', ?, ?, 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, bai, taiLieu, tieuDe);
    }

    // ---- hỏi hệ thống ----

    private int soMuc(long bai) throws Exception {
        MvcResult ketQua = goi(HttpMethod.GET, "/api/lessons/" + bai + "/program-resources", null);
        assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(200);
        return json.readTree(than(ketQua)).get("data").size();
    }

    private int trangThaiCong(String maCong) throws Exception {
        return mockMvc.perform(MockMvcRequestBuilders.get("/api/public/lessons/" + maCong))
                .andReturn().getResponse().getStatus();
    }

    private void xoa(String duongDan) throws Exception {
        MvcResult ketQua = goi(HttpMethod.DELETE, duongDan, null);
        assertThat(ketQua.getResponse().getStatus()).as("xoá %s → %s", duongDan, than(ketQua)).isEqualTo(200);
    }

    private Integer thuTuChuong(long chuong) {
        return jdbc.queryForObject("select order_index from chapters where id = ?", Integer.class, chuong);
    }

    private Integer thuTuBai(long bai) {
        return jdbc.queryForObject("select order_index from lessons where id = ?", Integer.class, bai);
    }

    private MvcResult goi(HttpMethod cach, String duongDan, String than) throws Exception {
        var yeuCau = MockMvcRequestBuilders.request(cach, duongDan)
                .with(authentication(danhTinh()))
                .contentType(MediaType.APPLICATION_JSON);
        if (than != null) yeuCau = yeuCau.content(than);
        return mockMvc.perform(yeuCau).andReturn();
    }

    private String than(MvcResult ketQua) throws Exception {
        return ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private Authentication danhTinh() {
        Math10Principal principal = new Math10Principal(quanTri, "quantri@caychuongtrinh.test", "ADMIN");
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }
}
