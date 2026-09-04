package com.math10.programs;

import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
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
import org.springframework.test.web.servlet.MvcResult;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Tuần nghỉ lễ: những ngày nằm trong lịch của khóa nhưng không ai học.
 *
 * <p>Không có bảng kỳ nghỉ thì hệ thống chỉ biết "hôm nay nằm trong khoảng của Chương 5", nên suốt
 * chín ngày Tết nó vẫn chỉ vào Chương 5 và nói học sinh đang học. Đó là câu trả lời sai mà không ai
 * nhìn ra là sai — nó đúng hình dạng, đúng kiểu dữ liệu, chỉ sai sự thật.
 *
 * <p>Chỗ dễ hỏng thứ hai là hướng ngược lại: trả về rỗng cho ngày nghỉ. Rỗng cũng là câu trả lời
 * của "khóa chưa xếp lịch" và của "chương trình chưa có chương nào" — ba tình huống khác hẳn nhau
 * dồn vào một màn hình trắng, và học sinh chỉ biết là hỏng. Nên phép thử đòi câu trả lời ngày nghỉ
 * phải mang theo lý do và ngày quay lại; rỗng là không đạt.
 *
 * <p>Kỳ nghỉ gắn vào khóa chứ không vào chương trình: hai khóa của cùng một chương trình có thể
 * nghỉ khác nhau (trường tư nghỉ hè sớm hơn). {@link #khoaKhacKhongBiKeoTheo()} canh chỗ đó.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Kỳ nghỉ của khóa")
class KyNghiCuaKhoaTest {

    /** Ngày thường giữa học kỳ. */
    private static final String NGAY_HOC = "2092-01-20";
    /** Ngày nằm giữa kỳ nghỉ Tết đã đặt. */
    private static final String NGAY_NGHI = "2092-02-10";
    /** Ngày ngay sau kỳ nghỉ. */
    private static final String NGAY_DI_HOC_LAI = "2092-02-15";

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;

    private long chuongTrinhA, khoaA, hocSinhA;
    private long chuongTrinhB, hocSinhB;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinhA = taoChuongTrinh("TOAN10-NGHI-A", "Toán 10 khóa có nghỉ Tết");
        khoaA = taoKhoa(chuongTrinhA, "Khóa A 2091/2092", "2091-2092");
        xepLich(chuongTrinhA, khoaA, "2092-01-01", "2092-03-31", "Chương 5 - Vecto");
        hocSinhA = ganHocSinh(khoaA, "NGHI-10A", "an-nghi");
        jdbc.update("""
                insert into academic_breaks (course_instance_id, starts_on, ends_on, reason, created_at, updated_at)
                values (?, '2092-02-05'::date, '2092-02-14'::date, 'Nghỉ Tết Nguyên đán', now(), now())""", khoaA);

        // Khóa thứ hai, chương trình riêng, không đặt kỳ nghỉ nào: đối chứng cho cùng một ngày.
        chuongTrinhB = taoChuongTrinh("TOAN10-NGHI-B", "Toán 10 khóa không nghỉ");
        long khoaB = taoKhoa(chuongTrinhB, "Khóa B 2091/2092", "2091-2092 B");
        xepLich(chuongTrinhB, khoaB, "2092-01-01", "2092-03-31", "Chương 5 - Vecto (khóa B)");
        hocSinhB = ganHocSinh(khoaB, "NGHI-10B", "binh-nghi");
    }

    @Test
    @DisplayName("Ngày thường: học sinh thấy chương đang học")
    void ngayThuongThiDangHoc() throws Exception {
        String than = xemChuongHienHanh(hocSinhA, chuongTrinhA, NGAY_HOC);

        assertThat(than).contains("\"current\":true");
        assertThat(than).as("ngày thường mà báo đang nghỉ thì học sinh mất chín ngày học").contains("\"onBreak\":false");
    }

    @Test
    @DisplayName("Trong kỳ nghỉ: không còn là đang học nữa")
    void trongKyNghiThiKhongPhaiDangHoc() throws Exception {
        String than = xemChuongHienHanh(hocSinhA, chuongTrinhA, NGAY_NGHI);

        assertThat(than).as("vẫn nói đang học thì học sinh mở sách vào ngày mùng ba Tết").contains("\"current\":false");
        assertThat(than).contains("\"onBreak\":true");
    }

    @Test
    @DisplayName("Trong kỳ nghỉ: nói rõ nghỉ vì gì và bao giờ học lại")
    void trongKyNghiPhaiNoiRoLyDo() throws Exception {
        String than = xemChuongHienHanh(hocSinhA, chuongTrinhA, NGAY_NGHI);

        assertThat(than).as("không có lý do thì màn hình trống y như lúc hệ thống hỏng")
                .contains("Nghỉ Tết Nguyên đán");
        assertThat(than).as("phải biết ngày quay lại, nếu không học sinh phải đoán")
                .contains("\"breakEndsOn\":\"2092-02-14\"");
    }

    @Test
    @DisplayName("Hết kỳ nghỉ thì học lại bình thường")
    void hetNghiThiHocLai() throws Exception {
        String than = xemChuongHienHanh(hocSinhA, chuongTrinhA, NGAY_DI_HOC_LAI);

        assertThat(than).as("kỳ nghỉ tràn sang ngày đi học lại thì cả lớp mất buổi đầu học kỳ")
                .contains("\"current\":true");
        assertThat(than).contains("\"onBreak\":false");
    }

    @Test
    @DisplayName("Kỳ nghỉ của khóa này không kéo theo khóa khác")
    void khoaKhacKhongBiKeoTheo() throws Exception {
        String than = xemChuongHienHanh(hocSinhB, chuongTrinhB, NGAY_NGHI);

        assertThat(than).as("kỳ nghỉ gắn vào khóa, không phải vào ngày trên lịch chung")
                .contains("\"onBreak\":false");
        assertThat(than).contains("\"current\":true");
    }

    @Test
    @DisplayName("Màn hình khóa của Admin cũng thấy ngày nghỉ, không chỉ màn hình học sinh")
    void manHinhKhoaCungThayNgayNghi() throws Exception {
        MvcResult ketQua = mockMvc.perform(get("/api/courses/" + khoaA + "/current-chapter?at=" + NGAY_NGHI)
                .with(authentication(admin()))).andReturn();
        String than = ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(ketQua.getResponse().getStatus()).as(than).isEqualTo(200);
        assertThat(than).as("hai màn hình trả lời lệch nhau thì không ai biết tin cái nào")
                .contains("Nghỉ Tết Nguyên đán");
    }

    @Test
    @DisplayName("Gỡ kỳ nghỉ thì ngày đó học lại")
    void goKyNghiThiHocLai() throws Exception {
        long khoa = khoaRieng("TOAN10-NGHI-GO", "Toán 10 gỡ nghỉ", "Khóa gỡ 2091/2092", "2091-2092 GO");
        long id = taoKyNghiQuaApi(khoa, "2092-02-05", "2092-02-14", "Nghỉ thử");

        assertThat(kyNghiCuaKhoa(khoa)).as("vừa tạo xong mà không thấy thì Admin gõ lại lần nữa").isEqualTo(1);
        mockMvc.perform(delete("/api/admin/academic-breaks/" + id).with(authentication(admin())))
                .andReturn();

        assertThat(kyNghiCuaKhoa(khoa)).as("gỡ rồi mà vẫn đếm thì lịch không bao giờ sửa được").isZero();
    }

    @Test
    @DisplayName("Kỳ nghỉ ngoài khoảng của khóa bị chặn ngay khi tạo")
    void kyNghiNgoaiKhoangKhoaBiChan() throws Exception {
        long khoa = khoaRieng("TOAN10-NGHI-NGOAI", "Toán 10 nghỉ ngoài khoảng", "Khóa ngoài 2091/2092", "2091-2092 NGOAI");

        MvcResult ketQua = taoKyNghi(khoa, "2090-02-05", "2090-02-14", "Nghỉ năm ngoái");
        String than = ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8);

        assertThat(ketQua.getResponse().getStatus())
                .as("nhận rồi cất đi thì dòng ấy không bao giờ có tác dụng, mà Admin tưởng đã đặt: %s", than)
                .isEqualTo(400);
        assertThat(kyNghiCuaKhoa(khoa)).isZero();
    }

    @Test
    @DisplayName("Kỳ nghỉ kết thúc trước khi bắt đầu bị chặn")
    void ngayNguocBiChan() throws Exception {
        long khoa = khoaRieng("TOAN10-NGHI-NGUOC", "Toán 10 ngày ngược", "Khóa ngược 2091/2092", "2091-2092 NGUOC");

        MvcResult ketQua = taoKyNghi(khoa, "2092-02-14", "2092-02-05", "Nghỉ ngược");

        assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
        assertThat(kyNghiCuaKhoa(khoa)).isZero();
    }

    @Test
    @DisplayName("Kỳ nghỉ không có lý do bị chặn")
    void thieuLyDoBiChan() throws Exception {
        long khoa = khoaRieng("TOAN10-NGHI-TRONG", "Toán 10 nghỉ không lý do", "Khóa trống 2091/2092", "2091-2092 TRONG");

        MvcResult ketQua = taoKyNghi(khoa, "2092-02-05", "2092-02-14", "   ");

        assertThat(ketQua.getResponse().getStatus())
                .as("kỳ nghỉ không tên thì màn hình học sinh chỉ nói 'hôm nay nghỉ', không nói vì sao")
                .isEqualTo(400);
        assertThat(kyNghiCuaKhoa(khoa)).isZero();
    }

    private String xemChuongHienHanh(long hocSinh, long chuongTrinh, String ngay) throws Exception {
        MvcResult ketQua = mockMvc.perform(
                        get("/api/program-schedules/current?courseId=" + chuongTrinh + "&at=" + ngay)
                                .with(authentication(hocSinh(hocSinh))))
                .andReturn();
        String than = ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(ketQua.getResponse().getStatus()).as(than).isEqualTo(200);
        return than;
    }

    private MvcResult taoKyNghi(long khoa, String tu, String den, String lyDo) throws Exception {
        return mockMvc.perform(post("/api/admin/course-instances/" + khoa + "/breaks")
                        .with(authentication(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"startsOn\":\"" + tu + "\",\"endsOn\":\"" + den + "\",\"reason\":\"" + lyDo + "\"}"))
                .andReturn();
    }

    private long taoKyNghiQuaApi(long khoa, String tu, String den, String lyDo) throws Exception {
        MvcResult ketQua = taoKyNghi(khoa, tu, den, lyDo);
        String than = ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8);
        // Mã nằm trong phong bì ApiResponse, không nằm ở tầng HTTP: cả nhà đều trả 200 kèm code.
        assertThat(than).as("tạo kỳ nghỉ hợp lệ mà không nhận thì Admin không đặt được lịch nghỉ")
                .contains("\"code\":201");
        return jdbc.queryForObject(
                "select id from academic_breaks where course_instance_id=? and deleted_at is null", Long.class, khoa);
    }

    private int kyNghiCuaKhoa(long khoa) throws Exception {
        String than = mockMvc.perform(get("/api/admin/course-instances/" + khoa + "/breaks")
                        .with(authentication(admin()))).andReturn()
                .getResponse().getContentAsString(StandardCharsets.UTF_8);
        int n = 0;
        for (int i = than.indexOf("\"reason\""); i >= 0; i = than.indexOf("\"reason\"", i + 1)) n++;
        return n;
    }

    private long khoaRieng(String maChuongTrinh, String tenChuongTrinh, String tenKhoa, String namHoc) {
        return taoKhoa(taoChuongTrinh(maChuongTrinh, tenChuongTrinh), tenKhoa, namHoc);
    }

    private long taoChuongTrinh(String ma, String ten) {
        return jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values (?, ?, 'PUBLISHED', now(), now()) returning id""", Long.class, ma, ten);
    }

    /** Khóa chạy từ 1/8/2091 tới 31/5/2092 — mọi ngày phép thử dùng đều nằm trong khoảng này. */
    private long taoKhoa(long chuongTrinh, String ten, String namHoc) {
        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu kỳ nghỉ', 'PUBLISHED', now(), now()) returning id""", Long.class, chuongTrinh);
        return jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, ?, ?, '2091-08-01'::date, '2092-05-31'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau, ten, namHoc);
    }

    private void xepLich(long chuongTrinh, long khoa, String tu, String den, String tenChuong) {
        Long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, ?, 5, 'PUBLISHED', now(), now()) returning id""", Long.class, chuongTrinh, tenChuong);
        jdbc.update("""
                insert into program_schedules (course_id, course_instance_id, chapter_id, starts_on, ends_on, status, created_at, updated_at)
                values (?, ?, ?, ?::date, ?::date, 'ACTIVE', now(), now())""", chuongTrinh, khoa, chuong, tu, den);
    }

    /** @return id học sinh vừa xếp vào lớp của khóa này. */
    private long ganHocSinh(long khoa, String maLop, String ten) {
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        Long lop = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now()) returning id""", Long.class, maLop, maLop, khoi);
        jdbc.update("""
                insert into class_courses (class_id, course_instance_id, created_at, updated_at)
                values (?, ?, now(), now())""", lop, khoa);
        Long hocSinh = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, 'STUDENT', 'ACTIVE', now(), now())
                returning id""", Long.class, ten + "@kynghi.test", ten, ten);
        jdbc.update("""
                insert into class_students (class_id, student_id, created_at, updated_at)
                values (?, ?, now(), now())""", lop, hocSinh);
        return hocSinh;
    }

    private Authentication hocSinh(long id) {
        return new UsernamePasswordAuthenticationToken(
                new Math10Principal(id, "hs" + id + "@kynghi.test", "STUDENT"), null,
                List.of(new SimpleGrantedAuthority("ROLE_STUDENT")));
    }

    private Authentication admin() {
        return new UsernamePasswordAuthenticationToken(
                new Math10Principal(5001L, "admin@kynghi.test", "ADMIN"), null,
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }
}
