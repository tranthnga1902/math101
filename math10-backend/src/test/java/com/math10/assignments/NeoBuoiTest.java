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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Suy hạn nộp từ buổi: đổi câu "nộp trước buổi sau" thành một mốc giờ thật.
 *
 * <p>Ba ranh giới dễ vỡ, mỗi ranh giới một ca:
 *
 * <p><b>Tuần nghỉ nhận ra bằng {@code week_no} rỗng, không phải bằng cờ {@code is_break}.</b>
 * Câu hỏi "học lại vào tuần nào" mà thiếu vế {@code week_no is not null} thì vẫn chạy, vẫn trả về
 * một ngày hợp lệ — chỉ là ngày ấy nằm giữa kỳ nghỉ Tết. Không có lỗi, không có cảnh báo, chỉ là
 * cả lớp có hạn nộp vào mùng ba. Ca thứ hai khẳng định cả hai chiều: đúng tuần 4, và <em>không
 * phải</em> tuần nghỉ liền trước nó.
 *
 * <p><b>Suy không ra thì phải nói là không ra.</b> Khóa chưa xếp lịch tới tuần của tiết, hoặc tiết
 * nằm ở tuần cuối cùng và sau đó không còn tuần học nào — hai chuyện khác nhau, và cả hai đều
 * không được sinh ra một ngày đoán. Đoán một ngày thì màn hình hiện ngày đó, giáo viên tin, và
 * học sinh mất bài. Ca thứ ba ghim cả hai lý do bằng đúng từng chữ, vì đó là chữ hiện lên màn hình.
 *
 * <p><b>Bài đã mở thì lịch đổi cũng không đụng tới.</b> Đây là chỗ đắt nhất. Dời buổi là chuyện
 * của buổi chưa dạy; bài đã mở là bài học sinh đang làm dở, dịch hạn của nó — kể cả dịch ra xa
 * hơn — cũng là đổi luật chơi giữa chừng, còn dịch gần lại thì có em vừa mất bài. Ca thứ tư dời
 * lịch <b>hai lượt</b> và khẳng định sau cả hai lượt: một lượt giữ được có thể chỉ là vì lượt ấy
 * tính ra đúng con số cũ.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Neo bài giao vào buổi")
class NeoBuoiTest {

    /**
     * Thứ Hai tuần trước; tuần N của khóa bắt đầu từ đây cộng (N-1) tuần, trừ tuần nghỉ chen vào.
     *
     * <p>Lịch neo vào tuần đang chạy chứ không phải một ngày cố định, vì trạng thái bài giao hỏi
     * {@code LocalDateTime.now()}. Đóng cứng một tháng thì hôm nay test xanh, sang năm cả bộ đỏ vì
     * "đã mở" hóa thành "chưa tới giờ" — lỗi của lịch test, không phải của mã.
     */
    private static final LocalDate TUAN_MOT = LocalDate.now().with(DayOfWeek.MONDAY).minusWeeks(1);
    /** Giờ dạy thật, đã xảy ra: chốt buổi là ghi lại việc đã rồi. */
    private static final LocalDateTime GIO_DAY = LocalDate.now().minusDays(1).atTime(19, 30);
    /** Đệm mặc định của {@code NeoBuoi}: hạn lùi khỏi đầu tuần sau đúng chừng này phút. */
    private static final int DEM_MAC_DINH = 120;

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private final AtomicInteger dem = new AtomicInteger();

    private long giaoVien;
    private long quanTri;
    private long lop;
    private long khoa;
    private long baiHoc;

    private long tietTuanMot;
    private long tietTruocTet;
    private long tietDaMo;
    private long tietChuaMo;
    private long tietTuanCuoi;
    private long tietTuanChuaXep;

    private long baiDaMo;
    private long baiChuaMo;

    @BeforeAll
    void dungDuLieu() {
        giaoVien = taoNguoiDung("TEACHER", "Co Nga neo");
        quanTri = taoNguoiDung("ADMIN", "Quan tri neo");

        long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-NEOBUOI', 'Toan 10 neo buoi', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Ham so bac hai', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        baiHoc = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Parabol', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);
        long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mau neo buoi', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status,
                                              created_at, updated_at)
                values (?, 'Khoa neo buoi', '2026-2027-NB', ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau,
                java.sql.Date.valueOf(TUAN_MOT), java.sql.Date.valueOf(TUAN_MOT.plusYears(1)));

        long mach = jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, 'DS', 'Dai so', 1, now(), now())
                returning id""", Long.class, chuongTrinh);

        tietTuanMot = tiet(mach, 1, 1, "Tiet tuan mot");
        tietTruocTet = tiet(mach, 2, 3, "Tiet cuoi truoc Tet");
        tietDaMo = tiet(mach, 3, 3, "Tiet se chot");
        tietChuaMo = tiet(mach, 4, 3, "Tiet chua chot");
        tietTuanCuoi = tiet(mach, 5, 5, "Tiet tuan cuoi cua lich");
        tietTuanChuaXep = tiet(mach, 6, 9, "Tiet o tuan khoa chua xep");

        // Tuần 1..3 liền nhau, rồi một tuần NGHỈ không mang số, rồi tuần 4 và 5.
        // Tuần nghỉ nằm đúng chỗ mà "tuần kế tiếp của tuần 3" sẽ vấp phải.
        tuan(1, TUAN_MOT);
        tuan(2, TUAN_MOT.plusWeeks(1));
        tuan(3, TUAN_MOT.plusWeeks(2));
        tuanNghi(TUAN_MOT.plusWeeks(3), "Nghi Tet");
        tuan(4, TUAN_MOT.plusWeeks(4));
        tuan(5, TUAN_MOT.plusWeeks(5));

        lop = taoLop();
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())",
                lop, khoa);
    }

    // ==================== suy hạn ====================

    @Test
    @Order(1)
    @DisplayName("Hạn là đầu tuần học kế tiếp trừ đệm, và đệm sửa được")
    void hanLaDauTuanKeTiepTruDem() throws Exception {
        JsonNode mac = han(tietTuanMot, null);

        assertThat(mac.get("hanNop").asText())
                .as("""
                        Lịch chỉ mịn tới tuần, nên hạn là đầu tuần học sau chứ không phải giờ của buổi liền
                        sau: một tuần ba tiết thì buổi liền sau còn nằm trong chính tuần ấy. Muộn hơn thì
                        học sinh vẫn kịp; đoán sớm hơn thì có em mất bài.""")
                .startsWith(TUAN_MOT.plusWeeks(1).atStartOfDay().minusMinutes(DEM_MAC_DINH).toString());
        assertThat(mac.get("lyDoTrong").isNull())
                .as("suy ra được thì không kèm lý do — màn hình đọc lý do để quyết định có hiện ngày hay không")
                .isTrue();
        assertThat(mac.get("moLuc").isNull())
                .as("""
                        Chưa chốt buổi thì chưa có giờ mở. Trả về một giờ mở đoán ở đây là mở đề trước buổi
                        học, mà cửa xem trước lại chính là cửa vật hóa nên nó sẽ được ghi thẳng vào bảng.""")
                .isTrue();

        assertThat(han(tietTuanMot, 30).get("hanNop").asText())
                .as("đệm là tham số của giáo viên; cứng hóa 120 phút thì lớp học tối không lùi hạn được")
                .startsWith(TUAN_MOT.plusWeeks(1).atStartOfDay().minusMinutes(30).toString());
    }

    @Test
    @Order(2)
    @DisplayName("Hạn nhảy qua tuần nghỉ Tết chứ không rơi vào giữa kỳ nghỉ")
    void hanNhayQuaTuanNghiTet() throws Exception {
        String hanNop = han(tietTruocTet, null).get("hanNop").asText();

        assertThat(hanNop)
                .as("""
                        Tiết ở tuần 3; dòng lịch ngay sau nó là tuần nghỉ, dòng học kế tiếp mới là tuần 4.
                        Phải nhảy qua dòng nghỉ để ra đầu tuần 4.""")
                .startsWith(TUAN_MOT.plusWeeks(4).atStartOfDay().minusMinutes(DEM_MAC_DINH).toString());
        assertThat(hanNop)
                .as("""
                        Vế phủ định mới là vế bắt lỗi. Tuần nghỉ nhận ra bằng week_no rỗng, không bằng cờ
                        is_break; thiếu vế "week_no is not null" thì câu vẫn chạy, vẫn ra một ngày hợp lệ,
                        chỉ là hạn nộp rơi vào mùng ba Tết và không có gì báo.""")
                .doesNotStartWith(TUAN_MOT.plusWeeks(3).atStartOfDay().minusMinutes(DEM_MAC_DINH).toString());
    }

    @Test
    @Order(3)
    @DisplayName("Suy không ra thì hạn rỗng kèm lý do, không bao giờ ra một ngày đoán")
    void tuanChuaCoNgayThiHanRongKemLyDo() throws Exception {
        JsonNode chuaXep = han(tietTuanChuaXep, null);
        assertThat(chuaXep.get("hanNop").isNull())
                .as("""
                        Chương trình dài hơn lịch đã xếp là chuyện thường giữa năm. Đoán một ngày ở đây thì
                        màn hình hiện ngày đó, giáo viên tin nó, và cả lớp nhận hạn sai.""")
                .isTrue();
        assertThat(chuaXep.get("lyDoTrong").asText())
                .as("lý do là chữ hiện thẳng lên màn hình, nên ghim đúng từng chữ")
                .isEqualTo("khóa chưa xếp lịch tới tuần 9");

        JsonNode hetLich = han(tietTuanCuoi, null);
        assertThat(hetLich.get("hanNop").isNull()).isTrue();
        assertThat(hetLich.get("lyDoTrong").asText())
                .as("""
                        "Chưa xếp tới tuần ấy" và "sau tuần ấy hết lịch" là hai chuyện khác nhau: một cái
                        chờ quản trị xếp thêm, một cái là tiết cuối khóa và giáo viên phải tự đặt hạn.
                        Gộp một câu thì người đọc không biết phải làm gì tiếp.""")
                .isEqualTo("sau tuần 5 khóa không còn tuần học nào");
    }

    // ==================== dời lịch ====================

    @Test
    @Order(4)
    @DisplayName("Dời lịch dịch bài chưa mở và không đụng bài đã mở, qua hai lượt dời")
    void doiLichDichBaiChuaMoVaKhongDungBaiDaMo() throws Exception {
        // Hai bài cùng neo vào tuần 3, nên hạn của cả hai đều suy ra từ đầu tuần 4.
        // Dời tuần 4 một phát là chạm vào cả hai — chỉ khác nhau ở chỗ một bài đã mở.
        baiDaMo = taoBaiNeo(tietDaMo, "Bai da mo");
        baiChuaMo = taoBaiNeo(tietChuaMo, "Bai chua mo");

        JsonNode chot = duLieu(goi(HttpMethod.POST, "/api/classes/" + lop + "/periods/" + tietDaMo + "/close",
                """
                {"closedAt":"%s"}""".formatted(GIO_DAY), 200, giaoVien, "TEACHER"));
        assertThat(chot.get("assignmentsOpened").asInt()).isEqualTo(1);

        assertThat(timBai(baiDaMo).get("state").asText()).isEqualTo("OPEN");
        assertThat(timBai(baiChuaMo).get("state").asText()).isEqualTo("SCHEDULED");

        String moCuaBaiDaMo = timBai(baiDaMo).get("openAt").asText();
        String hanCuaBaiDaMo = timBai(baiDaMo).get("dueAt").asText();
        assertThat(hanCuaBaiDaMo)
                .startsWith(TUAN_MOT.plusWeeks(4).atStartOfDay().minusMinutes(DEM_MAC_DINH).toString());

        // Lượt 1 — nghỉ lễ hai ngày đầu tuần 4, dạy bù từ thứ Tư.
        LocalDate boLai = TUAN_MOT.plusWeeks(4).plusDays(2);
        doiTuan(4, boLai, TUAN_MOT.plusWeeks(5).minusDays(1));

        assertThat(timBai(baiChuaMo).get("dueAt").asText())
                .as("""
                        Đây là lý do neo tồn tại. Không dịch thì giáo viên phải sửa tay từng bài, sót một
                        bài là học sinh nhận hạn của lịch cũ mà không có gì báo.""")
                .startsWith(boLai.atStartOfDay().minusMinutes(DEM_MAC_DINH).toString());
        khangDinhBaiDaMoKhongDoi(moCuaBaiDaMo, hanCuaBaiDaMo, "lượt dời thứ nhất");

        // Lượt 2 — trả tuần 4 về chỗ cũ.
        doiTuan(4, TUAN_MOT.plusWeeks(4), TUAN_MOT.plusWeeks(4).plusDays(6));

        assertThat(timBai(baiChuaMo).get("dueAt").asText())
                .as("dời đi rồi dời về phải quay đúng chỗ cũ, nếu không thì mỗi lần sửa lịch hạn lại trôi thêm")
                .startsWith(TUAN_MOT.plusWeeks(4).atStartOfDay().minusMinutes(DEM_MAC_DINH).toString());
        khangDinhBaiDaMoKhongDoi(moCuaBaiDaMo, hanCuaBaiDaMo, "lượt dời thứ hai");
    }

    /**
     * Bài đã mở phải nguyên si sau mỗi lượt dời.
     *
     * <p>Khẳng định hai lượt chứ không một: lượt đầu giữ được có thể chỉ vì lịch mới tình cờ tính
     * ra đúng con số cũ. Lượt thứ hai trả tuần về chỗ cũ, nên nếu mã <em>có</em> dịch bài đã mở thì
     * lượt hai lại làm nó đúng trở lại — chỉ khẳng định ở cuối là không thấy gì.
     */
    private void khangDinhBaiDaMoKhongDoi(String moCu, String hanCu, String luot) throws Exception {
        JsonNode bai = timBai(baiDaMo);
        assertThat(bai.get("openAt").asText())
                .as("giờ mở của bài đang làm dở bị dịch sau %s — học sinh đã thấy đề rồi", luot)
                .isEqualTo(moCu);
        assertThat(bai.get("dueAt").asText())
                .as("""
                        Hạn của bài đang làm dở bị dịch sau %s. Dịch ra xa hơn cũng là đổi luật chơi giữa
                        chừng; dịch gần lại thì có em vừa mất bài.""", luot)
                .isEqualTo(hanCu);
        assertThat(bai.get("state").asText()).isEqualTo("OPEN");
    }

    // ==================== gọi và đọc ====================

    private JsonNode han(long tietId, Integer demPhut) throws Exception {
        String duongDan = "/api/classes/" + lop + "/periods/" + tietId + "/han"
                + (demPhut == null ? "" : "?demPhut=" + demPhut);
        return duLieu(goi(HttpMethod.GET, duongDan, null, 200, giaoVien, "TEACHER"));
    }

    /** Dời một tuần của khóa qua cửa quản trị — đúng đường mà người thật đi. */
    private void doiTuan(int soTuan, LocalDate batDau, LocalDate ketThuc) throws Exception {
        long tuanId = jdbc.queryForObject(
                "select id from course_weeks where course_instance_id=? and week_no=? and deleted_at is null",
                Long.class, khoa, soTuan);
        goi(HttpMethod.PUT, "/api/admin/course-weeks/" + tuanId, """
                {"ngayBatDau":"%s","ngayKetThuc":"%s"}""".formatted(batDau, ketThuc), 200, quanTri, "ADMIN");
    }

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

    private JsonNode timBai(long baiId) throws Exception {
        for (JsonNode bai : duLieu(goi(HttpMethod.GET, "/api/assignments?classId=" + lop, null, 200,
                giaoVien, "TEACHER"))) {
            if (bai.get("id").asLong() == baiId) return bai;
        }
        throw new AssertionError("Không thấy bài giao " + baiId + " trong danh sách của lớp");
    }

    // ==================== dựng dữ liệu ====================

    private long taoBaiNeo(long tietId, String ten) throws Exception {
        return duLieu(goi(HttpMethod.POST, "/api/assignments", """
                {"classId":%d,"worksheetId":%d,"title":"%s","status":"PUBLISHED",
                 "requirement":"BAT_BUOC","anchorPeriodId":%d,"maxAttempts":1,"latePolicy":"REJECT",
                 "latePenaltyPercent":0}
                """.formatted(lop, taoPhieu(), ten, tietId), 200, giaoVien, "TEACHER")).get("id").asLong();
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

    /** Tuần nghỉ: {@code week_no} rỗng là dấu hiệu thật, cờ {@code is_break} chỉ để hiện nhãn. */
    private void tuanNghi(LocalDate batDau, String nhan) {
        jdbc.update("""
                insert into course_weeks (course_instance_id, week_no, starts_on, ends_on, is_break, break_label,
                                          edited_by_hand, created_at, updated_at)
                values (?, null, ?, ?, true, ?, false, now(), now())""",
                khoa, java.sql.Date.valueOf(batDau), java.sql.Date.valueOf(batDau.plusDays(6)), nhan);
    }

    private long taoPhieu() {
        return jdbc.queryForObject("""
                insert into worksheets (name, columns_count, show_qr, show_student_fields, status, created_by,
                                        created_at, updated_at)
                values (?, 1, true, true, 'PUBLISHED', ?, now(), now())
                returning id""", Long.class, "Phieu neo buoi " + dem.incrementAndGet(), giaoVien);
    }

    private long taoLop() {
        String ma = "NEOBUOI-" + dem.incrementAndGet();
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
                returning id""", Long.class, duyNhat + "@neobuoi.test", ten, duyNhat, vai);
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@neobuoi.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
