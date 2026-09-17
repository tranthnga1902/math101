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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * Luồng nội dung phải trả lời <em>hai</em> câu hỏi rời nhau về mỗi mục: đi tới bài nào, và ai đọc
 * được. Trước lát này nó chỉ trả lời câu đầu.
 *
 * <p>{@code program_resources} không có cột đối tượng, và luật phát của nó chỉ hỏi <em>trạng thái</em>
 * của thứ được trỏ tới. Nên một tài liệu đánh dấu chỉ-giáo-viên mà đã xuất bản — đáp án, hướng dẫn
 * chấm, barem — gắn vào bài là ra thẳng tới mọi học sinh đã đăng nhập, qua cả hai cửa đọc. Đường
 * {@code lesson_documents} thì lại có lọc đối tượng. Hai cơ chế trả lời khác nhau về cùng một câu
 * hỏi, và cái không lọc là cái học sinh gọi được.
 *
 * <p>Bốn phép thử đầu đi qua <em>đường ghi thật</em> chứ không chèn thẳng SQL: chuyện cần canh là
 * admin gắn một tài liệu đáp án vào bài thì học sinh có thấy không, mà quãng đường ấy gồm cả việc
 * dòng phân phối lấy đối tượng ở đâu ra. Chèn tay là tự trả lời hộ nó nửa câu.
 *
 * <p>Hai phép cuối canh cái trục vừa tách ra: thu hẹp được, nới rộng thì không. Đánh dấu ở tài liệu
 * gốc là trần, không phải gợi ý — muốn phát đáp án ra cho học sinh thì sửa chính tài liệu ấy, một
 * việc có nhật ký, chứ không lách qua một dòng gắn.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Phân phối theo đối tượng")
class PhanPhoiTheoDoiTuongTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long chuongTrinh;
    private long bai;
    private long baiKiemTra;
    private long dapAn;
    private long tomTat;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-DOITUONG', 'Toán 10 thử đối tượng', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 3 - Hệ thức lượng trong tam giác', 3, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        bai = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Bài 1 - Định lí cosin và định lí sin', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);
        baiKiemTra = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Ôn tập chương 3 - kiểm tra 45 phút', 2, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);

        dapAn = taiLieu("Đáp án và hướng dẫn chấm chương 3", "TEACHER_ONLY");
        tomTat = taiLieu("Tóm tắt hệ thức lượng trong tam giác", "STUDENT_ALLOWED");
    }

    @Test
    @DisplayName("Học sinh không thấy đáp án admin gắn vào bài")
    void hocSinhKhongThayDapAnGanVaoBai() throws Exception {
        gan(bai, dapAn, "Đáp án và hướng dẫn chấm chương 3", 1, null);

        String than = goi("/api/lessons/" + bai + "/program-resources", hocSinh(9101L, "an"));

        assertThat(than).as("đáp án không được lọt vào luồng nội dung của học sinh: %s", than)
                .doesNotContain("Đáp án và hướng dẫn chấm");
    }

    @Test
    @DisplayName("Học sinh không thấy đáp án trên đường chương trình")
    void hocSinhKhongThayDapAnTrenDuongChuongTrinh() throws Exception {
        gan(bai, dapAn, "Đáp án và hướng dẫn chấm chương 3", 1, null);

        String than = goi("/api/programs/" + chuongTrinh + "/resources", hocSinh(9102L, "binh"));

        assertThat(than).as("cửa thứ hai phải trả lời giống cửa thứ nhất: %s", than)
                .doesNotContain("Đáp án và hướng dẫn chấm");
    }

    @Test
    @DisplayName("Giáo viên vẫn thấy đáp án")
    void giaoVienVanThayDapAn() throws Exception {
        gan(bai, dapAn, "Đáp án và hướng dẫn chấm chương 3", 1, null);

        String than = goi("/api/lessons/" + bai + "/program-resources", giaoVien(9103L));

        assertThat(than).as("lọc theo người đọc, không phải gỡ mục đi: %s", than)
                .contains("Đáp án và hướng dẫn chấm");
    }

    @Test
    @DisplayName("Học sinh vẫn thấy tài liệu dành cho mình")
    void hocSinhVanThayTaiLieuDanhChoMinh() throws Exception {
        gan(bai, tomTat, "Tóm tắt hệ thức lượng trong tam giác", 2, null);

        Authentication ai = hocSinh(9104L, "cuong");
        assertThat(goi("/api/lessons/" + bai + "/program-resources", ai)).contains("Tóm tắt hệ thức lượng");
        assertThat(goi("/api/programs/" + chuongTrinh + "/resources", ai)).contains("Tóm tắt hệ thức lượng");
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    @DisplayName("Gắn qua cửa sổ tài liệu bài học cập nhật luồng chương trình và trả đường mở có xác thực")
    void ganQuaTaiLieuBaiHoc() throws Exception {
        long doc = taiLieu("Tài liệu từ cửa sổ bài học", "STUDENT_ALLOWED");
        jdbc.update("update documents set file_url='https://example.test/attachment.pdf' where id=?", doc);
        var response = mockMvc.perform(post("/api/lessons/"+bai+"/documents")
                .with(authentication(quanTri(9100L))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"documentId\":"+doc+",\"required\":true,\"startPage\":6}"))
                .andReturn().getResponse();
        assertThat(response.getStatus()).as(response.getContentAsString()).isEqualTo(200);
        String program = goi("/api/programs/"+chuongTrinh+"/resources", quanTri(9100L));
        long resource=jdbc.queryForObject("select id from program_resources where resource_type='DOCUMENT' and resource_ref_id=? and deleted_at is null",Long.class,doc);
        assertThat(program).contains("Tài liệu từ cửa sổ bài học", "/api/program-resources/"+resource+"/content.pdf")
                .doesNotContain("https://example.test/attachment.pdf");
        var duplicate = mockMvc.perform(post("/api/lessons/"+bai+"/documents")
                .with(authentication(quanTri(9100L))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"documentId\":"+doc+",\"required\":true}"))
                .andReturn().getResponse();
        assertThat(duplicate.getStatus()).isEqualTo(400);
    }

    @Test
    @DisplayName("Thu hẹp được đối tượng của riêng một dòng gắn")
    void thuHepDuocDoiTuongCuaMotDongGan() throws Exception {
        // Cùng một tài liệu, hai chỗ, hai đối tượng — không cần nhân bản tệp. Ở tiết kiểm tra thì
        // bản tóm tắt là tài liệu của giáo viên, dù chính nó vẫn mở cho học sinh ở bài thường.
        gan(baiKiemTra, tomTat, "Tóm tắt hệ thức lượng trong tam giác", 1, "TEACHER_ONLY");

        assertThat(goi("/api/lessons/" + baiKiemTra + "/program-resources", hocSinh(9105L, "dung")))
                .doesNotContain("Tóm tắt hệ thức lượng");
        assertThat(goi("/api/lessons/" + baiKiemTra + "/program-resources", giaoVien(9106L)))
                .contains("Tóm tắt hệ thức lượng");
    }

    @Test
    @DisplayName("Không nới rộng được quyền so với tài liệu gốc")
    void khongNoiRongDuocQuyenSoVoiTaiLieuGoc() throws Exception {
        var phanHoi = mockMvc.perform(post("/api/admin/lessons/" + baiKiemTra + "/resources")
                        .with(authentication(quanTri(9107L)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"resourceType":"DOCUMENT","resourceRefId":%d,"title":"Đáp án phát cho học sinh",
                                 "orderIndex":9,"status":"PUBLISHED","audience":"STUDENT_ALLOWED"}"""
                                .formatted(dapAn)))
                .andReturn().getResponse();
        String than = phanHoi.getContentAsString(StandardCharsets.UTF_8);

        assertThat(phanHoi.getStatus()).as("từ chối bằng lỗi nghiệp vụ đọc được: %s", than).isEqualTo(400);
        assertThat(than).as("câu từ chối phải nói ra lý do: %s", than).contains("chỉ dành cho giáo viên");
    }

    @Test
    @DisplayName("Không nới rộng được quyền bằng đường sửa dòng gắn")
    void khongNoiRongDuocQuyenBangDuongSua() throws Exception {
        // Trần chặn ở lúc gắn thì người ta gắn hẹp rồi sửa rộng. Hai đường cùng ghi vào một cột nên
        // phải cùng một trần: bịt một đường mà để hở đường kia thì coi như chưa bịt, mà lại tưởng
        // là đã bịt — hình dạng tệp hơn cả không bịt gì.
        Long dong = jdbc.queryForObject("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience, created_at, updated_at)
                values (?, 'DOCUMENT', ?, 'Đáp án gắn hẹp rồi sửa rộng', 20, 'PUBLISHED', 'TEACHER_ONLY', now(), now())
                returning id""", Long.class, baiKiemTra, dapAn);

        var phanHoi = mockMvc.perform(put("/api/admin/program-resources/" + dong)
                        .with(authentication(quanTri(9108L)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Đáp án gắn hẹp rồi sửa rộng","status":"PUBLISHED","audience":"STUDENT_ALLOWED"}"""))
                .andReturn().getResponse();
        String than = phanHoi.getContentAsString(StandardCharsets.UTF_8);

        assertThat(phanHoi.getStatus()).as("từ chối bằng lỗi nghiệp vụ đọc được: %s", than).isEqualTo(400);
        assertThat(than).as("câu từ chối phải nói ra lý do: %s", than).contains("chỉ dành cho giáo viên");
        assertThat(goi("/api/lessons/" + baiKiemTra + "/program-resources", hocSinh(9109L, "giang")))
                .as("từ chối mà cột vẫn đổi thì lời từ chối chỉ là lời")
                .doesNotContain("gắn hẹp rồi sửa rộng");
    }

    @Test
    @DisplayName("Sửa được tên và trạng thái của dòng gắn")
    void suaDuocTenVaTrangThaiCuaDongGan() throws Exception {
        Long dong = jdbc.queryForObject("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience, created_at, updated_at)
                values (?, 'DOCUMENT', ?, 'Ten cu can sua', 21, 'DRAFT', 'STUDENT_ALLOWED', now(), now())
                returning id""", Long.class, bai, tomTat);

        mockMvc.perform(put("/api/admin/program-resources/" + dong)
                        .with(authentication(quanTri(9110L)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"title":"Ten moi da sua","status":"PUBLISHED","audience":"STUDENT_ALLOWED"}"""))
                .andReturn();

        String man = goi("/api/lessons/" + bai + "/program-resources", hocSinh(9111L, "hoa"));
        assertThat(man).as("sửa tên mà màn hình không đổi thì nút sửa chỉ là nút").contains("Ten moi da sua");
        assertThat(man).as("xuất bản rồi thì phải ra khỏi ngăn nháp").doesNotContain("Ten cu can sua");
    }

    // ==================== dựng dữ liệu ====================

    private long taiLieu(String ten, String doiTuong) {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, created_at, updated_at)
                values (?, 'KHBD', ?::varchar, '', 'PUBLISHED', now(), now())
                returning id""", Long.class, ten, doiTuong);
    }

    /** Gắn qua đúng đường admin dùng thật; {@code doiTuong} rỗng nghĩa là để hệ thống tự suy. */
    private void gan(long baiHoc, long taiLieu, String ten, int thuTu, String doiTuong) throws Exception {
        jdbc.update("delete from program_resources where lesson_id=? and resource_ref_id=?", baiHoc, taiLieu);
        String than = """
                {"resourceType":"DOCUMENT","resourceRefId":%d,"title":"%s","orderIndex":%d,"status":"PUBLISHED"%s}"""
                .formatted(taiLieu, ten, thuTu, doiTuong == null ? "" : ",\"audience\":\"" + doiTuong + "\"");
        var phanHoi = mockMvc.perform(post("/api/admin/lessons/" + baiHoc + "/resources")
                        .with(authentication(quanTri(9100L)))
                        .contentType(MediaType.APPLICATION_JSON).content(than))
                .andReturn().getResponse();
        assertThat(phanHoi.getStatus())
                .as("gắn vào bài %d → %s", baiHoc, phanHoi.getContentAsString(StandardCharsets.UTF_8))
                .isEqualTo(200);
    }

    private String goi(String duongDan, Authentication ai) throws Exception {
        var phanHoi = mockMvc.perform(get(duongDan).with(authentication(ai)).contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET %s → %s", duongDan, noiDung).isEqualTo(200);
        return noiDung;
    }

    private Authentication hocSinh(long id, String ten) {
        return ai(new Math10Principal(id, ten + "@doituong.test", "STUDENT"), "ROLE_STUDENT");
    }

    private Authentication giaoVien(long id) {
        return ai(new Math10Principal(id, "gv" + id + "@doituong.test", "TEACHER"), "ROLE_TEACHER");
    }

    private Authentication quanTri(long id) {
        return ai(new Math10Principal(id, "qt" + id + "@doituong.test", "ADMIN"), "ROLE_ADMIN");
    }

    private Authentication ai(Math10Principal principal, String quyen) {
        return new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority(quyen)));
    }
}
