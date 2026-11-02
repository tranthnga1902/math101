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
import java.time.LocalDateTime;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Ba loại nhiệm vụ là ba <b>bộ giá trị mặc định</b>, không phải ba mô hình dữ liệu.
 *
 * <p><b>Bộ mặc định phải đi qua API mà còn nguyên.</b> Ba bộ ấy sống ở màn hình
 * ({@code src/teacher/class/loaiNhiemVu.ts}); phía server không có nhánh nào theo loại nhiệm vụ,
 * nên chỗ duy nhất chúng có thể chết là những dòng "điền giá trị thiếu" trong {@code apply}. Ca
 * đầu gửi đúng ba bộ ấy lên rồi đọc lại — nếu một giá trị bị viết đè thì màn hình hiện một đằng,
 * cơ sở dữ liệu giữ một nẻo, và không có gì báo.
 *
 * <p><b>{@code maxAttempts} bằng 0 là không giới hạn, không phải cấm nộp.</b> Đây là ranh giới dễ
 * vỡ nhất của ca đầu: một phép {@code == null ? 1 : …} viết lỏng thành {@code == 0 ? 1 : …} là
 * luyện tự do chỉ còn làm được một lượt — đúng cái mà loại nhiệm vụ ấy sinh ra để tránh.
 *
 * <p><b>Không vào sổ điểm thì không được đụng vào tỉ lệ của lớp.</b> Bài luyện tự do bao giờ cũng
 * là bài mới nhất, mà thống kê lớp chỉ lấy bài mới nhất của mỗi em — nên cờ {@code counts_in_gradebook}
 * hỏng là tỉ lệ cả lớp tụt về 0 vì một thứ không ai bắt buộc phải làm.
 *
 * <p><b>{@code answer_reveal} là cổng của bảng chữa từng câu.</b> Ca cuối ghim mức AFTER_RETURN
 * đối lại hai mức kia: nộp xong mà chưa trả bài thì không thấy điểm, không thấy bảng chấm; trả bài
 * rồi mới thấy. IMMEDIATE và AFTER_SUBMIT chỉ khác nhau <em>trước</em> lần nộp đầu — mà lúc ấy
 * chưa có gì được chấm để mà hiện — nên chỗ phân biệt hai mức đó là phép thử thuần trong
 * {@code AssignmentWindowTest}, không phải ở đây; nói thật ra để đừng ai tưởng ca này đã phủ nốt.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Loại nhiệm vụ và mức hiện đáp án")
class LoaiNhiemVuTest {

    private static final LocalDateTime DA_MO = LocalDateTime.now().minusHours(1).withNano(0);
    private static final LocalDateTime CON_HAN = LocalDateTime.now().plusDays(7).withNano(0);

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private final AtomicInteger dem = new AtomicInteger();

    private long giaoVien;
    private long hocSinh;
    private long lop;
    private long phieu;
    private long cauMotA;
    private long cauHaiB;

    private long lopSo;
    private long emSo;

    @BeforeAll
    void dungDuLieu() {
        giaoVien = taoNguoiDung("TEACHER", "Co Nga loai nhiem vu");
        lop = taoLop("LOAINV");
        hocSinh = taoHocSinh(lop, "Em lam bai");
        cauMotA = taoCauTracNghiem("A");
        cauHaiB = taoCauTracNghiem("B");
        phieu = taoPhieu(cauMotA, cauHaiB);

        lopSo = taoLop("SODIEM");
        emSo = taoHocSinh(lopSo, "Em vao so diem");
    }

    // ==================== ba bộ mặc định ====================

    @Test
    @Order(1)
    @DisplayName("Ba bộ mặc định đi vòng qua API mà còn nguyên")
    void baBoMacDinhDiVongQuaApiConNguyen() throws Exception {
        long baiTap = taoBai(lop, "Bai tap", "BAI_TAP", "BAT_BUOC", 3, "PENALTY", 20, "AFTER_SUBMIT", true, CON_HAN);
        long kiemTra = taoBai(lop, "Bai kiem tra", "BAI_KIEM_TRA", "BAT_BUOC", 1, "REJECT", 0, "AFTER_RETURN", true, CON_HAN);
        long tuDo = taoBai(lop, "Luyen tu do", "LUYEN_TU_DO", "TU_CHON", 0, "REJECT", 0, "IMMEDIATE", false, null);

        JsonNode a = doc(baiTap);
        assertThat(a.get("taskKind").asText()).isEqualTo("BAI_TAP");
        assertThat(a.get("requirement").asText()).isEqualTo("BAT_BUOC");
        assertThat(a.get("maxAttempts").asInt()).isEqualTo(3);
        assertThat(a.get("latePolicy").asText()).isEqualTo("PENALTY");
        assertThat(a.get("latePenaltyPercent").asInt())
                .as("""
                        Trừ 20% là cả nội dung của lựa chọn "nộp muộn có trừ điểm". Đánh rơi số phần trăm
                        thì chính sách còn tên mà không còn tác dụng, và không ai thấy được điều đó.""")
                .isEqualTo(20);
        assertThat(a.get("answerReveal").asText()).isEqualTo("AFTER_SUBMIT");
        assertThat(a.get("countsInGradebook").asBoolean()).isTrue();

        JsonNode b = doc(kiemTra);
        assertThat(b.get("taskKind").asText()).isEqualTo("BAI_KIEM_TRA");
        assertThat(b.get("maxAttempts").asInt()).isEqualTo(1);
        assertThat(b.get("latePolicy").asText()).isEqualTo("REJECT");
        assertThat(b.get("answerReveal").asText()).isEqualTo("AFTER_RETURN");
        assertThat(b.get("countsInGradebook").asBoolean()).isTrue();

        JsonNode c = doc(tuDo);
        assertThat(c.get("taskKind").asText()).isEqualTo("LUYEN_TU_DO");
        assertThat(c.get("requirement").asText())
                .as("""
                        Luyện tự do mà mặc định "bắt buộc" thì mẫu số bài bắt buộc của cả lớp phồng lên vì
                        một thứ không ai bắt buộc phải làm.""")
                .isEqualTo("TU_CHON");
        assertThat(c.get("maxAttempts").asInt())
                .as("""
                        0 là không giới hạn. Một phép điền giá trị thiếu viết lỏng tay sẽ hoá 0 thành 1, và
                        bài sinh ra để làm đi làm lại thì chỉ còn làm được một lượt.""")
                .isZero();
        assertThat(c.get("answerReveal").asText()).isEqualTo("IMMEDIATE");
        assertThat(c.get("countsInGradebook").asBoolean()).isFalse();
        assertThat(c.get("dueAt").isNull())
                .as("""
                        Không hạn nộp là hợp lệ khi quá hạn vốn không nhận. Bắt phải có hạn ở đây là cấm hẳn
                        loại nhiệm vụ thứ ba.""")
                .isTrue();
    }

    @Test
    @Order(2)
    @DisplayName("Bài không vào sổ điểm không kéo tỉ lệ của lớp xuống")
    void baiKhongVaoSoDiemKhongDoiTiLe() throws Exception {
        long batBuoc = taoBai(lopSo, "Bai vao so diem", "BAI_TAP", "BAT_BUOC", 1, "REJECT", 0, "AFTER_SUBMIT",
                true, CON_HAN);
        nop(batBuoc, emSo);
        assertThat(tiLeNop(lopSo)).as("em duy nhất của lớp đã nộp bài duy nhất tính điểm").isEqualTo(100);

        taoBai(lopSo, "Luyen them cho vui", "LUYEN_TU_DO", "TU_CHON", 0, "REJECT", 0, "IMMEDIATE", false, null);

        assertThat(tiLeNop(lopSo))
                .as("""
                        Thống kê lớp chỉ lấy bài mới nhất của mỗi em, mà bài luyện tự do vừa tạo bao giờ cũng
                        là bài mới nhất. Cờ counts_in_gradebook hỏng thì tỉ lệ cả lớp tụt từ 100 về 0 chỉ vì
                        không ai làm một thứ không ai bắt buộc phải làm.""")
                .isEqualTo(100);
    }

    // ==================== mức hiện đáp án ====================

    @Test
    @Order(3)
    @DisplayName("AFTER_RETURN giấu điểm tới lúc trả bài, hai mức kia hiện ngay khi nộp")
    void mucHienDapAnChanDungLuc() throws Exception {
        long sauKhiNop = taoBai(lop, "Hien ngay sau khi nop", "BAI_TAP", "BAT_BUOC", 1, "REJECT", 0,
                "AFTER_SUBMIT", true, CON_HAN);
        long ngayLapTuc = taoBai(lop, "Hien ngay lap tuc", "LUYEN_TU_DO", "TU_CHON", 0, "REJECT", 0,
                "IMMEDIATE", false, CON_HAN);
        long khiTraBai = taoBai(lop, "Hien khi tra bai", "BAI_KIEM_TRA", "BAT_BUOC", 1, "REJECT", 0,
                "AFTER_RETURN", true, CON_HAN);

        nop(sauKhiNop, hocSinh);
        nop(ngayLapTuc, hocSinh);
        nop(khiTraBai, hocSinh);

        JsonNode moiNop = ketQua(sauKhiNop);
        assertThat(moiNop.get("score").isNull()).as("AFTER_SUBMIT: nộp xong là thấy điểm").isFalse();
        assertThat(moiNop.get("items")).as("AFTER_SUBMIT: và thấy cả bảng chữa từng câu").hasSize(2);

        JsonNode ngay = ketQua(ngayLapTuc);
        assertThat(ngay.get("score").isNull()).as("IMMEDIATE: thấy điểm").isFalse();
        assertThat(ngay.get("items")).hasSize(2);

        JsonNode chuaTra = ketQua(khiTraBai);
        assertThat(chuaTra.get("gradingStatus").asText())
                .as("máy đã chấm xong phần trắc nghiệm — điểm có sẵn, chỉ là chưa được hiện")
                .isEqualTo("GRADED");
        assertThat(chuaTra.get("score").isNull())
                .as("""
                        AFTER_RETURN nghĩa là giáo viên còn được xem lại trước khi cả lớp thấy điểm. Rò ở đây
                        thì mức "khi trả bài" thành ra không tồn tại, và cái nút trả bài chỉ còn là hình thức.""")
                .isTrue();
        assertThat(chuaTra.get("items"))
                .as("bảng chữa từng câu đi cùng điểm: hiện bảng mà giấu điểm là giấu hờ")
                .isEmpty();

        goi(HttpMethod.PATCH, "/api/teacher/submissions/" + idBaiNop(khiTraBai) + "/return", null, 200,
                giaoVien, "TEACHER");

        JsonNode daTra = ketQua(khiTraBai);
        assertThat(daTra.get("score").isNull()).as("trả bài rồi thì thấy điểm").isFalse();
        assertThat(daTra.get("items")).as("và thấy bảng chữa từng câu").hasSize(2);
    }

    // ==================== đọc ====================

    private JsonNode doc(long baiId) throws Exception {
        for (JsonNode bai : duLieu(goi(HttpMethod.GET, "/api/assignments?classId=" + lop, null, 200,
                giaoVien, "TEACHER"))) {
            if (bai.get("id").asLong() == baiId) return bai;
        }
        throw new AssertionError("Không thấy bài giao " + baiId);
    }

    private JsonNode ketQua(long baiId) throws Exception {
        return duLieu(goi(HttpMethod.GET, "/api/assignment-progress/" + baiId + "/result", null, 200,
                hocSinh, "STUDENT"));
    }

    private int tiLeNop(long lopId) throws Exception {
        for (JsonNode dong : duLieu(goi(HttpMethod.GET, "/api/teacher/class-results", null, 200,
                giaoVien, "TEACHER"))) {
            if (dong.get("classId").asLong() == lopId) return dong.get("tiLe").asInt();
        }
        throw new AssertionError("Không thấy lớp " + lopId + " trong kết quả các lớp");
    }

    private long idBaiNop(long baiId) {
        return jdbc.queryForObject(
                "select id from assignment_progress where assignment_id=? and deleted_at is null", Long.class, baiId);
    }

    // ==================== gọi và dựng ====================

    private void nop(long baiId, long em) throws Exception {
        goi(HttpMethod.POST, "/api/assignment-progress/" + baiId + "/submit", """
                {"answers":{"%d":"A","%d":"B"}}""".formatted(cauMotA, cauHaiB), 200, em, "STUDENT");
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

    private long taoBai(long lopId, String ten, String loai, String batBuoc, int soLuot, String muon, int phanTram,
                        String hienDapAn, boolean vaoSoDiem, LocalDateTime han) throws Exception {
        return duLieu(goi(HttpMethod.POST, "/api/assignments", """
                {"classId":%d,"worksheetId":%d,"title":"%s","status":"PUBLISHED","requirement":"%s",
                 "openAt":"%s","dueAt":%s,"maxAttempts":%d,"latePolicy":"%s","latePenaltyPercent":%d,
                 "taskKind":"%s","answerReveal":"%s","countsInGradebook":%b,"studentIds":[]}
                """.formatted(lopId, phieu, ten, batBuoc, DA_MO, han == null ? "null" : "\"" + han + "\"",
                soLuot, muon, phanTram, loai, hienDapAn, vaoSoDiem), 200, giaoVien, "TEACHER"))
                .get("id").asLong();
    }

    /** Câu trắc nghiệm có đáp án đúng, để máy chấm xong ngay và mức hiện đáp án có cái để giấu. */
    private long taoCauTracNghiem(String dapAn) {
        int so = dem.incrementAndGet();
        Long loai = jdbc.queryForObject(
                "select id from problem_types where deleted_at is null order by id limit 1", Long.class);
        return jdbc.queryForObject("""
                insert into problems (problem_type_id, public_code, qr_slug, statement_latex, difficulty, status,
                                      option_a, option_b, option_c, option_d, correct_option,
                                      created_by, created_at, updated_at)
                values (?, ?, ?, 'Chon dap an dung', 'NHAN_BIET', 'PUBLISHED',
                        'mot', 'hai', 'ba', 'bon', ?, ?, now(), now())
                returning id""", Long.class, loai, "LOAINV-" + so, "loainv" + so, dapAn, giaoVien);
    }

    private long taoPhieu(long... cauHoi) {
        long moi = jdbc.queryForObject("""
                insert into worksheets (name, columns_count, show_qr, show_student_fields, status, created_by,
                                        created_at, updated_at)
                values (?, 1, true, true, 'PUBLISHED', ?, now(), now())
                returning id""", Long.class, "Phieu loai nhiem vu " + dem.incrementAndGet(), giaoVien);
        for (int i = 0; i < cauHoi.length; i++) {
            jdbc.update("""
                    insert into worksheet_items (worksheet_id, problem_id, order_index, created_at, updated_at)
                    values (?, ?, ?, now(), now())""", moi, cauHoi[i], i + 1);
        }
        return moi;
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
                returning id""", Long.class, duyNhat + "@loainv.test", ten, duyNhat, vai);
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@loainv.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
