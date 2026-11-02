package com.math10.classes.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Cấu trúc chương trình học và tài liệu khóa học của lớp")
class ClassProgramCurriculumTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private final AtomicInteger dem = new AtomicInteger();

    private long lopA;
    private long gvA;
    private long emA;
    private long emNgoaiLop;
    private long chuong1;
    private long bai1;

    @BeforeAll
    void setup() {
        Long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-PROG-CURR', 'Toán 10 Chương Trình Chuẩn', 'PUBLISHED', now(), now())
                returning id""", Long.class);

        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu chuẩn Toán 10', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);

        Long khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, course_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, ?, 'Khóa 10A (2026-2027)', '2026-2027', '2026-08-01'::date, '2027-05-31'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau, chuongTrinh);

        chuong1 = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương I: Mệnh đề và tập hợp', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);

        bai1 = jdbc.queryForObject("""
                insert into lessons (course_id, chapter_id, title, order_index, total_periods, status, created_at, updated_at)
                values (?, ?, 'Bài 1: Mệnh đề', 1, 2, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh, chuong1);

        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        lopA = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values ('L10A-CURR', 'Lớp 10A Chuyên Toán', ?, 'ACTIVE', now(), now())
                returning id""", Long.class, khoi);

        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())", lopA, khoa);

        gvA = taoNguoiDung("TEACHER", "Thầy Hoàng dạy 10A");
        emA = taoNguoiDung("STUDENT", "Học sinh Nam lớp 10A");
        emNgoaiLop = taoNguoiDung("STUDENT", "Học sinh ngoài lớp");

        jdbc.update("insert into class_teachers (class_id, teacher_id, created_at, updated_at) values (?,?,now(),now())", lopA, gvA);
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())", lopA, emA);

        // Tạo tài liệu cho học sinh (SGK)
        Long docSgk = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, content_group, program_id, lesson_id, created_at, updated_at)
                values ('SGK Toán 10 - Bài 1', 'SGK', 'STUDENT_ALLOWED', 'https://example.com/sgk10.pdf', 'PUBLISHED', 'THEORY', ?, ?, now(), now())
                returning id""", Long.class, chuongTrinh, bai1);

        // Tạo tài liệu chỉ dành cho giáo viên (Giáo án KHBD)
        Long docKhbd = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, content_group, program_id, lesson_id, created_at, updated_at)
                values ('Kế hoạch bài dạy Bài 1', 'KHBD', 'TEACHER_ONLY', 'https://example.com/khbd10.pdf', 'PUBLISHED', 'REFERENCE', ?, ?, now(), now())
                returning id""", Long.class, chuongTrinh, bai1);

        // Gắn vào lesson_documents
        jdbc.update("""
                insert into lesson_documents (lesson_id, document_id, is_required, teacher_note, start_page, display_order, created_at, updated_at)
                values (?, ?, true, 'Đọc trang 5-8', 5, 1, now(), now())""", bai1, docSgk);

        jdbc.update("""
                insert into lesson_documents (lesson_id, document_id, is_required, teacher_note, start_page, display_order, created_at, updated_at)
                values (?, ?, false, 'Giáo án tham khảo', 1, 2, now(), now())""", bai1, docKhbd);
    }

    @Test
    @DisplayName("Giáo viên xem đủ cây chương trình và tài liệu của từng bài học (kể cả TEACHER_ONLY)")
    void giaoVienXemDuCacChuongBaiVaTaiLieu() throws Exception {
        JsonNode data = duLieu(goi("/api/classes/" + lopA + "/program-curriculum", gvA, "TEACHER"));

        assertThat(data.get("courses")).isNotEmpty();
        JsonNode course = data.get("courses").get(0);
        assertThat(course.get("program_name").asText()).isEqualTo("Toán 10 Chương Trình Chuẩn");
        assertThat(course.get("totalChapters").asInt()).isGreaterThanOrEqualTo(1);

        JsonNode chapters = course.get("chapters");
        assertThat(chapters).isNotEmpty();
        JsonNode chapter1 = chapters.get(0);
        assertThat(chapter1.get("title").asText()).isEqualTo("Chương I: Mệnh đề và tập hợp");

        JsonNode lessons = chapter1.get("lessons");
        assertThat(lessons).isNotEmpty();
        JsonNode lesson1 = lessons.get(0);
        assertThat(lesson1.get("title").asText()).isEqualTo("Bài 1: Mệnh đề");

        JsonNode docs = lesson1.get("documents");
        assertThat(docs).hasSize(2);
        List<String> docTitles = docs.findValuesAsText("title");
        assertThat(docTitles).contains("SGK Toán 10 - Bài 1", "Kế hoạch bài dạy Bài 1");
    }

    @Test
    @DisplayName("Học sinh chỉ thấy tài liệu STUDENT_ALLOWED, không thấy tài liệu TEACHER_ONLY")
    void hocSinhChiThayTaiLieuChoHocSinh() throws Exception {
        JsonNode data = duLieu(goi("/api/classes/" + lopA + "/program-curriculum", emA, "STUDENT"));

        JsonNode course = data.get("courses").get(0);
        JsonNode lesson1 = course.get("chapters").get(0).get("lessons").get(0);
        JsonNode docs = lesson1.get("documents");

        assertThat(docs).hasSize(1);
        assertThat(docs.get(0).get("title").asText()).isEqualTo("SGK Toán 10 - Bài 1");
        assertThat(docs.get(0).get("audience").asText()).isEqualTo("STUDENT_ALLOWED");
    }

    @Test
    @DisplayName("Người dùng ngoài lớp bị chặn 403 Forbidden")
    void nguoiNgoaiLopBiChan() throws Exception {
        var yeuCau = request(HttpMethod.GET, "/api/classes/" + lopA + "/program-curriculum")
                .with(authentication(nguoiDung(emNgoaiLop, "STUDENT")));
        mockMvc.perform(yeuCau)
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isForbidden());
    }

    // --- Helpers ---

    private long taoNguoiDung(String vai, String ten) {
        int i = dem.incrementAndGet();
        Long id = jdbc.queryForObject("""
                insert into users (role_code, username, password_hash, full_name, email, status, created_at, updated_at)
                values (?, ?, 'hash', ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, vai, "user_prog_curr_" + i, ten, "user_prog_curr_" + i + "@test.com");
        return id;
    }

    private Authentication nguoiDung(long id, String vai) {
        Math10Principal principal = new Math10Principal(id, "u_" + id + "@test.com", vai);
        return new UsernamePasswordAuthenticationToken(principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }

    private String goi(String url, long id, String vai) throws Exception {
        var yeuCau = request(HttpMethod.GET, url).with(authentication(nguoiDung(id, vai)));
        return mockMvc.perform(yeuCau)
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                .andReturn().getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private JsonNode duLieu(String than) throws Exception {
        JsonNode root = json.readTree(than);
        assertThat(root.get("success").asBoolean()).isTrue();
        return root.get("data");
    }
}
