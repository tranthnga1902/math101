package com.math10.assignments;

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
import org.springframework.dao.DuplicateKeyException;
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
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Chốt buổi của một lớp: ghi lại một sự kiện đã xảy ra, và mở những bài đã neo vào tiết ấy.
 *
 * <p><b>Buổi vẫn không mang ngày.</b> {@code program_periods} nói thứ tự dạy, {@code course_weeks}
 * nói tuần nào, còn {@code class_period_progress} chỉ ghi "lớp này học xong tiết kia lúc nào". Ba
 * thứ tách nhau vì lớp dạy bù thứ Bảy không được phép đẩy lịch của mọi lớp khác — nên ca đầu tiên
 * ghim đúng chỗ đó: giờ chốt nhận từ ngoài, không phải giờ bấm nút.
 *
 * <p><b>Ranh giới đắt nhất nằm ở ca thứ ba.</b> Bài neo vào buổi để {@code open_at} rỗng cho tới
 * lúc lớp chốt. Theo javadoc của {@code Assignment.openAt} thì rỗng nghĩa là "mở ngay", nên nếu
 * nhánh chờ-neo hỏng thì bài hở ra ngay khi phát hành — không lỗi, không báo, chỉ là học sinh thấy
 * đề trước buổi học. Ca này khẳng định cả hai lượt: kín trước khi chốt, mở sau khi chốt.
 *
 * <p><b>Bỏ chốt không đóng bài lại.</b> Mở rồi là học sinh đã thấy đề; rút lại chỉ tạo ra một lớp
 * học sinh đã chép đề và một lớp chưa. Ca thứ tư ghim điều đó vì đường "bỏ chốt rồi chốt lại cho
 * đúng ngày" chắc chắn sẽ có người dùng.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Chốt buổi của lớp")
class ChotBuoiCuaLopTest {

    /**
     * Thứ Hai tuần trước; tuần N của khóa bắt đầu từ đây cộng (N-1) tuần.
     *
     * <p>Lịch neo vào tuần đang chạy chứ không phải một ngày cố định, vì cửa đọc bài giao hỏi
     * {@code LocalDateTime.now()} để tính trạng thái. Đóng cứng tháng 9/2026 thì hôm nay test xanh,
     * sang năm cả bộ đỏ vì "mở rồi" hóa thành "chưa tới giờ" — mà đó là lỗi của lịch test, không
     * phải của mã.
     */
    private static final LocalDate TUAN_MOT = LocalDate.now().with(DayOfWeek.MONDAY).minusWeeks(1);
    /** Giờ dạy thật, đã xảy ra: chốt buổi là ghi lại việc đã rồi, không phải hẹn trước. */
    private static final LocalDateTime GIO_DAY = LocalDate.now().minusDays(1).atTime(19, 30);
    /** Tiết mở bài ở tuần 3; tuần học kế tiếp là tuần 4, lùi 120 phút đệm ra 22:00 Chủ nhật trước đó. */
    private static final LocalDateTime HAN_MONG_DOI = TUAN_MOT.plusWeeks(3).atStartOfDay().minusMinutes(120);

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private final AtomicInteger dem = new AtomicInteger();

    private long giaoVien;
    private long lop;
    private long khoa;
    private long baiHoc;
    private long tietGhiMoc;
    private long tietMoBai;
    private long tietGoiY;
    private long tietLac;
    private long phieuGoiY;

    @BeforeAll
    void dungDuLieu() {
        giaoVien = taoNguoiDung("TEACHER", "Co Nga");

        long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-CHOTBUOI', 'Toan 10 chot buoi', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Menh de va tap hop', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        baiHoc = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Menh de', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);
        long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mau chot buoi', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status,
                                              created_at, updated_at)
                values (?, 'Khoa chot buoi', '2026-2027-CB', ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau,
                java.sql.Date.valueOf(TUAN_MOT), java.sql.Date.valueOf(TUAN_MOT.plusYears(1)));

        long mach = jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, 'DS', 'Dai so', 1, now(), now())
                returning id""", Long.class, chuongTrinh);
        tietGhiMoc = tiet(mach, 1, 1, "Tiet ghi moc");
        tietMoBai = tiet(mach, 2, 3, "Tiet mo bai neo");
        tietGoiY = tiet(mach, 3, 4, "Tiet co phieu goi y");

        // Bốn tuần có ngày: mỗi tiết ở tuần N cần tuần N+1 tồn tại thì mới suy ra được hạn.
        for (int i = 1; i <= 5; i++) tuan(i, TUAN_MOT.plusWeeks(i - 1L));

        lop = taoLop();
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())",
                lop, khoa);

        // Một tiết của chương trình khác hẳn: lớp không với tới được nó qua class_courses.
        long chuongTrinhLa = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN11-CHOTBUOI', 'Toan 11 chot buoi', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        long machLa = jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, 'HH', 'Hinh hoc lop khac', 1, now(), now())
                returning id""", Long.class, chuongTrinhLa);
        tietLac = tiet(machLa, 1, 1, "Tiet cua chuong trinh khac");

        phieuGoiY = taoPhieu();
        jdbc.update("""
                insert into program_resources (lesson_id, resource_type, resource_ref_id, title, order_index,
                                               status, audience, created_at, updated_at)
                values (?, 'EXERCISE', ?, 'Phieu bai tap tiet 3', 10, 'PUBLISHED', 'STUDENT_ALLOWED', now(), now())""",
                baiHoc, phieuGoiY);
    }

    // ==================== ghi mốc ====================

    @Test
    @Order(1)
    @DisplayName("Chốt buổi ghi đúng một dòng, và giữ giờ dạy thật chứ không phải giờ bấm nút")
    void chotBuoiGhiMotDongVaGiuGioDayThat() throws Exception {
        JsonNode ra = duLieu(goi(HttpMethod.POST, "/api/classes/" + lop + "/periods/" + tietGhiMoc + "/close",
                """
                {"closedAt":"%s","note":"Day bu toi thu Bay"}""".formatted(GIO_DAY), 200));

        assertThat(ra.get("closedAt").asText())
                .as("""
                        Dạy bù tối thứ Bảy mà Chủ nhật mới bấm là chuyện thường. Ghi giờ bấm thay giờ dạy
                        sẽ đẩy giờ mở bài của cả lớp đi một ngày, và không có gì báo.""")
                .startsWith(GIO_DAY.toString());
        assertThat(soDongChot(tietGhiMoc)).isEqualTo(1);
        assertThat(jdbc.queryForObject(
                "select note from class_period_progress where class_id=? and period_id=? and deleted_at is null",
                String.class, lop, tietGhiMoc)).isEqualTo("Day bu toi thu Bay");
    }

    @Test
    @Order(2)
    @DisplayName("Chốt hai lần bị từ chối, và chỉ mục là chốt chặn cuối")
    void chotHaiLanBiChanOCaHaiLop() throws Exception {
        String loi = goi(HttpMethod.POST, "/api/classes/" + lop + "/periods/" + tietGhiMoc + "/close", "{}", 400);

        assertThat(loi).contains("đã chốt rồi");
        assertThat(soDongChot(tietGhiMoc))
                .as("từ chối mà vẫn ghi thêm dòng thì lần chốt sau đè giờ dạy của lần trước")
                .isEqualTo(1);

        assertThatThrownBy(() -> jdbc.update("""
                insert into class_period_progress (class_id, period_id, closed_at, closed_by, created_at, updated_at)
                values (?, ?, now(), ?, now(), now())""", lop, tietGhiMoc, giaoVien))
                .as("""
                        Câu kiểm trong controller là lớp chắn thứ nhất; chỉ mục duy nhất là lớp thứ hai.
                        Thiếu lớp thứ hai thì hai lượt bấm cùng lúc lọt cả hai, vì cả hai đều đọc trước khi ghi.""")
                .isInstanceOf(DuplicateKeyException.class);
    }

    // ==================== mở bài đã neo ====================

    @Test
    @Order(3)
    @DisplayName("Bài neo kín trước khi chốt, mở ngay sau khi chốt")
    void chotBuoiMoBaiDaNeoVaoTiet() throws Exception {
        long bai = taoBaiNeo(tietMoBai, "Bai tap tiet 2");

        JsonNode truoc = timBai(bai);
        assertThat(truoc.get("state").asText())
                .as("""
                        Chưa chốt buổi thì bài phải ở SCHEDULED. open_at rỗng vốn có nghĩa "mở ngay", nên
                        đây đúng là chỗ mà một nhánh thiếu sẽ hở nguyên đề ra trước buổi học.""")
                .isEqualTo("SCHEDULED");
        assertThat(truoc.get("openAt").isNull()).isTrue();
        assertThat(truoc.get("anchorPeriodLabel").asText())
                .as("màn hình phải gọi tên buổi bằng chữ giáo viên nói, không phải bằng id")
                .contains("tiết 2");

        JsonNode chot = duLieu(goi(HttpMethod.POST, "/api/classes/" + lop + "/periods/" + tietMoBai + "/close",
                """
                {"closedAt":"%s"}""".formatted(GIO_DAY), 200));
        assertThat(chot.get("assignmentsOpened").asInt())
                .as("chốt buổi mà không mở bài neo thì bài nằm im, không lỗi, chỉ là học sinh không thấy")
                .isEqualTo(1);

        JsonNode sau = timBai(bai);
        assertThat(sau.get("state").asText()).isEqualTo("OPEN");
        assertThat(sau.get("openAt").asText()).startsWith(GIO_DAY.toString());
        assertThat(sau.get("dueAt").asText())
                .as("""
                        Tiết ở tuần 3, tuần học kế tiếp là tuần 4; đệm mặc định 120 phút lùi hạn về 22:00
                        Chủ nhật liền trước. Lịch chỉ mịn tới tuần, nên hạn là đầu tuần sau chứ không phải
                        giờ của buổi liền sau — muộn hơn thì học sinh vẫn kịp, đoán sớm hơn thì có em mất bài.""")
                .startsWith(HAN_MONG_DOI.toString());
    }

    @Test
    @Order(4)
    @DisplayName("Bỏ chốt không đóng lại bài đã mở")
    void boChotKhongDongLaiBaiDaMo() throws Exception {
        long bai = timBaiTheoTiet(tietMoBai);
        String moTruoc = timBai(bai).get("openAt").asText();

        goi(HttpMethod.DELETE, "/api/classes/" + lop + "/periods/" + tietMoBai + "/close", null, 200);

        JsonNode sau = timBai(bai);
        assertThat(sau.get("state").asText())
                .as("""
                        Mở rồi là học sinh đã thấy đề. Rút lại chỉ tạo ra một nửa lớp đã chép đề và một nửa
                        chưa, mà điểm thì vẫn chấm chung.""")
                .isEqualTo("OPEN");
        assertThat(sau.get("openAt").asText()).isEqualTo(moTruoc);
        assertThat(soDongChot(tietMoBai)).isZero();
    }

    @Test
    @Order(5)
    @DisplayName("Bỏ chốt rồi chốt lại được, và lần này không đụng bài đã mở")
    void chotLaiSauKhiBoChotVaKhongDungBaiDaMo() throws Exception {
        long bai = timBaiTheoTiet(tietMoBai);
        JsonNode truoc = timBai(bai);

        JsonNode chot = duLieu(goi(HttpMethod.POST, "/api/classes/" + lop + "/periods/" + tietMoBai + "/close",
                """
                {"closedAt":"%s","note":"Chot lai cho dung ngay"}""".formatted(GIO_DAY.plusHours(1)), 200));

        assertThat(soDongChot(tietMoBai))
                .as("""
                        "Bỏ chốt rồi chốt lại cho đúng ngày" chắc chắn có người dùng. Câu kiểm trùng mà quên
                        lọc deleted_at thì dòng đã xoá vẫn chặn, và buổi ấy không bao giờ chốt lại được.""")
                .isEqualTo(1);
        assertThat(chot.get("assignmentsOpened").asInt())
                .as("""
                        Bài đã mở thì lần chốt sau không được dịch nữa. Đây là ranh giới dễ vỡ nhất: dịch hạn
                        của bài học sinh đang làm dở, dù dịch ra xa hơn, cũng là đổi luật chơi giữa chừng.""")
                .isZero();

        JsonNode sau = timBai(bai);
        assertThat(sau.get("openAt").asText()).isEqualTo(truoc.get("openAt").asText());
        assertThat(sau.get("dueAt").asText()).isEqualTo(truoc.get("dueAt").asText());
    }

    // ==================== hai cửa chặn ====================

    @Test
    @Order(6)
    @DisplayName("Tiết ngoài chương trình của lớp thì không chốt được")
    void tietNgoaiChuongTrinhCuaLopThiKhongChotDuoc() throws Exception {
        String loi = goi(HttpMethod.POST, "/api/classes/" + lop + "/periods/" + tietLac + "/close", "{}", 400);

        assertThat(loi)
                .as("""
                        Không chặn ở đây thì giáo viên chốt nhầm tiết của chương trình khác, bảng tiến độ có
                        một dòng vô nghĩa, và NeoBuoi.tinh sau đó trả về "lớp chưa gắn khóa" cho một tiết
                        không ai hiểu ở đâu ra.""")
                .contains("không thuộc chương trình của lớp");
        assertThat(soDongChot(tietLac)).isZero();
    }

    @Test
    @Order(7)
    @DisplayName("Chốt xong gợi ý đúng phiếu gắn với bài học của tiết")
    void chotXongGoiYPhieuCuaTiet() throws Exception {
        JsonNode ra = duLieu(goi(HttpMethod.POST, "/api/classes/" + lop + "/periods/" + tietGoiY + "/close", "{}", 200));

        List<Long> phieu = ra.get("suggestions").findValues("worksheet_id").stream()
                .map(JsonNode::asLong).toList();
        assertThat(phieu)
                .as("""
                        Gợi ý đi qua đúng luật đọc của module phân phối (LuongNoiDung.docDuocDayDu). Viết
                        điều kiện thứ hai ở đây là cách lỗ trước đã sống lâu như vậy: hai luật cùng trả lời
                        "mục này ai đọc được" rồi lệch nhau.""")
                .contains(phieuGoiY);
    }

    // ==================== gọi và đọc ====================

    /** Gọi cửa và đòi đúng mã đã dự đoán; trả về thân để soi câu từ chối. */
    private String goi(HttpMethod phuongThuc, String duongDan, String than, int mongDoi) throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(phuongThuc, duongDan)
                .with(authentication(danhTinh(giaoVien, "TEACHER")));
        if (than != null) yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content(than);
        var phanHoi = mockMvc.perform(yeuCau).andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("%s %s → %s", phuongThuc, duongDan, noiDung).isEqualTo(mongDoi);
        return noiDung;
    }

    private JsonNode duLieu(String than) throws Exception {
        return json.readTree(than).get("data");
    }

    private JsonNode timBai(long baiId) throws Exception {
        for (JsonNode bai : duLieu(goi(HttpMethod.GET, "/api/assignments?classId=" + lop, null, 200))) {
            if (bai.get("id").asLong() == baiId) return bai;
        }
        throw new AssertionError("Không thấy bài giao " + baiId + " trong danh sách của lớp");
    }

    private long timBaiTheoTiet(long tietId) {
        return jdbc.queryForObject(
                "select id from assignments where class_id=? and anchor_period_id=? and deleted_at is null",
                Long.class, lop, tietId);
    }

    private int soDongChot(long tietId) {
        return jdbc.queryForObject("""
                select count(*) from class_period_progress
                where class_id=? and period_id=? and deleted_at is null""", Integer.class, lop, tietId);
    }

    // ==================== dựng dữ liệu ====================

    private long taoBaiNeo(long tietId, String ten) throws Exception {
        return duLieu(goi(HttpMethod.POST, "/api/assignments", """
                {"classId":%d,"worksheetId":%d,"title":"%s","status":"PUBLISHED",
                 "requirement":"BAT_BUOC","anchorPeriodId":%d,"maxAttempts":1,"latePolicy":"REJECT",
                 "latePenaltyPercent":0}
                """.formatted(lop, taoPhieu(), ten, tietId), 200)).get("id").asLong();
    }

    private long tiet(long mach, int soTiet, int soTuan, String ten) {
        return jdbc.queryForObject("""
                insert into program_periods (strand_id, period_no, week_no, term, lesson_id, title, period_kind,
                                             created_at, updated_at)
                values (?, ?, ?, 1, ?, ?, 'BAI_MOI', now(), now())
                returning id""", Long.class, mach, soTiet, soTuan, baiHoc, ten);
    }

    private void tuan(int soTuan, LocalDate batDau) {
        jdbc.update("""
                insert into course_weeks (course_instance_id, week_no, starts_on, ends_on, is_break, break_label,
                                          edited_by_hand, created_at, updated_at)
                values (?, ?, ?, ?, false, null, false, now(), now())""",
                khoa, soTuan, java.sql.Date.valueOf(batDau), java.sql.Date.valueOf(batDau.plusDays(6)));
    }

    private long taoPhieu() {
        return jdbc.queryForObject("""
                insert into worksheets (name, columns_count, show_qr, show_student_fields, status, created_by,
                                        created_at, updated_at)
                values (?, 1, true, true, 'PUBLISHED', ?, now(), now())
                returning id""", Long.class, "Phieu chot buoi " + dem.incrementAndGet(), giaoVien);
    }

    private long taoLop() {
        String ma = "CHOTBUOI-" + dem.incrementAndGet();
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        long moi = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, ma, ma, khoi);
        jdbc.update("insert into class_teachers (class_id, teacher_id, created_at, updated_at) values (?,?,now(),now())",
                moi, giaoVien);
        return moi;
    }

    private long taoNguoiDung(String vai, String ten) {
        String duyNhat = ten + "-" + dem.incrementAndGet();
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, duyNhat + "@chotbuoi.test", ten, duyNhat, vai);
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@chotbuoi.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
