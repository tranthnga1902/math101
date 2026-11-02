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
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Giao bài cho ai: cả lớp, hay vài em.
 *
 * <p><b>Rỗng nghĩa là cả lớp, không phải không ai.</b> Bài CLASS không sinh dòng
 * {@code assignment_targets} nào — đó không phải tối ưu, đó là cách để em vào lớp muộn tự có bài mà
 * không cần một việc chạy nền nào đi vá lại, và em rời lớp tự rụng khỏi mọi thống kê. Đọc bảng
 * target mà không đọc {@code target_scope} thì hiểu ngược đúng 180 độ: cả lớp hóa thành không ai.
 * Hai ca đầu ghim hai nửa của luật ấy.
 *
 * <p><b>Cửa đọc giấu bài đi, nhưng cửa chặn là cửa ghi.</b> Danh sách không hiện bài học bù của em
 * khác là chuyện lịch sự; id bài giao là một số, và một số thì đoán được. Ca thứ ba gọi thẳng cổng
 * ghi bằng id của bài không dành cho mình — nếu chỉ chặn ở màn hình thì ca này đỏ, và cái nó bắt
 * được là một đường vào thật.
 *
 * <p><b>Bỏ chọn một em thì em ấy mất quyền ngay, kể cả khi đã mở bài.</b> Ca thứ ba khẳng định cả
 * chiều ngược: đổi danh sách mà dòng target cũ còn sống thì phạm vi nói một đằng, bảng nói một nẻo.
 *
 * <p><b>Rời lớp không xoá bài đã nộp.</b> Ca thứ tư tách hai chuyện hay bị gộp: em rời lớp thì rụng
 * khỏi sổ điểm và khỏi tỉ lệ nộp của lớp — đúng, vì lớp không còn em ấy — nhưng bài em đã nộp vẫn
 * nằm nguyên trong hàng chờ chấm. Chấm nốt bài của em vừa chuyển lớp là việc có thật, và nếu hàng
 * chờ cũng lọc theo sĩ số hiện tại thì bài ấy biến mất không dấu vết.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Giao bài theo đối tượng")
class GiaoBaiTheoDoiTuongTest {

    private static final LocalDateTime DA_MO = LocalDateTime.now().minusHours(1).withNano(0);
    private static final LocalDateTime CON_HAN = LocalDateTime.now().plusDays(7).withNano(0);

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private final AtomicInteger dem = new AtomicInteger();

    private long giaoVien;
    private long baiHoc;
    private long khoa;

    private long lop;
    private long emCoTen;
    private long emKhongCoTen;
    private long emVaoMuon;

    private long baiCaLop;
    private long baiHocBu;

    private long lopRoi;
    private long emNop;
    private long emChuaNop;
    private long emRoiLop;

    @BeforeAll
    void dungDuLieu() {
        giaoVien = taoNguoiDung("TEACHER", "Co Nga doi tuong");

        long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-DOITUONG', 'Toan 10 doi tuong', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Thong ke', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        baiHoc = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'So trung binh', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);
        long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mau doi tuong', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status,
                                              created_at, updated_at)
                values (?, 'Khoa doi tuong', '2026-2027-DT', ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau,
                java.sql.Date.valueOf(LocalDate.now().minusMonths(1)),
                java.sql.Date.valueOf(LocalDate.now().plusMonths(6)));

        lop = taoLop("DOITUONG");
        emCoTen = taoHocSinh(lop, "Em duoc chon");
        emKhongCoTen = taoHocSinh(lop, "Em khong duoc chon");
        emVaoMuon = taoNguoiDung("STUDENT", "Em vao lop muon");

        lopRoi = taoLop("ROILOP");
        emNop = taoHocSinh(lopRoi, "Em nop bai");
        emChuaNop = taoHocSinh(lopRoi, "Em chua nop");
        emRoiLop = taoHocSinh(lopRoi, "Em roi lop");
    }

    // ==================== cả lớp và vài em ====================

    @Test
    @Order(1)
    @DisplayName("Bài cả lớp đến mọi em, bài học bù chỉ đến em được chọn")
    void baiCaLopVaBaiHocBuDiToiDungNguoi() throws Exception {
        baiCaLop = taoBai(lop, "Bai tap ca lop", List.of());
        baiHocBu = taoBai(lop, "Bai hoc bu rieng", List.of(emCoTen));

        assertThat(phamVi(baiCaLop)).isEqualTo("CLASS");
        assertThat(phamVi(baiHocBu)).isEqualTo("SELECTED");
        assertThat(soDongTarget(baiCaLop))
                .as("""
                        Cả lớp thì không ghi dòng nào. Ghi sẵn danh sách "cho đủ" là tự tay dựng lại bài toán
                        vá danh sách mỗi lần lớp thêm bớt em — mà quên vá thì không có gì báo.""")
                .isZero();
        assertThat(soDongTarget(baiHocBu)).isEqualTo(1);

        assertThat(baiThayDuoc(emCoTen)).contains(baiCaLop, baiHocBu);
        assertThat(baiThayDuoc(emKhongCoTen))
                .as("""
                        Em không được chọn thì không được biết là bài học bù tồn tại. Hiện tên bài rồi chặn
                        lúc bấm vào cũng là nói cho cả lớp biết ai phải học lại.""")
                .contains(baiCaLop).doesNotContain(baiHocBu);

        assertThat(baiThayDuocOCuaHocSinh(emKhongCoTen))
                .as("""
                        Cửa /api/student/assignments viết bằng SQL tay, cửa /api/assignments đi qua JPA. Hai
                        đường khác nhau phải trả cùng một câu trả lời; sáu cửa đọc mà sót một là rò.""")
                .contains(baiCaLop).doesNotContain(baiHocBu);
    }

    @Test
    @Order(2)
    @DisplayName("Em vào lớp muộn tự có bài cả lớp, và không có bài học bù")
    void emVaoLopMuonTuCoBaiCaLop() throws Exception {
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())",
                lop, emVaoMuon);

        assertThat(baiThayDuoc(emVaoMuon))
                .as("""
                        Không có việc chạy nền nào vá lại danh sách sau khi em này nhập lớp — bài CLASS không
                        có danh sách để mà vá. Đây chính là lý do phạm vi được lưu bằng một chữ chứ không
                        bằng N dòng.""")
                .contains(baiCaLop)
                .doesNotContain(baiHocBu);
    }

    // ==================== cổng ghi ====================

    @Test
    @Order(3)
    @DisplayName("Cổng ghi chặn em ngoài danh sách, và bỏ chọn thì mất quyền ngay")
    void congGhiChanEmNgoaiDanhSach() throws Exception {
        goi(HttpMethod.PATCH, "/api/assignment-progress/" + baiHocBu + "/opened", null, 200, emCoTen, "STUDENT");

        goi(HttpMethod.PATCH, "/api/assignment-progress/" + baiHocBu + "/opened", null, 403,
                emKhongCoTen, "STUDENT");
        assertThat(soDongTienDo(baiHocBu))
                .as("""
                        Từ chối mà vẫn tạo dòng tiến độ thì em ngoài danh sách xuất hiện trong sổ điểm của
                        bài học bù, và giáo viên thấy một em "chưa mở" mà lẽ ra không có tên ở đó.""")
                .isEqualTo(1);

        // Đổi danh sách: giờ chỉ còn em kia.
        goi(HttpMethod.PUT, "/api/assignments/" + baiHocBu, """
                {"classId":%d,"lessonId":%d,"title":"Bai hoc bu rieng","status":"PUBLISHED",
                 "requirement":"BAT_BUOC","openAt":"%s","dueAt":"%s","maxAttempts":1,
                 "latePolicy":"REJECT","latePenaltyPercent":0,"studentIds":[%d]}
                """.formatted(lop, baiHoc, DA_MO, CON_HAN, emKhongCoTen), 200, giaoVien, "TEACHER");

        goi(HttpMethod.PATCH, "/api/assignment-progress/" + baiHocBu + "/opened", null, 403,
                emCoTen, "STUDENT");
        goi(HttpMethod.PATCH, "/api/assignment-progress/" + baiHocBu + "/opened", null, 200,
                emKhongCoTen, "STUDENT");

        assertThat(baiThayDuoc(emCoTen))
                .as("""
                        Bỏ chọn phải thu hồi được, kể cả khi em ấy đã mở bài. Dòng target cũ mà chỉ thêm chứ
                        không xoá thì danh sách chỉ nở ra, không bao giờ co lại.""")
                .doesNotContain(baiHocBu);
    }

    // ==================== rời lớp ====================

    @Test
    @Order(4)
    @DisplayName("Em rời lớp rụng khỏi tỉ lệ nộp, nhưng bài đã nộp vẫn nằm trong hàng chờ chấm")
    void emRoiLopGiuBaiDaNopVaRungKhoiTiLe() throws Exception {
        long bai = taoBai(lopRoi, "Bai cua lop co em chuyen di", List.of());
        goi(HttpMethod.PATCH, "/api/assignment-progress/" + bai + "/completed", null, 200, emNop, "STUDENT");
        goi(HttpMethod.PATCH, "/api/assignment-progress/" + bai + "/completed", null, 200, emRoiLop, "STUDENT");

        assertThat(hangChoCham(lopRoi)).contains(emNop, emRoiLop);
        assertThat(tiLeNop(lopRoi))
                .as("hai trên ba em đã nộp")
                .isEqualTo(67);
        assertThat(emTrongSoDiem(lopRoi)).contains(emNop, emChuaNop, emRoiLop);

        jdbc.update("update class_students set deleted_at=now() where class_id=? and student_id=?", lopRoi, emRoiLop);

        assertThat(hangChoCham(lopRoi))
                .as("""
                        Chấm nốt bài của em vừa chuyển lớp là việc có thật. Hàng chờ chấm hỏi assignment_progress
                        chứ không hỏi sĩ số hiện tại; lọc thêm class_students ở đây thì bài đã nộp biến mất
                        không dấu vết, và điểm ấy không bao giờ về tới em.""")
                .contains(emNop, emRoiLop);
        assertThat(emTrongSoDiem(lopRoi))
                .as("sổ điểm là bảng của lớp hiện tại, nên em đã chuyển đi không còn dòng ở đây")
                .contains(emNop, emChuaNop).doesNotContain(emRoiLop);
        assertThat(tiLeNop(lopRoi))
                .as("""
                        Một trên hai em còn lại. Rời lớp là rụng khỏi mẫu số — nếu vẫn tính thì tỉ lệ của lớp
                        bị kéo xuống bởi những em không còn học nữa, và con số ấy không sửa được bằng cách nào.""")
                .isEqualTo(50);
    }

    // ==================== đọc ====================

    private List<Long> baiThayDuoc(long hocSinh) throws Exception {
        List<Long> ket = new ArrayList<>();
        for (JsonNode bai : duLieu(goi(HttpMethod.GET, "/api/assignments?classId=" + lop, null, 200,
                hocSinh, "STUDENT"))) {
            ket.add(bai.get("id").asLong());
        }
        return ket;
    }

    private List<Long> baiThayDuocOCuaHocSinh(long hocSinh) throws Exception {
        List<Long> ket = new ArrayList<>();
        for (JsonNode bai : duLieu(goi(HttpMethod.GET, "/api/student/assignments", null, 200, hocSinh, "STUDENT"))) {
            ket.add(bai.get("id").asLong());
        }
        return ket;
    }

    private List<Long> hangChoCham(long lopId) throws Exception {
        List<Long> ket = new ArrayList<>();
        for (JsonNode dong : duLieu(goi(HttpMethod.GET, "/api/teacher/submissions?classId=" + lopId, null, 200,
                giaoVien, "TEACHER"))) {
            ket.add(dong.get("student_id").asLong());
        }
        return ket;
    }

    private List<Long> emTrongSoDiem(long lopId) throws Exception {
        List<Long> ket = new ArrayList<>();
        for (JsonNode dong : duLieu(goi(HttpMethod.GET, "/api/teacher/gradebook?classId=" + lopId, null, 200,
                giaoVien, "TEACHER"))) {
            ket.add(dong.get("student_id").asLong());
        }
        return ket;
    }

    private int tiLeNop(long lopId) throws Exception {
        for (JsonNode dong : duLieu(goi(HttpMethod.GET, "/api/teacher/class-results", null, 200,
                giaoVien, "TEACHER"))) {
            if (dong.get("classId").asLong() == lopId) return dong.get("tiLe").asInt();
        }
        throw new AssertionError("Không thấy lớp " + lopId + " trong kết quả các lớp");
    }

    private String phamVi(long baiId) {
        return jdbc.queryForObject("select target_scope from assignments where id=?", String.class, baiId);
    }

    private int soDongTarget(long baiId) {
        return jdbc.queryForObject(
                "select count(*) from assignment_targets where assignment_id=? and deleted_at is null",
                Integer.class, baiId);
    }

    private int soDongTienDo(long baiId) {
        return jdbc.queryForObject(
                "select count(*) from assignment_progress where assignment_id=? and deleted_at is null",
                Integer.class, baiId);
    }

    // ==================== gọi và dựng ====================

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

    private long taoBai(long lopId, String ten, List<Long> hocSinh) throws Exception {
        String danhSach = hocSinh.stream().map(String::valueOf).reduce((a, b) -> a + "," + b).orElse("");
        return duLieu(goi(HttpMethod.POST, "/api/assignments", """
                {"classId":%d,"lessonId":%d,"title":"%s","status":"PUBLISHED","requirement":"BAT_BUOC",
                 "openAt":"%s","dueAt":"%s","maxAttempts":1,"latePolicy":"REJECT","latePenaltyPercent":0,
                 "studentIds":[%s]}
                """.formatted(lopId, baiHoc, ten, DA_MO, CON_HAN, danhSach), 200, giaoVien, "TEACHER"))
                .get("id").asLong();
    }

    private long taoLop(String tien) {
        String ma = tien + "-" + dem.incrementAndGet();
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        long moi = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, ma, ma, khoi);
        jdbc.update("insert into class_teachers (class_id, teacher_id, created_at, updated_at) values (?,?,now(),now())",
                moi, giaoVien);
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())",
                moi, khoa);
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
                returning id""", Long.class, duyNhat + "@doituong.test", ten, duyNhat, vai);
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@doituong.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
