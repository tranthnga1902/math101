package com.math10.authentication;

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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Xem hộ là tính năng nguy hiểm nhất trong hệ: nó cố tình cấp cho một người danh tính của người
 * khác. Đổi lại, nó phải bị bó chặt ở đúng ba chỗ, và cả ba đều được ghim ở đây.
 *
 * <p><b>Chỉ đọc.</b> Giáo viên nhìn thấy màn hình học sinh là để kiểm chứng, không phải để làm bài
 * thay. Nếu một {@code POST} lọt qua thì bài nộp mang tên học sinh nhưng do người khác bấm — và
 * nhật ký không phân biệt được. Rào chắn nằm ở {@code JwtAuthenticationFilter}, tức là nó chỉ nghe
 * lời khi request mang token thật. Vì thế test này <b>đi bằng Bearer token thật</b> chứ không cắm
 * principal vào SecurityContext: cắm thẳng principal sẽ nhảy qua đúng cái filter đang cần kiểm.
 *
 * <p><b>Đúng người.</b> Giáo viên chỉ xem được học sinh lớp mình dạy; và chỉ xem được tài khoản
 * học sinh, không xem được đồng nghiệp hay quản trị — nếu không thì xem hộ thành đường leo thang
 * đặc quyền, chỉ cần một tài khoản giáo viên là chạm tới mọi thứ admin thấy.
 *
 * <p><b>Đúng những gì học sinh thấy.</b> Đây là mục đích ban đầu: cái nhìn qua vai phải bằng đúng
 * cái học sinh tự đăng nhập sẽ thấy — không hơn (lộ bài nháp) và không kém (báo yên tâm hão).
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Xem bằng mắt học viên")
class ImpersonationTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private final AtomicInteger dem = new AtomicInteger();

    private long quanTri;
    private long giaoVien;
    private long giaoVienLa;

    private long lopMinh;
    private long hocSinh;
    private long hocSinhLopKhac;

    private long baiDaPhatHanh;

    @BeforeAll
    void dungDuLieu() {
        quanTri = taoNguoiDung("ADMIN", "Quan tri xem ho");
        giaoVien = taoNguoiDung("TEACHER", "Co Nga xem ho");
        giaoVienLa = taoNguoiDung("TEACHER", "Thay la xem ho");

        lopMinh = taoLop("XEMHO-A", giaoVien);
        long lopKhac = taoLop("XEMHO-B", giaoVienLa);
        hocSinh = taoHocSinh(lopMinh, "Em A");
        hocSinhLopKhac = taoHocSinh(lopKhac, "Em B");

        baiDaPhatHanh = taoBaiGiao(lopMinh, "Bai da phat hanh", "PUBLISHED");
        taoBaiGiao(lopMinh, "Bai con nhap", "DRAFT");
    }

    // ==================== chỉ đọc ====================

    /**
     * Ca quan trọng nhất của cả lớp test này. Danh tính đúng, quyền đúng, chỉ sai ở chỗ đây là
     * thao tác ghi — và chừng đó là đủ để bị chặn.
     */
    @Test
    @DisplayName("Mọi thao tác ghi trong phiên xem hộ đều bị chặn")
    void phienXemHoKhongGhiDuoc() throws Exception {
        String token = token(giaoVien, "TEACHER", hocSinh);

        goiToken(HttpMethod.POST, "/api/assignments/" + baiDaPhatHanh + "/start", null, 403, token);
        goiToken(HttpMethod.PUT, "/api/auth/change-password", "{}", 403, token);
        goiToken(HttpMethod.DELETE, "/api/assignments/" + baiDaPhatHanh, null, 403, token);
    }

    /**
     * Mong đợi 403 chứ không phải 404, dù đường dẫn không tồn tại. Nhận 404 nghĩa là request đã đi
     * hết vòng định tuyến rồi mới trượt — tức rào chắn đứng sau chỗ nó cần đứng, và một controller
     * mới thêm vào ngày mai sẽ nằm ngoài vòng bảo vệ mà không ai hay.
     */
    @Test
    @DisplayName("Chặn nằm ở phương thức, không ở đường dẫn — đường lạ cũng chặn")
    void chanTheoPhuongThucChuKhongTheoDuongDan() throws Exception {
        goiToken(HttpMethod.POST, "/api/duong-dan-khong-ton-tai", "{}", 403, token(quanTri, "ADMIN", hocSinh));
    }

    @Test
    @DisplayName("Phiên xem hộ không kèm refresh token nên không tự kéo dài được")
    void khongCoRefreshToken() throws Exception {
        JsonNode phien = duLieu(goi(HttpMethod.POST, "/api/auth/impersonate/" + hocSinh, null, 200,
                giaoVien, "TEACHER"));
        assertThat(phien.has("refreshToken"))
                .as("""
                        Có refresh token thì một cửa sổ bỏ quên sẽ tự gia hạn mãi. Không có thì hết hạn là
                        hết xem — đó là lý do phiên này cố tình cụt.""")
                .isFalse();
        assertThat(phien.get("expiresInSeconds").asLong()).isPositive().isLessThanOrEqualTo(3600);
        assertThat(phien.get("actorUserId").asLong())
                .as("người thật phải đi kèm, nếu không nhật ký chỉ thấy học sinh tự thao tác")
                .isEqualTo(giaoVien);
    }

    // ==================== đúng người ====================

    @Test
    @DisplayName("Giáo viên không xem được học sinh lớp mình không dạy")
    void khongXemDuocHocSinhLopKhac() throws Exception {
        goi(HttpMethod.POST, "/api/auth/impersonate/" + hocSinhLopKhac, null, 403, giaoVien, "TEACHER");
    }

    @Test
    @DisplayName("Không xem hộ được tài khoản không phải học sinh")
    void khongXemDuocDongNghiep() throws Exception {
        goi(HttpMethod.POST, "/api/auth/impersonate/" + giaoVienLa, null, 400, quanTri, "ADMIN");
        goi(HttpMethod.POST, "/api/auth/impersonate/" + quanTri, null, 400, giaoVien, "TEACHER");
    }

    @Test
    @DisplayName("Học sinh không xem hộ được ai")
    void hocSinhKhongXemHoDuocAi() throws Exception {
        goi(HttpMethod.POST, "/api/auth/impersonate/" + hocSinhLopKhac, null, 403, hocSinh, "STUDENT");
    }

    @Test
    @DisplayName("Admin xem được học sinh của mọi lớp")
    void adminXemDuocMoiHocSinh() throws Exception {
        goi(HttpMethod.POST, "/api/auth/impersonate/" + hocSinhLopKhac, null, 200, quanTri, "ADMIN");
    }

    // ==================== đúng những gì học sinh thấy ====================

    /**
     * Không so với một danh sách chép tay trong test, mà so <em>hai lời gọi thật</em>: học sinh tự
     * đăng nhập và giáo viên nhìn qua vai. Chép tay thì chỉ ghim được hiểu biết của người viết
     * test hôm nay; so hai lời gọi thì ghim được chính điều tính năng này hứa.
     */
    @Test
    @DisplayName("Nhìn qua vai thấy đúng bằng học sinh tự đăng nhập")
    void thayDungBangHocSinhTuDangNhap() throws Exception {
        String tuMinh = duLieu(goi(HttpMethod.GET, "/api/assignments?classId=" + lopMinh, null, 200,
                hocSinh, "STUDENT")).toString();
        String quaVai = duLieu(goiToken(HttpMethod.GET, "/api/assignments?classId=" + lopMinh, null, 200,
                token(giaoVien, "TEACHER", hocSinh))).toString();

        assertThat(quaVai).isEqualTo(tuMinh);
        assertThat(quaVai)
                .as("""
                        Bài còn nháp không được lọt vào: nếu phiên xem hộ vô tình chạy bằng quyền giáo viên
                        thì nó sẽ thấy bài nháp, và giáo viên yên tâm rằng học sinh cũng thấy — trong khi
                        học sinh không thấy gì cả.""")
                .contains("Bai da phat hanh")
                .doesNotContain("Bai con nhap");
    }

    @Test
    @DisplayName("Không thấy được lớp mà học sinh không học, dù giáo viên có quyền ở đó")
    void khongMuonQuyenCuaGiaoVien() throws Exception {
        long lopGiaoVienCungDay = taoLop("XEMHO-C", giaoVien);
        goiToken(HttpMethod.GET, "/api/assignments?classId=" + lopGiaoVienCungDay, null, 403,
                token(giaoVien, "TEACHER", hocSinh));
    }

    // ==================== gọi và dựng ====================

    /** Lấy token xem hộ thật, đúng như trình duyệt sẽ làm. */
    private String token(long nguoi, String vai, long em) throws Exception {
        return duLieu(goi(HttpMethod.POST, "/api/auth/impersonate/" + em, null, 200, nguoi, vai))
                .get("accessToken").asText();
    }

    /**
     * {@code mongDoi} là mã HTTP thật, không phải {@code code} trong phong bì: ApiEnvelope của dự
     * án trả HTTP 200 với {@code code:201} bên trong.
     */
    private String goi(HttpMethod phuongThuc, String duongDan, String than, int mongDoi, long nguoi, String vai)
            throws Exception {
        return thucHien(request(phuongThuc, duongDan).with(authentication(danhTinh(nguoi, vai))),
                phuongThuc, duongDan, than, mongDoi);
    }

    /** Đi bằng Bearer token thật để rào chắn trong JwtAuthenticationFilter được chạy. */
    private String goiToken(HttpMethod phuongThuc, String duongDan, String than, int mongDoi, String token)
            throws Exception {
        return thucHien(request(phuongThuc, duongDan).header("Authorization", "Bearer " + token),
                phuongThuc, duongDan, than, mongDoi);
    }

    private String thucHien(MockHttpServletRequestBuilder yeuCau, HttpMethod phuongThuc, String duongDan,
                            String than, int mongDoi) throws Exception {
        if (than != null) yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content(than);
        var phanHoi = mockMvc.perform(yeuCau).andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("%s %s → %s", phuongThuc, duongDan, noiDung).isEqualTo(mongDoi);
        return noiDung;
    }

    private JsonNode duLieu(String than) throws Exception {
        return json.readTree(than).get("data");
    }

    private long taoBaiGiao(long lopId, String ten, String trangThai) {
        return jdbc.queryForObject("""
                insert into assignments (class_id, title, task_kind, status, open_at, due_at, max_attempts,
                                         late_policy, answer_reveal, counts_in_gradebook, created_by,
                                         created_at, updated_at)
                values (?, ?, 'BAI_TAP', ?, ?, ?, 1, 'REJECT', 'AFTER_RETURN', true, ?, now(), now())
                returning id""", Long.class, lopId, ten, trangThai,
                LocalDateTime.now().minusDays(1), LocalDateTime.now().plusDays(7), giaoVien);
    }

    private long taoLop(String tien, long dayBoi) {
        String ma = tien + "-" + dem.incrementAndGet();
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1",
                Long.class);
        long moi = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, ma, ma, khoi);
        jdbc.update("insert into class_teachers (class_id, teacher_id, created_at, updated_at) values (?,?,now(),now())",
                moi, dayBoi);
        return moi;
    }

    private long taoHocSinh(long lopId, String ten) {
        long em = taoNguoiDung("STUDENT", ten);
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())",
                lopId, em);
        return em;
    }

    private long taoNguoiDung(String vai, String ten) {
        String duyNhat = ten + "-" + dem.incrementAndGet();
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, duyNhat + "@xemho.test", ten, duyNhat, vai);
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@xemho.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
