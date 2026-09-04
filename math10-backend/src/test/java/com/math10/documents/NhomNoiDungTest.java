package com.math10.documents;

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
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Nhóm nội dung phải là nhãn do người đặt, không phải nhãn máy dán sẵn.
 *
 * <p>Cột {@code content_group} ra đời với {@code not null default 'REFERENCE'} trong khi không có
 * một đường ghi nào — entity không ánh xạ nó, không câu SQL nào đụng tới nó. Kết quả là mọi tài
 * liệu trong kho đều mang nhãn "Tham khảo" mà không ai chọn, và nhãn bịa ấy trông y hệt nhãn thật.
 * Bộ lọc dựa trên nó sẽ nói dối một cách rất tự tin.
 *
 * <p>Có một dòng trong bản vá mà bộ phép thử này <b>không</b> canh được và cần nói thẳng:
 * {@code update documents set content_group = null where content_group = 'REFERENCE'} chỉ chạm vào
 * dữ liệu có sẵn từ trước. Ở đây CSDL dựng mới từ số không nên không có dòng cũ nào để dọn; xoá
 * dòng lệnh đó đi thì mọi phép thử dưới đây vẫn xanh. Nó chỉ được chứng minh khi chạy trên CSDL đã
 * có dữ liệu — mất mát này ghi ra để người sau biết, không lấp bằng một phép thử giả vờ.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Nhóm nội dung của tài liệu")
class NhomNoiDungTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long chuongTrinh;
    /**
     * Người quản trị phải là một dòng thật trong {@code users}, không phải một mã bịa. Đường ghi
     * video có ghi nhật ký, mà {@code audit_logs.actor_user_id} là khoá ngoại — một danh tính không
     * có dòng tương ứng sẽ làm cả lượt gọi hỏng bằng lỗi 500 chẳng liên quan gì tới nhóm nội dung.
     */
    private long quanTriId;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-NHOM-ND', 'Toán 10 nhóm nội dung', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        quanTriId = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values ('quantri@nhomnoidung.test', 'khong-dung-toi', 'Quản trị nhóm nội dung',
                        'qt-nhom-noi-dung', 'ADMIN', 'ACTIVE', now(), now())
                returning id""", Long.class);
    }

    @Test
    @DisplayName("Tài liệu không ai phân loại thì để trống, không tự nhận là Tham khảo")
    void taiLieuChuaPhanLoaiThiDeTrong() throws Exception {
        long id = themTaiLieu("Sách giáo khoa Toán 10 - Cánh Diều");

        // Đọc thẳng CSDL trước: nếu cột còn `default 'REFERENCE'` thì dòng vừa chèn đã mang nhãn
        // ngay tại đây, trước khi API kịp nói gì.
        assertThat(jdbc.queryForObject("select content_group from documents where id = ?", String.class, id))
                .as("chèn tài liệu mà không nêu nhóm thì nhóm phải trống")
                .isNull();

        Map<String, Object> tren = timTrongDanhSach(id);
        assertThat(tren.get("contentGroup")).as("API cũng phải nói là trống: %s", tren).isNull();
    }

    @Test
    @DisplayName("Bộ đếm xếp tài liệu chưa phân loại vào ô riêng, không cộng vào Tham khảo")
    void boDemKhongDonTaiLieuChuaPhanLoaiVaoThamKhao() throws Exception {
        long truocChuaPhanLoai = chuaPhanLoai();
        long truocThamKhao = theoNhom("REFERENCE");

        long id = themTaiLieu("Đề cương ôn tập chương 1");

        assertThat(chuaPhanLoai()).as("tài liệu mới phải rơi vào ô chưa phân loại").isEqualTo(truocChuaPhanLoai + 1);
        assertThat(theoNhom("REFERENCE")).as("và tuyệt đối không được đếm là Tham khảo").isEqualTo(truocThamKhao);

        // Phân loại xong thì nó rời ô "chưa phân loại" — bộ đếm và danh sách nói cùng một chuyện.
        phanLoai(id, "\"REFERENCE\"");
        assertThat(chuaPhanLoai()).isEqualTo(truocChuaPhanLoai);
        assertThat(theoNhom("REFERENCE")).isEqualTo(truocThamKhao + 1);
    }

    @Test
    @DisplayName("Admin phân loại được rồi gỡ được, gỡ xong lại là chưa phân loại")
    void phanLoaiRoiGoDuoc() throws Exception {
        long id = themTaiLieu("Bài giảng hàm số bậc hai");

        phanLoai(id, "\"THEORY\"");
        assertThat(timTrongDanhSach(id).get("contentGroup")).isEqualTo("THEORY");

        phanLoai(id, "null");
        assertThat(timTrongDanhSach(id).get("contentGroup")).as("gỡ phân loại là về trống, không về mặc định").isNull();
    }

    @Test
    @DisplayName("Giá trị ngoài danh sách bị CSDL từ chối, ở cả bảng tài liệu lẫn bảng video")
    void giaTriNgoaiDanhSachBiTuChoi() {
        long id = themTaiLieu("Tài liệu thử ràng buộc");

        assertThatThrownBy(() -> jdbc.update("update documents set content_group = 'BUA_BAI' where id = ?", id))
                .as("CSDL mới là chốt chặn cuối, không phải tầng ứng dụng")
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThatThrownBy(() -> jdbc.update("""
                insert into videos (title, program_id, content_group, status, created_at, updated_at)
                values ('Video sai nhóm', ?, 'BUA_BAI', 'DRAFT', now(), now())""", chuongTrinh))
                .as("hai bảng dùng chung một danh sách thì phải chặn giống nhau")
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    @DisplayName("Tạo video với nhóm sai nhận lời từ chối đọc được, không phải lỗi 500")
    void videoNhomSaiBiTuChoiRoRang() throws Exception {
        var phanHoi = mockMvc.perform(post("/api/admin/videos").with(authentication(quanTri()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                          {"title":"Video nhóm sai","videoUrl":"https://video.example.com/a.mp4","programId":%d,
                           "contentGroup":"BUA_BAI","status":"DRAFT"}"""
                                .formatted(chuongTrinh)))
                .andReturn().getResponse();

        assertThat(phanHoi.getStatus()).as("sai chính tả là lỗi của người nhập, phải trả 400").isEqualTo(400);
        assertThat(phanHoi.getContentAsString(StandardCharsets.UTF_8)).contains("Nhóm nội dung không hợp lệ");
    }

    @Test
    @DisplayName("Tạo video chưa phân loại thì lưu được, nhóm để trống")
    void videoChuaPhanLoaiLuuDuoc() throws Exception {
        var phanHoi = mockMvc.perform(post("/api/admin/videos").with(authentication(quanTri()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                          {"title":"Video chưa phân loại","videoUrl":"https://video.example.com/b.mp4",
                           "programId":%d,"status":"DRAFT"}""".formatted(chuongTrinh)))
                .andReturn().getResponse();

        // Trước bản vá, cột not null biến "chưa phân loại" thành lỗi CSDL 500.
        assertThat(phanHoi.getStatus()).as("%s", phanHoi.getContentAsString(StandardCharsets.UTF_8)).isEqualTo(200);
        assertThat(jdbc.queryForObject(
                "select content_group from videos where title = 'Video chưa phân loại'", String.class)).isNull();
    }

    private long themTaiLieu(String ten) {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, created_at, updated_at)
                values (?, 'SGK', 'STUDENT_ALLOWED', 'https://files.example.com/x.pdf', now(), now())
                returning id""", Long.class, ten);
    }

    private void phanLoai(long id, String nhomJson) throws Exception {
        var phanHoi = mockMvc.perform(patch("/api/admin/documents/" + id + "/content-group")
                        .with(authentication(quanTri())).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"contentGroup\":" + nhomJson + "}"))
                .andReturn().getResponse();
        assertThat(phanHoi.getStatus()).as("%s", phanHoi.getContentAsString(StandardCharsets.UTF_8)).isEqualTo(200);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> timTrongDanhSach(long id) throws Exception {
        List<Map<String, Object>> rows = (List<Map<String, Object>>) doc(goi("/api/admin/documents")).get("data");
        return rows.stream().filter(row -> ((Number) row.get("id")).longValue() == id).findFirst()
                .orElseThrow(() -> new AssertionError("Không thấy tài liệu " + id + " trong kho chung"));
    }

    private long chuaPhanLoai() throws Exception {
        return ((Number) boDem().get("chuaPhanLoai")).longValue();
    }

    @SuppressWarnings("unchecked")
    private long theoNhom(String nhom) throws Exception {
        return ((Number) ((Map<String, Object>) boDem().get("theoNhom")).get(nhom)).longValue();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> boDem() throws Exception {
        return (Map<String, Object>) doc(goi("/api/admin/documents/content-groups")).get("data");
    }

    private Map<String, Object> doc(String than) throws Exception {
        return new com.fasterxml.jackson.databind.ObjectMapper().readValue(than, Map.class);
    }

    private String goi(String duongDan) throws Exception {
        var phanHoi = mockMvc.perform(get(duongDan).with(authentication(quanTri()))
                .contentType(MediaType.APPLICATION_JSON)).andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET %s → %s", duongDan, noiDung).isEqualTo(200);
        return noiDung;
    }

    private Authentication quanTri() {
        Math10Principal principal = new Math10Principal(quanTriId, "quantri@nhomnoidung.test", "ADMIN");
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }
}
