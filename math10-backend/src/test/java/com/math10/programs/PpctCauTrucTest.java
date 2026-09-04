package com.math10.programs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.configuration.security.Math10Principal;
import com.math10.programs.PpctCauTrucParser.BaiHoc;
import com.math10.programs.PpctCauTrucParser.ChuongVaBai;
import com.math10.programs.support.PhanPhoiChuan;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Tự động sinh cấu trúc chương/bài từ file PPCT.
 *
 * <p>Ca 1 ({@code parserDon}): kiểm parser thuần không cần DB — unit test logic tách chương/bài.
 * Ca 2 ({@code previewTraDanhSach}): upload PDF nhỏ giả → preview trả list ChuongVaBai.
 * Ca 3 ({@code confirmGhiVaDB}): confirm ghi chapters + lessons vào DB đúng.
 * Ca 4 ({@code confirmLanHaiKhongTrung}): confirm lần 2 không tạo thêm chapter/lesson.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Cấu trúc chương/bài từ PPCT")
class PpctCauTrucTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private long program;
    private long quanTri;
    private Authentication admin;

    @BeforeAll
    void setup() {
        quanTri = jdbc.queryForObject(
                "insert into users(username,email,password_hash,full_name,role_code,status,created_at,updated_at) values(?,?,?,?,?,?,now(),now()) returning id",
                Long.class, "ct_admin_" + System.nanoTime(), "ct_admin@ppct-cau-truc.test", "hash", "Quản trị", "ADMIN", "ACTIVE");

        program = jdbc.queryForObject(
                "insert into courses(code,name,status,created_at,updated_at) values(?,?,?,now(),now()) returning id",
                Long.class, "CT_PARSE_" + System.nanoTime(), "Chương trình test parse","DRAFT");

        admin = new UsernamePasswordAuthenticationToken(
                new Math10Principal(quanTri, "ct_admin@ppct-cau-truc.test", "ADMIN"),
                null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }

    // ==================== Ca 1: Parser thuần ====================

    @Test @Order(1)
    @DisplayName("Parser tách 'Tên chương - Tên bài' đúng")
    void parserDon() {
        List<PpctExtractor.HangTho> hang = List.of(
                new PpctExtractor.HangTho(1, 1, "Mệnh đề - Hoạt động khởi động"),
                new PpctExtractor.HangTho(1, 2, "Mệnh đề - Bài 1: Mệnh đề toán học"),
                new PpctExtractor.HangTho(2, 3, "Mệnh đề - Bài 1: Mệnh đề toán học"), // tiết 2 cùng bài
                new PpctExtractor.HangTho(2, 1, "Tam giác - Bài 1"),
                new PpctExtractor.HangTho(3, 2, "Tam giác - Bài 2")
        );
        List<String> maMach = List.of("DAI_SO","DAI_SO","DAI_SO","HINH_HOC","HINH_HOC");

        List<ChuongVaBai> ket = PpctCauTrucParser.phanTich(hang, maMach);

        assertThat(ket).hasSize(2).as("hai chương");
        ChuongVaBai menhDe = ket.get(0);
        assertThat(menhDe.tenChuong()).isEqualTo("Mệnh đề");
        assertThat(menhDe.bai()).hasSize(2).as("'Hoạt động khởi động' và 'Bài 1' riêng biệt");
        BaiHoc bai1 = menhDe.bai().get(1); // Bài 1 xuất hiện 2 tiết
        assertThat(bai1.soTiet()).isEqualTo(2).as("hai tiết cùng bài gộp lại");

        ChuongVaBai tamGiac = ket.get(1);
        assertThat(tamGiac.tenChuong()).isEqualTo("Tam giác");
        assertThat(tamGiac.bai()).hasSize(2);
    }

    // ==================== Ca 2: Preview không ghi DB ====================

    @Test @Order(2)
    @DisplayName("Preview PDF giả → danh sách chương/bài, không ghi DB")
    void previewTraDanhSach() throws Exception {
        // PDF giả rỗng → extractor trả list rỗng → preview trả list rỗng với message
        byte[] pdfGia = new byte[]{};
        MockMultipartFile file = new MockMultipartFile("file", "test.pdf", "application/pdf", pdfGia);

        MvcResult res = mockMvc.perform(multipart("/api/admin/programs/" + program + "/cau-truc/preview")
                        .file(file).with(authentication(admin)))
                .andExpect(status().isOk())
                .andReturn();

        String body = res.getResponse().getContentAsString(StandardCharsets.UTF_8);
        // PDF rỗng → list rỗng → trả 200 với message phù hợp
        assertThat(body).contains("success");
        // DB không có chapter nào được tạo
        long count = jdbc.queryForObject(
                "select count(*) from chapters where course_id=?", Long.class, program);
        assertThat(count).isZero().as("preview không ghi DB");
    }

    // ==================== Ca 3: Confirm ghi DB ====================

    @Test @Order(3)
    @DisplayName("Confirm tạo chapters + lessons trong DB")
    void confirmGhiVaDB() throws Exception {
        List<ChuongVaBai> input = List.of(
                new ChuongVaBai("Mệnh đề", 1, List.of(
                        new BaiHoc("Hoạt động khởi động", 1, 1, 1, "DAI_SO"),
                        new BaiHoc("Bài 1: Mệnh đề toán học", 2, 1, 2, "DAI_SO")
                )),
                new ChuongVaBai("Tam giác", 2, List.of(
                        new BaiHoc("Bài 1", 1, 2, 2, "HINH_HOC")
                ))
        );

        MvcResult res = mockMvc.perform(post("/api/admin/programs/" + program + "/cau-truc/confirm")
                        .with(authentication(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andReturn();

        String body = res.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(body).contains("soTaoMoiChuong").contains("soTaoMoiBai");

        long soChapter = jdbc.queryForObject(
                "select count(*) from chapters where course_id=? and deleted_at is null", Long.class, program);
        assertThat(soChapter).isEqualTo(2).as("tạo đúng 2 chương");

        long soBai = jdbc.queryForObject(
                "select count(*) from lessons where chapter_id in " +
                "(select id from chapters where course_id=? and deleted_at is null) and deleted_at is null",
                Long.class, program);
        assertThat(soBai).isEqualTo(3).as("tổng 3 bài học");

        // Kiểm order_index dương (đã fix về dương)
        long amOI = jdbc.queryForObject(
                "select count(*) from chapters where course_id=? and order_index < 0", Long.class, program);
        assertThat(amOI).isZero().as("order_index phải dương sau confirm");
    }

    // ==================== Ca 4: Confirm lần 2 không trùng ====================

    @Test @Order(4)
    @DisplayName("Confirm lần 2 cùng dữ liệu không tạo thêm chapter/lesson")
    void confirmLanHaiKhongTrung() throws Exception {
        List<ChuongVaBai> input = List.of(
                new ChuongVaBai("Mệnh đề", 1, List.of(
                        new BaiHoc("Hoạt động khởi động", 1, 1, 1, "DAI_SO"),
                        new BaiHoc("Bài 1: Mệnh đề toán học", 2, 1, 2, "DAI_SO")
                )),
                new ChuongVaBai("Tam giác", 2, List.of(
                        new BaiHoc("Bài 1", 1, 2, 2, "HINH_HOC"),
                        new BaiHoc("Bài 2", 2, 3, 2, "HINH_HOC") // bài mới thêm
                ))
        );

        mockMvc.perform(post("/api/admin/programs/" + program + "/cau-truc/confirm")
                        .with(authentication(admin))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(input)))
                .andExpect(status().isOk());

        long soChapter = jdbc.queryForObject(
                "select count(*) from chapters where course_id=? and deleted_at is null", Long.class, program);
        assertThat(soChapter).isEqualTo(2).as("vẫn 2 chương, không tạo trùng");

        long soBai = jdbc.queryForObject(
                "select count(*) from lessons where chapter_id in " +
                "(select id from chapters where course_id=? and deleted_at is null) and deleted_at is null",
                Long.class, program);
        assertThat(soBai).isEqualTo(4).as("thêm 1 bài mới, không trùng 3 cái cũ → tổng 4");
    }
}
