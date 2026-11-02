package com.math10.exams;

import com.fasterxml.jackson.databind.JsonNode;
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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Kì thi là <b>ý định</b>; bài giao là thứ học sinh thật sự mở ra làm. Phát hành chính là chỗ nối
 * hai thứ ấy, nên đây là chỗ duy nhất đáng ghim bằng phép thử.
 *
 * <p><b>Một kì thi của khóa phải rơi xuống đúng những lớp của khóa ấy — không thiếu, không thừa.</b>
 * Thiếu thì một lớp đến ngày thi mà không có đề, và không ai biết cho tới lúc ấy. Thừa thì một lớp
 * không học khóa này bỗng nhận bài kiểm tra của khóa khác. Ca đầu dựng hai lớp trong khóa và một
 * lớp ngoài khóa để phân biệt hai lỗi đó — chỉ đếm số lớp thì lỗi "thừa" vẫn lọt.
 *
 * <p><b>Phát hành lần hai không được nhân đôi bài giao.</b> Bấm phát hành lại là chuyện thường
 * (sửa giờ, thêm lớp vào khóa giữa chừng). Nếu mỗi lần bấm lại đẻ thêm một bài thì lớp thấy hai
 * bài kiểm tra trùng tên, và điểm chia đôi giữa hai bài. Chỉ mục {@code uq_assignment_exam_class}
 * là ranh giới cuối, nhưng nó ném lỗi chứ không sửa — nên ca hai đòi phải <em>cập nhật tại chỗ</em>:
 * đổi tên kì thi rồi phát hành lại, bài cũ phải mang tên mới chứ không phải có thêm bài mới.
 *
 * <p><b>Giáo viên không ra được kì thi chung của khóa.</b> Kì thi khóa là quyết định ở tầm trung
 * tâm: một giáo viên sửa nó thì mọi lớp khác của khóa đổi theo mà không hay biết. Và không ra được
 * kì thi cho lớp mình không dạy — đó là IDOR thường gặp nhất ở đây, vì {@code classId} đi thẳng
 * từ thân yêu cầu.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Kì thi phát hành xuống lớp")
class ExamServiceTest {

    private static final LocalDateTime MO = LocalDateTime.now().minusHours(1).withNano(0);
    private static final LocalDateTime HAN = LocalDateTime.now().plusDays(3).withNano(0);

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private final AtomicInteger dem = new AtomicInteger();

    private long quanTri;
    private long giaoVien;
    private long giaoVienLa;

    private long khoa;
    private long lopMot;
    private long lopHai;
    private long lopNgoaiKhoa;

    private long banDe;

    @BeforeAll
    void dungDuLieu() {
        quanTri = taoNguoiDung("ADMIN", "Quan tri ki thi");
        giaoVien = taoNguoiDung("TEACHER", "Co Nga ki thi");
        giaoVienLa = taoNguoiDung("TEACHER", "Thay la ki thi");

        khoa = taoKhoa();
        lopMot = taoLop("KTHI-A", giaoVien);
        lopHai = taoLop("KTHI-B", giaoVien);
        gan(lopMot, khoa);
        gan(lopHai, khoa);

        // Lớp này do cùng một giáo viên dạy nhưng KHÔNG thuộc khóa. Nó là cái bẫy của ca đầu:
        // nếu phát hành đi tìm lớp theo giáo viên thay vì theo khóa thì lớp này sẽ dính bài.
        lopNgoaiKhoa = taoLop("KTHI-NGOAI", giaoVien);

        banDe = taoBanDe();
    }

    // ==================== phát hành ====================

    @Test
    @Order(1)
    @DisplayName("Kì thi của khóa rơi xuống đúng các lớp của khóa, không lan sang lớp ngoài khóa")
    void kiThiKhoaRoiXuongDungLopCuaKhoa() throws Exception {
        long kiThi = taoKiThiKhoa("Kiem tra giua ki I");

        JsonNode sau = duLieu(goi(HttpMethod.POST, "/api/exams/" + kiThi + "/publish", null, 200, quanTri, "ADMIN"));
        assertThat(sau.get("status").asText()).isEqualTo("PUBLISHED");
        assertThat(sau.get("classCount").asInt()).isEqualTo(2);
        assertThat(sau.get("assignmentCount").asInt())
                .as("""
                        Hai số này khác nhau: classCount là kì thi chạm tới mấy lớp, assignmentCount là đã
                        thật sự rơi xuống mấy lớp. Chúng chỉ bằng nhau khi phát hành chạy trọn.""")
                .isEqualTo(2);

        assertThat(lopCoBai(kiThi)).containsExactlyInAnyOrder(lopMot, lopHai);
        assertThat(lopCoBai(kiThi))
                .as("""
                        Lớp ngoài khóa do cùng giáo viên dạy. Nếu phát hành đi tìm lớp theo giáo viên thay vì
                        theo class_courses của khóa thì lớp này nhận bài kiểm tra của một khóa nó không học.""")
                .doesNotContain(lopNgoaiKhoa);

        for (long lop : List.of(lopMot, lopHai)) {
            assertThat(taiBai(kiThi, lop, "task_kind", String.class))
                    .as("bài sinh ra từ kì thi phải là bài kiểm tra, không phải bài tập")
                    .isEqualTo("BAI_KIEM_TRA");
            assertThat(taiBai(kiThi, lop, "worksheet_version_id", Long.class))
                    .as("""
                            Học sinh làm bản đề đã chốt, không làm câu gốc. Rơi mất worksheet_version_id thì
                            sửa câu hỏi về sau sẽ đổi luôn đề đã thi.""")
                    .isEqualTo(banDe);
            assertThat(taiBai(kiThi, lop, "status", String.class)).isEqualTo("PUBLISHED");
        }
    }

    @Test
    @Order(2)
    @DisplayName("Phát hành lần hai cập nhật bài cũ chứ không đẻ thêm bài")
    void phatHanhHaiLanKhongNhanDoi() throws Exception {
        long kiThi = taoKiThiKhoa("Kiem tra 15 phut");
        goi(HttpMethod.POST, "/api/exams/" + kiThi + "/publish", null, 200, quanTri, "ADMIN");
        assertThat(soBai(kiThi)).isEqualTo(2);

        goi(HttpMethod.PUT, "/api/exams/" + kiThi, thanKiThi("COURSE", khoa, "Kiem tra 15 phut (doi gio)"),
                200, quanTri, "ADMIN");
        JsonNode lanHai = duLieu(goi(HttpMethod.POST, "/api/exams/" + kiThi + "/publish", null, 200,
                quanTri, "ADMIN"));

        assertThat(soBai(kiThi))
                .as("""
                        Phát hành lại là chuyện thường: sửa giờ, hoặc thêm lớp vào khóa giữa chừng. Mỗi lần
                        bấm mà đẻ thêm một bài thì lớp thấy hai bài kiểm tra trùng tên và điểm chia đôi.""")
                .isEqualTo(2);
        assertThat(lanHai.get("assignmentCount").asInt()).isEqualTo(2);

        assertThat(taiBai(kiThi, lopMot, "title", String.class))
                .as("""
                        Cập nhật phải là *tại chỗ*. Nếu chỉ bỏ qua khi đã có bài thì số bài vẫn đúng, nhưng
                        tên và giờ của bài cũ đứng yên trong khi bảng kì thi nói đã đổi.""")
                .isEqualTo("Kiem tra 15 phut (doi gio)");
    }

    @Test
    @Order(3)
    @DisplayName("Thêm lớp vào khóa rồi phát hành lại thì lớp mới có bài, lớp cũ không nhân đôi")
    void themLopVaoKhoaRoiPhatHanhLai() throws Exception {
        long kiThi = taoKiThiKhoa("Kiem tra cuoi ki");
        goi(HttpMethod.POST, "/api/exams/" + kiThi + "/publish", null, 200, quanTri, "ADMIN");

        long lopVaoSau = taoLop("KTHI-C", giaoVien);
        gan(lopVaoSau, khoa);

        goi(HttpMethod.POST, "/api/exams/" + kiThi + "/publish", null, 200, quanTri, "ADMIN");

        assertThat(lopCoBai(kiThi))
                .as("""
                        Lớp vào khóa sau khi đã phát hành vẫn phải thi cùng đề. Bấm phát hành lần nữa là cách
                        duy nhất người dùng có để kéo lớp ấy vào, nên nó phải chạy được mà không hỏng hai lớp cũ.""")
                .containsExactlyInAnyOrder(lopMot, lopHai, lopVaoSau);
    }

    @Test
    @Order(4)
    @DisplayName("Đóng kì thi thì đóng luôn các bài con")
    void dongKiThiDongLuonBaiCon() throws Exception {
        long kiThi = taoKiThiKhoa("Kiem tra roi dong");
        goi(HttpMethod.POST, "/api/exams/" + kiThi + "/publish", null, 200, quanTri, "ADMIN");

        goi(HttpMethod.POST, "/api/exams/" + kiThi + "/close", null, 200, quanTri, "ADMIN");

        assertThat(jdbc.queryForList(
                "select status from assignments where exam_id=? and deleted_at is null", String.class, kiThi))
                .as("""
                        Kì thi "đã đóng" mà bài con còn mở thì trạng thái chỉ là một chữ trên màn hình: học
                        sinh vẫn vào nộp được, vì cổng nộp đọc trạng thái của bài giao chứ không của kì thi.""")
                .isNotEmpty()
                .containsOnly("CLOSED");
    }

    // ==================== quyền ====================

    @Test
    @Order(5)
    @DisplayName("Giáo viên không ra được kì thi chung của khóa")
    void giaoVienKhongRaDuocKiThiKhoa() throws Exception {
        goi(HttpMethod.POST, "/api/exams", thanKiThi("COURSE", khoa, "Giao vien lan sang tam khoa"),
                403, giaoVien, "TEACHER");
    }

    @Test
    @Order(6)
    @DisplayName("Giáo viên không ra được kì thi cho lớp mình không dạy")
    void giaoVienKhongRaDuocChoLopLa() throws Exception {
        goi(HttpMethod.POST, "/api/exams", thanKiThi("CLASS", lopMot, "Thay la ra de cho lop nguoi khac"),
                403, giaoVienLa, "TEACHER");
    }

    @Test
    @Order(7)
    @DisplayName("Giáo viên ra được kì thi cho lớp mình và nó rơi xuống đúng một lớp")
    void giaoVienRaDuocKiThiLopMinh() throws Exception {
        long kiThi = duLieu(goi(HttpMethod.POST, "/api/exams", thanKiThi("CLASS", lopMot, "Kiem tra rieng lop A"),
                200, giaoVien, "TEACHER")).get("id").asLong();

        JsonNode sau = duLieu(goi(HttpMethod.POST, "/api/exams/" + kiThi + "/publish", null, 200,
                giaoVien, "TEACHER"));
        assertThat(sau.get("classCount").asInt()).isEqualTo(1);
        assertThat(lopCoBai(kiThi)).containsExactly(lopMot);
    }

    @Test
    @Order(8)
    @DisplayName("Giáo viên không sửa và không xoá được kì thi chung của khóa")
    void giaoVienKhongSuaDuocKiThiKhoa() throws Exception {
        long kiThi = taoKiThiKhoa("Ki thi chung bat kha xam pham");
        goi(HttpMethod.PUT, "/api/exams/" + kiThi, thanKiThi("COURSE", khoa, "Bi sua trom"),
                403, giaoVien, "TEACHER");
        goi(HttpMethod.POST, "/api/exams/" + kiThi + "/publish", null, 403, giaoVien, "TEACHER");
        goi(HttpMethod.DELETE, "/api/exams/" + kiThi, null, 403, giaoVien, "TEACHER");
    }

    @Test
    @Order(9)
    @DisplayName("Giáo viên vẫn đọc được kì thi chung chạm tới lớp mình")
    void giaoVienDocDuocKiThiKhoaChamToiLopMinh() throws Exception {
        long kiThi = taoKiThiKhoa("Ki thi chung cho ca khoa");

        assertThat(coTrongDanhSach(kiThi, giaoVien))
                .as("""
                        Kì thi chung do admin ra vẫn là kì thi học sinh của họ phải làm. Giấu đi thì giáo viên
                        không biết mà chuẩn bị, rồi đến ngày thi mới thấy bài lạ trong lớp mình.""")
                .isTrue();
        assertThat(coTrongDanhSach(kiThi, giaoVienLa))
                .as("còn giáo viên không dạy lớp nào của khóa thì không có việc gì ở đây")
                .isFalse();
    }

    @Test
    @Order(10)
    @DisplayName("Đề còn là bản nháp thì không gắn vào kì thi được")
    void deConNhapThiKhongGanDuoc() throws Exception {
        long nhap = taoBanDeNhap();
        goi(HttpMethod.POST, "/api/exams", """
                {"scope":"COURSE","courseInstanceId":%d,"title":"Gan de nhap","worksheetVersionId":%d,
                 "openAt":"%s","dueAt":"%s","maxAttempts":1,"latePolicy":"REJECT",
                 "answerReveal":"AFTER_RETURN","countsInGradebook":true}
                """.formatted(khoa, nhap, MO, HAN), 400, quanTri, "ADMIN");
    }

    // ==================== đọc ====================

    private List<Long> lopCoBai(long kiThiId) {
        return jdbc.queryForList(
                "select class_id from assignments where exam_id=? and deleted_at is null", Long.class, kiThiId);
    }

    private int soBai(long kiThiId) {
        return jdbc.queryForObject(
                "select count(*) from assignments where exam_id=? and deleted_at is null", Integer.class, kiThiId);
    }

    private <T> T taiBai(long kiThiId, long lopId, String cot, Class<T> kieu) {
        return jdbc.queryForObject(
                "select " + cot + " from assignments where exam_id=? and class_id=? and deleted_at is null",
                kieu, kiThiId, lopId);
    }

    private boolean coTrongDanhSach(long kiThiId, long nguoi) throws Exception {
        for (JsonNode e : duLieu(goi(HttpMethod.GET, "/api/exams", null, 200, nguoi, "TEACHER"))) {
            if (e.get("id").asLong() == kiThiId) return true;
        }
        return false;
    }

    // ==================== gọi và dựng ====================

    private long taoKiThiKhoa(String ten) throws Exception {
        return duLieu(goi(HttpMethod.POST, "/api/exams", thanKiThi("COURSE", khoa, ten), 200, quanTri, "ADMIN"))
                .get("id").asLong();
    }

    private String thanKiThi(String tamVoi, long noiId, String ten) {
        String cot = "COURSE".equals(tamVoi) ? "courseInstanceId" : "classId";
        return """
                {"scope":"%s","%s":%d,"title":"%s","worksheetVersionId":%d,"durationMinutes":45,
                 "openAt":"%s","dueAt":"%s","maxAttempts":1,"latePolicy":"REJECT",
                 "answerReveal":"AFTER_RETURN","countsInGradebook":true}
                """.formatted(tamVoi, cot, noiId, ten, banDe, MO, HAN);
    }

    /**
     * {@code mongDoi} là mã HTTP thật, không phải {@code code} trong phong bì. Tạo mới trả HTTP 200
     * với {@code code:201} bên trong — ApiEnvelope của dự án là vậy, đừng sửa test thành 201.
     */
    private String goi(HttpMethod phuongThuc, String duongDan, String than, int mongDoi, long nguoi, String vai)
            throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(phuongThuc, duongDan)
                .with(authentication(danhTinh(nguoi, vai)));
        if (than != null) yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content(than);
        var phanHoi = mockMvc.perform(yeuCau).andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("%s %s → %s", phuongThuc, duongDan, noiDung).isEqualTo(mongDoi);
        return noiDung;
    }

    private JsonNode duLieu(String than) throws Exception {
        return json.readTree(than).get("data");
    }

    /** Một bản đề đã phát hành: chỉ bản PUBLISHED mới gắn được vào kì thi. */
    private long taoBanDe() {
        long phieu = taoPhieu();
        return jdbc.queryForObject("""
                insert into worksheet_versions (worksheet_id, version, status, published_at, created_by,
                                                created_at, updated_at)
                values (?, 1, 'PUBLISHED', now(), ?, now(), now())
                returning id""", Long.class, phieu, quanTri);
    }

    private long taoBanDeNhap() {
        long phieu = taoPhieu();
        return jdbc.queryForObject("""
                insert into worksheet_versions (worksheet_id, version, status, created_by, created_at, updated_at)
                values (?, 1, 'DRAFT', ?, now(), now())
                returning id""", Long.class, phieu, quanTri);
    }

    private long taoPhieu() {
        return jdbc.queryForObject("""
                insert into worksheets (name, columns_count, show_qr, show_student_fields, status, created_by,
                                        created_at, updated_at)
                values (?, 1, true, true, 'PUBLISHED', ?, now(), now())
                returning id""", Long.class, "De ki thi " + dem.incrementAndGet(), quanTri);
    }

    private long taoKhoa() {
        long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-KITHI', 'Toan 10 ki thi', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mau ki thi', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        LocalDate batDau = LocalDate.now().minusMonths(1);
        return jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status,
                                              created_at, updated_at)
                values (?, 'Khoa ki thi', '2026-2027-KT', ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau,
                java.sql.Date.valueOf(batDau), java.sql.Date.valueOf(batDau.plusYears(1)));
    }

    private void gan(long lopId, long khoaId) {
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) "
                + "values (?,?,now(),now())", lopId, khoaId);
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

    private long taoNguoiDung(String vai, String ten) {
        String duyNhat = ten + "-" + dem.incrementAndGet();
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, duyNhat + "@kithi.test", ten, duyNhat, vai);
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@kithi.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
