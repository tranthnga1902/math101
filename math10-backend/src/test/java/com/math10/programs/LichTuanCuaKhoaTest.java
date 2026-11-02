package com.math10.programs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
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
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;

/**
 * Lịch tuần: nối 35 tuần chương trình vào ngày tháng thật của một khóa.
 *
 * <p>Ba ca đầu đo ba điểm mà kế hoạch gọi tên là dễ sai. <b>Neo về thứ Hai</b> — admin chọn ngày
 * 05/09/2026 nhằm thứ Bảy thì tuần 1 vẫn bắt đầu từ 31/08, và con số ấy phải hiện ra ở màn xem
 * trước, trước khi ghi. <b>Tuần nghỉ không tiêu số tuần</b> — nghỉ Tết một tuần thì vẫn còn đủ 35
 * tuần học, chỉ lùi ngày. <b>Quá khứ không đụng</b> — sinh lại từ tuần 20 thì mười chín dòng đầu giữ
 * nguyên cả {@code id}, không phải chỉ giữ nguyên ngày.
 *
 * <p>Ca sửa tay là ca đắt nhất. Cờ {@code edited_by_hand} tồn tại vì nghỉ bão và dạy bù chắc chắn sẽ
 * xảy ra, mà công thức thuần không xử lý được; nên phép thử sinh lại <b>hai lượt</b> — một lượt giữ
 * được là chưa đủ, thứ dễ hỏng là lượt sau làm mất cờ và lượt thứ ba xóa mất công người ta sửa.
 *
 * <p>Có một ranh giới ở đây dễ đặt sai theo hướng ngược lại: nghỉ lễ hai ngày giữa tuần
 * <em>không</em> làm tuần ấy biến mất — vẫn dạy, chỉ mất hai buổi. Ca thứ ba canh đúng chỗ đó, vì
 * quy tắc "chạm vào kỳ nghỉ là thành tuần nghỉ" viết dễ hơn và sẽ ăn mất mấy tuần học mỗi năm.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Lịch tuần của khóa")
class LichTuanCuaKhoaTest {

    /** Thứ Bảy. Đúng ví dụ kế hoạch nêu, và là lý do ca đầu tiên tồn tại. */
    private static final LocalDate KHAI_GIANG = LocalDate.of(2026, 9, 5);
    private static final LocalDate THU_HAI_TUAN_MOT = LocalDate.of(2026, 8, 31);

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private long khoa;
    private long quanTri;
    private long giaoVien;
    private long hocSinh;

    @BeforeAll
    void dungDuLieu() {
        long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-LICHTUAN', 'Toan 10 lich tuan', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mau lich tuan', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Khoa lich tuan', '2026-2027-LT', ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, mau,
                java.sql.Date.valueOf(KHAI_GIANG), java.sql.Date.valueOf(KHAI_GIANG.plusYears(1)));
        // Lượt ghi có ghi nhật ký, mà nhật ký khóa ngoại về users — người dùng phải có thật.
        quanTri = nguoiDung("quan.tri@lichtuan.test", "quan.tri.lich.tuan", "Quản trị lịch tuần", "ADMIN");
        giaoVien = nguoiDung("co@lichtuan.test", "co.lich.tuan", "Cô lịch tuần", "TEACHER");
        hocSinh = nguoiDung("em@lichtuan.test", "em.lich.tuan", "Em lịch tuần", "STUDENT");
    }

    @Test @Order(1)
    @DisplayName("Chọn ngày thứ Bảy thì tuần 1 vẫn neo về thứ Hai, và xem trước không ghi gì")
    void neoVeThuHaiTruocKhiLuu() throws Exception {
        Map<String,Object> ban = xemTruoc(KHAI_GIANG, null);
        List<Map<String,Object>> tuan = tuanCua(ban);

        assertThat(ngay(tuan.get(0), "batDau"))
                .as("""
                    tuần học là đơn vị của thời khóa biểu, không phải bảy ngày kể từ hôm khai giảng; \
                    dòng 'Tuần 1: 31/08 – 06/09' phải hiện ra trước khi ai bấm lưu""")
                .isEqualTo(THU_HAI_TUAN_MOT);
        assertThat(ngay(tuan.get(0), "ketThuc")).isEqualTo(THU_HAI_TUAN_MOT.plusDays(6));
        assertThat(tuan.get(0).get("soTuan")).isEqualTo(1);
        assertThat(tuan).hasSize(35);

        assertThat(daLuu())
                .as("xem trước mà ghi thì nó không còn là xem trước; đây là nửa còn lại của lát này")
                .isEmpty();
    }

    @Test @Order(2)
    @DisplayName("Ghi thật trải đủ 35 tuần, tuần nào cũng bắt đầu thứ Hai")
    void ghiThatTraiDuBaMuoiLamTuan() throws Exception {
        Map<String,Object> ra = ghi(KHAI_GIANG, null);
        assertThat(ra.get("soTuan")).isEqualTo(35);
        assertThat(ra.get("soTuanNghi")).isEqualTo(0);

        List<Map<String,Object>> luu = daLuu();
        assertThat(luu).hasSize(35);
        assertThat(luu.stream().map(d -> d.get("soTuan")).toList())
                .as("xếp theo ngày thì số tuần phải chạy liền 1..35; hụt một số là lịch thủng")
                .isEqualTo(IntStream.rangeClosed(1, 35).boxed().toList());
        assertThat(luu.stream().map(d -> ngay(d, "batDau").getDayOfWeek()).distinct().toList())
                .as("mọi tuần neo thứ Hai, không riêng tuần đầu")
                .containsExactly(DayOfWeek.MONDAY);
        assertThat(ngay(tuanSo(35), "ketThuc"))
                .as("không nghỉ ngày nào thì 35 tuần là đúng 245 ngày liên tiếp")
                .isEqualTo(THU_HAI_TUAN_MOT.plusDays(35L * 7 - 1));
    }

    @Test @Order(3)
    @DisplayName("Nghỉ lễ hai ngày giữa tuần không làm mất tuần ấy")
    void nghiHaiNgayKhongLamMatTuan() throws Exception {
        LocalDate dauTuanMuoi = ngay(tuanSo(10), "batDau");
        themNghi(dauTuanMuoi.plusDays(1), dauTuanMuoi.plusDays(2), "Nghỉ lễ hai ngày");

        ghi(KHAI_GIANG, null);

        assertThat(daLuu()).hasSize(35);
        assertThat(daLuu().stream().filter(d -> (Boolean) d.get("nghi")).toList())
                .as("""
                    ranh giới đặt ở 'phủ kín cả bảy ngày', không phải ở 'có chạm vào kỳ nghỉ'; \
                    đặt sai chiều này thì mỗi năm mất mấy tuần học mà lịch vẫn trông hợp lý""")
                .isEmpty();
        assertThat(ngay(tuanSo(10), "batDau"))
                .as("mất hai buổi thì vẫn là tuần 10, và không đẩy tuần nào lùi cả")
                .isEqualTo(dauTuanMuoi);
    }

    @Test @Order(4)
    @DisplayName("Nghỉ Tết phủ kín một tuần: các tuần sau dịch đúng, tuần trước không đổi")
    void tuanNghiKhongTieuSoTuan() throws Exception {
        LocalDate dauHaiTu = ngay(tuanSo(24), "batDau");
        LocalDate dauHaiLam = ngay(tuanSo(25), "batDau");
        LocalDate cuoiHaiLam = ngay(tuanSo(25), "ketThuc");
        themNghi(dauHaiLam, cuoiHaiLam, "Nghỉ Tết");

        Map<String,Object> ra = ghi(KHAI_GIANG, null);

        assertThat(ra.get("soTuan"))
                .as("đây là cả lát: nghỉ một tuần thì lùi ngày, chứ không mất một tuần chương trình")
                .isEqualTo(35);
        assertThat(ra.get("soTuanNghi")).isEqualTo(1);
        assertThat(daLuu()).hasSize(36);

        assertThat(ngay(tuanSo(24), "batDau"))
                .as("quá khứ không đổi")
                .isEqualTo(dauHaiTu);
        assertThat(ngay(tuanSo(25), "batDau"))
                .as("tuần 25 lùi đúng bảy ngày, không phải bị xóa cũng không phải đánh số lại")
                .isEqualTo(dauHaiLam.plusDays(7));

        Map<String,Object> dongNghi = daLuu().stream()
                .filter(d -> (Boolean) d.get("nghi")).findFirst().orElseThrow();
        assertThat(ngay(dongNghi, "batDau")).isEqualTo(dauHaiLam);
        assertThat(dongNghi.get("nhanNghi"))
                .as("màn hình phải nói được đang nghỉ vì gì, nên nhãn đi cùng dòng")
                .isEqualTo("Nghỉ Tết");
        assertThat(dongNghi.get("soTuan"))
                .as("tuần nghỉ có mặt trong lịch nhưng không mang số — CSDL cũng canh bằng ck_course_week_break")
                .isNull();
    }

    @Test @Order(5)
    @DisplayName("Sinh lại từ tuần 20 không viết lại dòng nào của mười chín tuần đầu")
    void sinhLaiKhongDungVaoQuaKhu() throws Exception {
        Map<Integer,Object> idTruoc = idTheoTuan(1, 19);
        Object idHaiMuoiTruoc = tuanSo(20).get("id");

        ghi(null, 20);

        assertThat(idTheoTuan(1, 19))
                .as("""
                    'quá khứ không đụng' không phải là sinh ra ngày y hệt rồi ghi đè — mà là không \
                    viết lại dòng nào; so id chứ không so ngày mới đo được điều đó""")
                .isEqualTo(idTruoc);
        assertThat(tuanSo(20).get("id"))
                .as("còn từ tuần thay đổi trở đi thì đúng là dòng mới")
                .isNotEqualTo(idHaiMuoiTruoc);
        assertThat(daLuu()).hasSize(36);
    }

    @Test @Order(6)
    @DisplayName("Tuần đã sửa tay giữ nguyên qua nhiều lượt sinh lại, và lượt sinh báo rõ bỏ qua mấy tuần")
    void tuanSuaTayGiuNguyenVaBaoRoBoQua() throws Exception {
        LocalDate dauBaMuoi = ngay(tuanSo(30), "batDau");
        LocalDate dauBaMotTruoc = ngay(tuanSo(31), "batDau");
        // Nghỉ bão giữa tuần: tuần 30 chỉ dạy được ba ngày. Không đổi ngày bắt đầu nên không chồng
        // lên tuần bên cạnh — đây là hình dạng thật của một lần chỉnh tay.
        assertThat(sua(id(tuanSo(30)), dauBaMuoi, dauBaMuoi.plusDays(2), quanTri())).isEqualTo(200);

        Map<String,Object> lan1 = ghi(null, 20);
        assertThat(lan1.get("soTuanBoQua"))
                .as("báo rõ đã bỏ qua mấy tuần, nếu không thì người ta không biết lịch mình vừa nhận là lịch nào")
                .isEqualTo(1);
        assertThat(ngay(tuanSo(30), "ketThuc")).isEqualTo(dauBaMuoi.plusDays(2));

        Map<String,Object> lan2 = ghi(null, 20);
        assertThat(lan2.get("soTuanBoQua"))
                .as("""
                    lượt sinh viết lại dòng, nên cờ sửa tay phải được mang theo sang dòng mới; mất cờ \
                    ở lượt hai thì lượt ba xóa mất công người ta sửa mà không báo gì""")
                .isEqualTo(1);
        assertThat(ngay(tuanSo(30), "ketThuc")).isEqualTo(dauBaMuoi.plusDays(2));
        assertThat(ngay(tuanSo(31), "batDau"))
                .as("tuần rút ngắn không kéo lịch trôi khỏi thứ Hai: tuần 31 vẫn ở đúng chỗ cũ")
                .isEqualTo(dauBaMotTruoc);
    }

    @Test @Order(7)
    @DisplayName("Sửa tuần chồng lên tuần khác thì từ chối")
    void suaChongLenTuanKhacThiTuChoi() throws Exception {
        LocalDate dauNam = ngay(tuanSo(5), "batDau");
        LocalDate cuoiNam = ngay(tuanSo(5), "ketThuc");

        assertThat(sua(id(tuanSo(5)), dauNam, ngay(tuanSo(6), "ketThuc"), quanTri()))
                .as("hai tuần chồng ngày thì câu 'hôm nay là tuần mấy' có hai đáp án")
                .isEqualTo(400);
        assertThat(ngay(tuanSo(5), "ketThuc")).isEqualTo(cuoiNam);
    }

    @Test @Order(8)
    @DisplayName("Học sinh đọc được lịch, chỉ admin mới sinh và xem trước được")
    void hocSinhDocDuocConAdminMoiSinhDuoc() throws Exception {
        assertThat(mockMvc.perform(get("/api/course-instances/{id}/weeks", khoa)
                        .with(authentication(ai(hocSinh, "em@lichtuan.test", "STUDENT"))))
                        .andReturn().getResponse().getStatus())
                .as("bao giờ học lại sau Tết là câu học sinh phải tự trả lời được")
                .isEqualTo(200);
        assertThat(mockMvc.perform(get("/api/admin/course-instances/{id}/weeks/preview", khoa)
                        .with(authentication(ai(giaoVien, "co@lichtuan.test", "TEACHER"))))
                        .andReturn().getResponse().getStatus())
                .isEqualTo(403);
        assertThat(ghiRa(null, null, ai(giaoVien, "co@lichtuan.test", "TEACHER")))
                .as("lệch lịch cả khóa là việc của admin, không phải của một giáo viên")
                .isEqualTo(403);
    }

    // ==================== dựng dữ liệu và đọc ====================

    private void themNghi(LocalDate tu, LocalDate den, String lyDo) {
        jdbc.update("""
                insert into academic_breaks(course_instance_id, starts_on, ends_on, reason, created_at, updated_at)
                values(?,?,?,?,now(),now())""",
                khoa, java.sql.Date.valueOf(tu), java.sql.Date.valueOf(den), lyDo);
    }

    private Map<String,Object> xemTruoc(LocalDate ngayBatDau, Integer tuTuan) throws Exception {
        var yc = get("/api/admin/course-instances/{id}/weeks/preview", khoa).with(authentication(quanTri()));
        if (ngayBatDau != null) yc = yc.param("ngayBatDau", ngayBatDau.toString());
        if (tuTuan != null) yc = yc.param("tuTuan", String.valueOf(tuTuan));
        return boc(mockMvc.perform(yc).andReturn().getResponse());
    }

    private Map<String,Object> ghi(LocalDate ngayBatDau, Integer tuTuan) throws Exception {
        var phanHoi = ghiRaw(ngayBatDau, tuTuan, quanTri());
        assertThat(phanHoi.getStatus()).as("ghi lịch → %s", noiDung(phanHoi)).isEqualTo(200);
        return boc(phanHoi);
    }

    /** Trả mã trạng thái thay vì ném, vì có ca cần 403 và có ca cần 200. */
    private int ghiRa(LocalDate ngayBatDau, Integer tuTuan, Authentication ai) throws Exception {
        return ghiRaw(ngayBatDau, tuTuan, ai).getStatus();
    }

    private org.springframework.mock.web.MockHttpServletResponse ghiRaw(
            LocalDate ngayBatDau, Integer tuTuan, Authentication ai) throws Exception {
        Map<String,Object> than = new LinkedHashMap<>();
        than.put("ngayBatDau", ngayBatDau == null ? null : ngayBatDau.toString());
        than.put("tuTuan", tuTuan);
        return mockMvc.perform(post("/api/admin/course-instances/{id}/weeks", khoa)
                        .with(authentication(ai)).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(than)))
                .andReturn().getResponse();
    }

    private int sua(long id, LocalDate tu, LocalDate den, Authentication ai) throws Exception {
        return mockMvc.perform(put("/api/admin/course-weeks/{id}", id)
                        .with(authentication(ai)).contentType(MediaType.APPLICATION_JSON)
                        .content(json.writeValueAsString(Map.of(
                                "ngayBatDau", tu.toString(), "ngayKetThuc", den.toString()))))
                .andReturn().getResponse().getStatus();
    }

    private List<Map<String,Object>> daLuu() throws Exception {
        var phanHoi = mockMvc.perform(get("/api/course-instances/{id}/weeks", khoa)
                .with(authentication(quanTri()))).andReturn().getResponse();
        assertThat(phanHoi.getStatus()).as("đọc lịch → %s", noiDung(phanHoi)).isEqualTo(200);
        String than = noiDung(phanHoi);
        Map<?,?> boc = json.readValue(than, Map.class);
        //noinspection unchecked
        return (List<Map<String,Object>>) boc.get("data");
    }

    private Map<String,Object> tuanSo(int so) throws Exception {
        return daLuu().stream().filter(d -> Integer.valueOf(so).equals(d.get("soTuan")))
                .findFirst().orElseThrow(() -> new AssertionError("Không có tuần " + so + " trong lịch"));
    }

    private Map<Integer,Object> idTheoTuan(int tu, int den) throws Exception {
        Map<Integer,Object> ra = new LinkedHashMap<>();
        for (Map<String,Object> d : daLuu()) {
            Object so = d.get("soTuan");
            if (so instanceof Integer n && n >= tu && n <= den) ra.put(n, d.get("id"));
        }
        return ra;
    }

    private long id(Map<String,Object> dong) { return ((Number) dong.get("id")).longValue(); }

    private LocalDate ngay(Map<String,Object> dong, String cot) { return LocalDate.parse((String) dong.get(cot)); }

    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> tuanCua(Map<String,Object> ban) {
        return new ArrayList<>((List<Map<String,Object>>) ban.get("tuan"));
    }

    private Map<String,Object> boc(org.springframework.mock.web.MockHttpServletResponse phanHoi) throws Exception {
        String than = noiDung(phanHoi);
        assertThat(phanHoi.getStatus()).as("→ %s", than).isEqualTo(200);
        Map<?,?> ngoai = json.readValue(than, Map.class);
        //noinspection unchecked
        return (Map<String,Object>) ngoai.get("data");
    }

    private String noiDung(org.springframework.mock.web.MockHttpServletResponse phanHoi) throws Exception {
        return phanHoi.getContentAsString(StandardCharsets.UTF_8);
    }

    private long nguoiDung(String thu, String tenTaiKhoan, String hoTen, String vai) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, thu, hoTen, tenTaiKhoan, vai);
    }

    private Authentication quanTri() { return ai(quanTri, "quan.tri@lichtuan.test", "ADMIN"); }

    private Authentication ai(long ai, String thu, String vai) {
        Math10Principal principal = new Math10Principal(ai, thu, vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
