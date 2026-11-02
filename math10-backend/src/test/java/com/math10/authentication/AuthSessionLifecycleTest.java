package com.math10.authentication;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Vòng đời phiên đăng nhập: cấp — làm mới — thu hồi.
 *
 * <p>Trước lát này hệ thống chỉ có <code>/auth/login</code>. Bảng <code>refresh_tokens</code> có
 * từ baseline nhưng không service nào chạm vào, <code>SecurityConfig</code> đã mở sẵn
 * <code>/api/auth/refresh</code> cho một endpoint không tồn tại, và <code>logout</code> ở giao
 * diện chỉ xoá localStorage. Hệ quả: <b>không có cách nào huỷ một phiên đã cấp</b> — máy bị mất,
 * tài khoản bị khoá, mật khẩu vừa đổi, token cũ vẫn dùng được cho tới lúc hết hạn.
 *
 * <p>Mà "lúc hết hạn" lại rất xa: <code>jwt-expiration</code> khai <code>3600000</code>, ai đọc
 * cũng tưởng mili-giây, còn {@code JwtService} cộng thẳng vào trường <code>exp</code> của JWT
 * tính bằng giây — access token sống <b>~41,7 ngày</b>. Phép thử
 * {@link #accessTokenSongNgan()} chốt con số đó lại.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng tới staging.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Vòng đời phiên đăng nhập")
class AuthSessionLifecycleTest {

    private static final String MAT_KHAU = "MatKhauGoc@2026";
    private static final AtomicInteger DEM = new AtomicInteger();

    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private PasswordEncoder passwordEncoder;

    private final ObjectMapper json = new ObjectMapper();

    // ---------------------------------------------------------------- cấp

    @Test
    @DisplayName("Đăng nhập cấp cả access token lẫn refresh token")
    void dangNhapCapCaHaiToken() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        JsonNode phien = dangNhap(nguoi);

        assertThat(phien.path("accessToken").asText()).isNotBlank();
        assertThat(phien.path("refreshToken").asText())
                .as("trước lát này trường refreshToken luôn là chuỗi rỗng")
                .isNotBlank();
        assertThat(phien.path("expiresInSeconds").asLong()).isEqualTo(1800L);
    }

    @Test
    @DisplayName("Access token sống 30 phút, không phải 41 ngày")
    void accessTokenSongNgan() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        JsonNode tai = giaiMaJwt(dangNhap(nguoi).path("accessToken").asText());

        long song = tai.path("exp").asLong() - tai.path("iat").asLong();
        assertThat(song).as("hiệu exp − iat của access token, tính bằng giây").isEqualTo(1800L);
    }

    @Test
    @DisplayName("Cơ sở dữ liệu chỉ giữ bản băm, không giữ refresh token gốc")
    void chiLuuBanBam() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        String refresh = dangNhap(nguoi).path("refreshToken").asText();

        Integer trungGoc = jdbc.queryForObject(
                "select count(*) from refresh_tokens where token_hash = ?", Integer.class, refresh);
        assertThat(trungGoc).as("đọc trộm bảng refresh_tokens không được ra token dùng được").isZero();

        String bam = jdbc.queryForObject(
                "select token_hash from refresh_tokens where user_id = ?", String.class, nguoi.id());
        assertThat(bam).as("SHA-256 dạng hex").matches("[0-9a-f]{64}");
    }

    // ------------------------------------------------------------ làm mới

    @Test
    @DisplayName("Refresh token đổi được cặp token mới, và access token mới gọi được API")
    void refreshCapTokenDungDuoc() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        JsonNode cu = dangNhap(nguoi);

        JsonNode moi = json.readTree(lamMoi(cu.path("refreshToken").asText()).getResponse().getContentAsString())
                .path("data");

        assertThat(moi.path("refreshToken").asText())
                .as("xoay vòng: mỗi lần làm mới phải ra refresh token khác")
                .isNotBlank()
                .isNotEqualTo(cu.path("refreshToken").asText());
        assertThat(moi.path("userId").asLong()).isEqualTo(nguoi.id());

        int trangThai = mockMvc.perform(get("/api/metadata")
                        .header("Authorization", "Bearer " + moi.path("accessToken").asText()))
                .andReturn().getResponse().getStatus();
        assertThat(trangThai).as("access token vừa cấp phải dùng được ngay").isEqualTo(200);
    }

    @Test
    @DisplayName("Xoay vòng: refresh token cũ chết ngay sau khi đổi")
    void tokenCuChetSauKhiXoayVong() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        String cu = dangNhap(nguoi).path("refreshToken").asText();
        lamMoi(cu);

        assertThat(lamMoi(cu).getResponse().getStatus())
                .as("dùng lại token đã đổi").isEqualTo(400);
    }

    @Test
    @DisplayName("Dùng lại token đã thu hồi thì cắt sạch mọi phiên của tài khoản")
    void dungLaiTokenThuHoiThiCatSachPhien() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        String cu = dangNhap(nguoi).path("refreshToken").asText();
        String moi = json.readTree(lamMoi(cu).getResponse().getContentAsString())
                .path("data").path("refreshToken").asText();

        // Kẻ cầm bản sao cũ đem đi đổi: không phân biệt được là trộm hay phát lại,
        // nên xử lý theo hướng an toàn.
        lamMoi(cu);

        assertThat(lamMoi(moi).getResponse().getStatus())
                .as("token hợp lệ của chính người dùng cũng phải bị huỷ theo").isEqualTo(400);
        assertThat(demConHieuLuc(nguoi)).as("số refresh token còn hiệu lực").isZero();
    }

    @Test
    @DisplayName("Refresh token hết hạn thì không đổi được")
    void tokenHetHanKhongDoiDuoc() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        String refresh = dangNhap(nguoi).path("refreshToken").asText();
        jdbc.update("update refresh_tokens set expires_at = now() - interval '1 day' where user_id = ?", nguoi.id());

        assertThat(lamMoi(refresh).getResponse().getStatus()).isEqualTo(400);
    }

    @Test
    @DisplayName("Tài khoản bị khoá thì refresh token cũ mất hiệu lực")
    void taiKhoanKhoaThiTokenMatHieuLuc() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        String refresh = dangNhap(nguoi).path("refreshToken").asText();
        jdbc.update("update users set status = 'INACTIVE' where id = ?", nguoi.id());

        assertThat(lamMoi(refresh).getResponse().getStatus())
                .as("khoá tài khoản mà token cũ vẫn đổi được thì khoá thành vô nghĩa").isEqualTo(400);
        assertThat(demConHieuLuc(nguoi)).isZero();
    }

    @Test
    @DisplayName("Refresh token bịa ra thì không đổi được")
    void tokenBiaKhongDoiDuoc() throws Exception {
        assertThat(lamMoi("khong-phai-token-that").getResponse().getStatus()).isEqualTo(400);
    }

    // ------------------------------------------------------------ thu hồi

    @Test
    @DisplayName("Đăng xuất thu hồi refresh token")
    void dangXuatThuHoiToken() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        String refresh = dangNhap(nguoi).path("refreshToken").asText();

        assertThat(dangXuat(refresh).getResponse().getStatus()).isEqualTo(200);
        assertThat(demConHieuLuc(nguoi)).isZero();
        assertThat(lamMoi(refresh).getResponse().getStatus())
                .as("đăng xuất rồi mà vẫn làm mới được thì đăng xuất chỉ là xoá localStorage")
                .isEqualTo(400);
    }

    @Test
    @DisplayName("Đăng xuất không cần access token còn hạn")
    void dangXuatKhongCanAccessToken() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        String refresh = dangNhap(nguoi).path("refreshToken").asText();

        // Cố tình không gửi header Authorization: token truy cập hết hạn rồi
        // thì người dùng vẫn phải đăng xuất được.
        assertThat(dangXuat(refresh).getResponse().getStatus()).isEqualTo(200);
        assertThat(demConHieuLuc(nguoi)).isZero();
    }

    @Test
    @DisplayName("Đăng xuất với token lạ vẫn trả 200, không hé lộ token nào có thật")
    void dangXuatKhongLoThongTin() throws Exception {
        assertThat(dangXuat("khong-phai-token-that").getResponse().getStatus()).isEqualTo(200);
        assertThat(dangXuat("").getResponse().getStatus()).isEqualTo(200);
    }

    @Test
    @DisplayName("Đổi mật khẩu cắt sạch phiên cũ")
    void doiMatKhauCatSachPhien() throws Exception {
        NguoiDung nguoi = taoNguoiDung();
        JsonNode phien = dangNhap(nguoi);
        String refresh = phien.path("refreshToken").asText();

        int trangThai = mockMvc.perform(post("/api/auth/change-password")
                        .header("Authorization", "Bearer " + phien.path("accessToken").asText())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.createObjectNode()
                                .put("currentPassword", MAT_KHAU)
                                .put("newPassword", "MatKhauKhac@2026")
                                .put("confirmPassword", "MatKhauKhac@2026")
                                .toString()))
                .andReturn().getResponse().getStatus();
        assertThat(trangThai).isEqualTo(200);

        assertThat(lamMoi(refresh).getResponse().getStatus())
                .as("đổi mật khẩu là để cắt đuôi người đang dùng ké, nên phiên cũ phải chết")
                .isEqualTo(400);
        assertThat(demConHieuLuc(nguoi)).isZero();
    }

    // ------------------------------------------------------------ tiện ích

    private record NguoiDung(long id, String email) {}

    private NguoiDung taoNguoiDung() {
        String ten = "phien" + DEM.incrementAndGet();
        String email = ten + "@auth.test";
        Long id = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, ?, ?, ?, 'STUDENT', 'ACTIVE', now(), now())
                returning id
                """, Long.class, email, passwordEncoder.encode(MAT_KHAU), ten, ten);
        return new NguoiDung(id, email);
    }

    private JsonNode dangNhap(NguoiDung nguoi) throws Exception {
        MvcResult ketQua = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.createObjectNode()
                                .put("identifier", nguoi.email())
                                .put("password", MAT_KHAU)
                                .toString()))
                .andReturn();
        assertThat(ketQua.getResponse().getStatus()).as("đăng nhập").isEqualTo(200);
        return json.readTree(ketQua.getResponse().getContentAsString()).path("data");
    }

    private MvcResult lamMoi(String refreshToken) throws Exception {
        return goiToken("/api/auth/refresh", refreshToken);
    }

    private MvcResult dangXuat(String refreshToken) throws Exception {
        return goiToken("/api/auth/logout", refreshToken);
    }

    private MvcResult goiToken(String duongDan, String refreshToken) throws Exception {
        return mockMvc.perform(post(duongDan)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json.createObjectNode().put("refreshToken", refreshToken).toString()))
                .andReturn();
    }

    private Integer demConHieuLuc(NguoiDung nguoi) {
        return jdbc.queryForObject(
                "select count(*) from refresh_tokens where user_id = ? and revoked_at is null",
                Integer.class, nguoi.id());
    }

    private JsonNode giaiMaJwt(String token) throws Exception {
        String tai = token.split("\\.")[1];
        return json.readTree(new String(Base64.getUrlDecoder().decode(tai), StandardCharsets.UTF_8));
    }
}
