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
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * {@code GET /api/classes/{classId}/hoc-lieu} phải đi qua {@code LuongNoiDung#hocLieuChoBuoi} —
 * không tự suy luận quyền đọc qua {@code class_documents}, và {@code fileUrl} trả ra phải trỏ cửa
 * đã gác bằng {@code moDuocTep()} ({@code /api/files/{id}/download}), không phải cửa cũ
 * {@code /api/documents/{id}/content} (không biết gì về {@code lop_id} hẹp riêng).
 *
 * <p>Ba ca: (1) khoanh đúng buổi qua {@code scheduleId} — DOCUMENT thường trỏ cửa file mới,
 * VIDEO giữ nguyên link ngoài; (2) không truyền {@code scheduleId} thì gộp mọi buổi đã xếp lịch
 * của lớp; (3) người ngoài lớp bị chặn — {@code ClassAccessGuard} đứng trước resolver, không phải
 * sau.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Học liệu của lớp qua resolver LuongNoiDung")
class ClassHocLieuControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private final AtomicInteger dem = new AtomicInteger();

    private long lopA;
    private long emA;
    private long emNgoaiLop;
    private long tiet1;
    private long tiet2;
    private long lichBuoi1;
    private long lichBuoi2;

    private long rTaiLieuBuoi1;
    private long rVideoBuoi1;
    private long rRiengLop;
    private long rBuoi2;
    private long tepTaiLieuBuoi1;

    @BeforeAll
    void dungDuLieu() {
        Long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-HOCLIEU-API', 'Toan 10 hoc lieu qua API', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu học liệu qua API', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        Long khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Khóa học liệu qua API 2096/2097', '2096-2097', '2096-08-01'::date, '2097-05-31'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau);
        Long mach = jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, 'DAI_SO', 'Đại số', 1, now(), now())
                returning id""", Long.class, chuongTrinh);
        tiet1 = jdbc.queryForObject("""
                insert into program_periods (strand_id, period_no, week_no, term, title, period_kind, created_at, updated_at)
                values (?, 1, 1, 1, 'Tiết 1 - buổi 1', 'BAI_MOI', now(), now())
                returning id""", Long.class, mach);
        tiet2 = jdbc.queryForObject("""
                insert into program_periods (strand_id, period_no, week_no, term, title, period_kind, created_at, updated_at)
                values (?, 2, 1, 1, 'Tiết 2 - buổi 2', 'BAI_MOI', now(), now())
                returning id""", Long.class, mach);

        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        lopA = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values ('HOCLIEU-API-10A', 'Lớp 10A học liệu qua API', ?, 'ACTIVE', now(), now())
                returning id""", Long.class, khoi);
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())", lopA, khoa);

        emA = taoNguoiDung("STUDENT", "An lớp A hoc lieu api");
        emNgoaiLop = taoNguoiDung("STUDENT", "Binh ngoai lop hoc lieu api");
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())", lopA, emA);

        Long buoi1 = jdbc.queryForObject("""
                insert into course_delivery_sessions (course_instance_id, seq, session_type, source, created_at, updated_at)
                values (?, 1, 'TEACHING', 'MANUAL', now(), now())
                returning id""", Long.class, khoa);
        Long buoi2 = jdbc.queryForObject("""
                insert into course_delivery_sessions (course_instance_id, seq, session_type, source, created_at, updated_at)
                values (?, 2, 'TEACHING', 'MANUAL', now(), now())
                returning id""", Long.class, khoa);
        jdbc.update("""
                insert into course_delivery_session_units (course_delivery_session_id, course_instance_id, program_period_id, order_in_session, created_at, updated_at)
                values (?,?,?,1,now(),now())""", buoi1, khoa, tiet1);
        jdbc.update("""
                insert into course_delivery_session_units (course_delivery_session_id, course_instance_id, program_period_id, order_in_session, created_at, updated_at)
                values (?,?,?,1,now(),now())""", buoi2, khoa, tiet2);

        lichBuoi1 = jdbc.queryForObject("""
                insert into class_schedule (class_id, course_delivery_session_id, seq, scheduled_date, status, created_at, updated_at)
                values (?,?,1,?,'PLANNED',now(),now())
                returning id""", Long.class, lopA, buoi1, java.sql.Date.valueOf(LocalDate.now().plusDays(1)));
        lichBuoi2 = jdbc.queryForObject("""
                insert into class_schedule (class_id, course_delivery_session_id, seq, scheduled_date, status, created_at, updated_at)
                values (?,?,2,?,'PLANNED',now(),now())
                returning id""", Long.class, lopA, buoi2, java.sql.Date.valueOf(LocalDate.now().plusDays(8)));

        rTaiLieuBuoi1 = taoTaiLieu("Tài liệu buổi 1", "KHBD", "TIET", tiet1, null, 1);
        rVideoBuoi1 = taoTaiLieu("Video buổi 1", "VIDEO", "TIET", tiet1, "https://vi-du.test/video-buoi-1", 2);
        rRiengLop = taoTaiLieu("Tài liệu riêng lớp A", "KHBD", "HE_THONG", null, null, 1, lopA);
        rBuoi2 = taoTaiLieu("Tài liệu buổi 2", "KHBD", "TIET", tiet2, null, 1);
        tepTaiLieuBuoi1 = jdbc.queryForObject(
                "select file_asset_id from documents where title='Tài liệu buổi 1'", Long.class);
    }

    @Test
    @DisplayName("Khoanh đúng buổi qua scheduleId: thấy tài liệu + video của buổi 1 và riêng lớp, không thấy buổi 2; fileUrl DOCUMENT trỏ cửa file mới, VIDEO giữ link ngoài")
    void khoanhDungBuoi() throws Exception {
        JsonNode data = duLieu(goi("/api/classes/" + lopA + "/hoc-lieu?scheduleId=" + lichBuoi1, emA, "STUDENT"));

        List<Long> theoNoiDungIds = idsCua(data.get("theoNoiDung"));
        assertThat(theoNoiDungIds)
                .as("chỉ tài liệu neo đúng tiết của buổi 1 mới lọt qua, tài liệu buổi 2 (%d) thì không", rBuoi2)
                .containsExactlyInAnyOrder(rTaiLieuBuoi1, rVideoBuoi1);
        assertThat(idsCua(data.get("riengLop")))
                .as("mục riêng lớp không lẫn vào nhóm theo nội dung")
                .containsExactly(rRiengLop);

        JsonNode taiLieu = timTheoId(data.get("theoNoiDung"), rTaiLieuBuoi1);
        assertThat(taiLieu.get("fileUrl").asText())
                .as("DOCUMENT thường phải trỏ cửa /api/files/{id}/download đã gác bằng moDuocTep(), không phải /api/documents/{id}/content")
                .isEqualTo("/api/files/" + tepTaiLieuBuoi1 + "/download");

        JsonNode video = timTheoId(data.get("theoNoiDung"), rVideoBuoi1);
        assertThat(video.get("fileUrl").asText())
                .as("VIDEO giữ nguyên link ngoài, không đi qua cửa file nội bộ")
                .isEqualTo("https://vi-du.test/video-buoi-1");
    }

    @Test
    @DisplayName("Không truyền scheduleId thì gộp mọi buổi đã xếp lịch của lớp")
    void khongTruyenScheduleIdThiGopHetBuoi() throws Exception {
        JsonNode data = duLieu(goi("/api/classes/" + lopA + "/hoc-lieu", emA, "STUDENT"));

        assertThat(idsCua(data.get("theoNoiDung")))
                .as("gộp cả buổi 1 lẫn buổi 2 vì lớp đã xếp lịch cho cả hai")
                .containsExactlyInAnyOrder(rTaiLieuBuoi1, rVideoBuoi1, rBuoi2);
    }

    @Test
    @DisplayName("Học sinh ngoài lớp bị chặn trước khi chạm tới resolver")
    void hocSinhNgoaiLopBiChan() throws Exception {
        var yeuCau = request(HttpMethod.GET, "/api/classes/" + lopA + "/hoc-lieu")
                .with(authentication(danhTinh(emNgoaiLop, "STUDENT")));
        int status = mockMvc.perform(yeuCau).andReturn().getResponse().getStatus();
        assertThat(status).isEqualTo(403);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    @DisplayName("Tài liệu cũ chưa có file_asset vẫn có đường mở theo quyền phân phối")
    void taiLieuCuVanMoDuocTuDanhSach() throws Exception {
        jdbc.update("update documents set file_asset_id=null,file_url='https://example.test/legacy.pdf' where id=(select resource_ref_id from program_resources where id=?)",rTaiLieuBuoi1);
        JsonNode data=duLieu(goi("/api/classes/"+lopA+"/hoc-lieu",emA,"STUDENT"));
        assertThat(timTheoId(data.get("theoNoiDung"),rTaiLieuBuoi1).get("fileUrl").asText())
                .isEqualTo("/api/program-resources/"+rTaiLieuBuoi1+"/content.pdf");
    }

    // ==================== dựng dữ liệu ====================

    private long taoTaiLieu(String tieuDe, String docType, String noiDenLoai, Long neo, String videoUrl, int thuTu) {
        return taoTaiLieu(tieuDe, docType, noiDenLoai, neo, videoUrl, thuTu, null);
    }

    private long taoTaiLieu(String tieuDe, String docType, String noiDenLoai, Long neo, String videoUrl, int thuTu, Long lop) {
        Long tep = "VIDEO".equals(docType) ? null : jdbc.queryForObject("""
                insert into file_assets (file_name, file_url, mime_type, file_size, created_at, updated_at)
                values (?, ?, 'application/pdf', 1024, now(), now())
                returning id""", Long.class, tieuDe + ".pdf", "https://vi-du.test/" + tieuDe);
        Long taiLieu = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, file_asset_id, status, created_at, updated_at)
                values (?, ?, 'STUDENT_ALLOWED', ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, tieuDe, docType, videoUrl == null ? "" : videoUrl, tep);
        return jdbc.queryForObject("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience,
                     noi_den_loai, neo, lop_id, created_at, updated_at)
                values (null, 'DOCUMENT', ?, ?, ?, 'PUBLISHED', 'STUDENT_ALLOWED', ?, ?, ?, now(), now())
                returning id""", Long.class, taiLieu, tieuDe, thuTu, noiDenLoai, neo, lop);
    }

    private long taoNguoiDung(String vai, String ten) {
        String duyNhat = ten + "-" + dem.incrementAndGet();
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, duyNhat + "@hoclieuapi.test", ten, duyNhat, vai);
    }

    private List<Long> idsCua(JsonNode mang) {
        return java.util.stream.StreamSupport.stream(mang.spliterator(), false)
                .map(x -> x.get("id").asLong()).toList();
    }

    private JsonNode timTheoId(JsonNode mang, long id) {
        for (JsonNode x : mang) if (x.get("id").asLong() == id) return x;
        throw new AssertionError("Không thấy mục học liệu " + id);
    }

    private String goi(String duongDan, long nguoi, String vai) throws Exception {
        var yeuCau = request(HttpMethod.GET, duongDan).with(authentication(danhTinh(nguoi, vai)));
        var phanHoi = mockMvc.perform(yeuCau).andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET %s → %s", duongDan, noiDung).isEqualTo(200);
        return noiDung;
    }

    private JsonNode duLieu(String than) throws Exception {
        return json.readTree(than).get("data");
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@hoclieuapi.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
