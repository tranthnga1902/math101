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
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Chương trình chạy nhiều mạch song song, mỗi mạch một bộ đếm.
 *
 * <p>Trước lát này hệ chỉ biết một câu: "hôm nay chương nào đang chạy". Câu đó sai từ tuần 1, vì
 * tuần 1 có Đại số tiết 1 và Hình học tiết 1 cùng lúc — không cái nào là chương hiện hành của cái
 * kia. Ba ca đầu ở đây đo đúng ba con số mà kế hoạch đặt ra làm mốc nhận: tuần 5 trả về ba dòng,
 * tổng 105 tiết, tuần 12 là lần đầu Thống kê xuất hiện.
 *
 * <p>Ca thứ tư đo thứ dễ hỏng nhất của mô hình: <b>bộ đếm riêng</b>. Hình học và Thống kê dùng
 * chung một ô trong thời khóa biểu, nên viết một chuỗi số chạy suốt là chuyện tự nhiên phải làm —
 * và sai. Thống kê bắt đầu từ tiết 1 ở tuần 12 chứ không tiếp nối tiết 22 của Hình học, vì
 * "Thống kê tiết 1" là câu giáo viên nói còn "tiết thứ 23" thì không ai dùng.
 *
 * <p>Ba ca cuối đo lượt sinh lại. Sinh lại là nút một người sẽ bấm nhầm, nên nó phải chịu được cú
 * bấm nhầm: không nhân đôi, không xóa dòng người ta nhập tay, và khi số tiết đụng nhau thì dừng
 * hẳn chứ không lách. Lách kiểu nào cũng để lại một mạch thủng mà không ai được báo.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Mô hình đa mạch")
class MoHinhDaMachTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private long chuongTrinh;
    private long quanTri;
    private long giaoVien;
    private long hocSinh;

    @BeforeAll
    void dungDuLieu() throws Exception {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-DAMACH', 'Toan 10 da mach', 'PUBLISHED', now(), now())
                returning id""", Long.class);

        // Seed cấu hình CTST cho chương trình test — đây là thứ seed() sẽ đọc từ DB.
        // Không hardcode con số ở đây: lấy từ PhanPhoiChuan.ctst() để test không tách khỏi logic.
        var cfg = com.math10.programs.support.PhanPhoiChuan.ctst();
        jdbc.update("insert into program_ppct_config(program_id,so_tuan,tuan_ky_1,tiet_mot_tuan,created_at,updated_at) values(?,?,?,?,now(),now())",
                chuongTrinh, cfg.soTuan(), cfg.tuanKy1(), cfg.tietMotTuan());
        for (var m : cfg.mach()) {
            jdbc.update("insert into program_mach_config(program_id,ma_mach,ten_mach,thu_tu,bat_dau_tuan,ket_thuc_tuan,so_tiet_mot_tuan,created_at,updated_at) values(?,?,?,?,?,?,?,now(),now())",
                    chuongTrinh, m.ma(), m.ten(), m.thuTu(),
                    m.batDauTuan() <= 0 ? null : m.batDauTuan(),
                    m.ketThucTuan() <= 0 ? null : m.ketThucTuan(),
                    m.soTietMotTuan());
        }
        for (var d : cfg.tuanDacBiet()) {
            jdbc.update("insert into program_tuan_dac_biet(program_id,tuan_so,loai,ma_mach,nhan,created_at,updated_at) values(?,?,?,?,?,now(),now())",
                    chuongTrinh, d.tuanSo(), d.loai(), d.maMach(), d.nhan());
        }

        // Người dùng phải có thật trong bảng: lượt sinh ghi một dòng nhật ký, mà nhật ký khóa ngoại
        // về users. Tên tài khoản và thư đều riêng vì các phép thử cùng ngữ cảnh chia chung CSDL.
        quanTri = nguoiDung("quan.tri@damach.test", "quan.tri.da.mach", "Quản trị đa mạch", "ADMIN");
        giaoVien = nguoiDung("co@damach.test", "co.da.mach", "Cô đa mạch", "TEACHER");
        hocSinh = nguoiDung("em@damach.test", "em.da.mach", "Em đa mạch", "STUDENT");
        assertThat(sinh(quanTri())).as("không sinh được thì mọi ca sau đều vô nghĩa").isEqualTo(200);
    }

    @Test @Order(1)
    @DisplayName("Tuần 5 trả về đúng ba dòng: Đại số tiết 5, Hình học tiết 9 và 10")
    void tuanNamTraVeDungBaDong() throws Exception {
        List<Map<String,Object>> tuan = tuan(5);
        assertThat(tuan)
                .as("ba tiết một tuần, và tuần 5 không có tiết nào của mạch khác chen vào")
                .hasSize(3);
        assertThat(tuan.stream().map(x -> x.get("strand_code") + " " + x.get("period_no")).toList())
                .as("""
                    thứ tự cũng là một khẳng định, không phải chuyện phụ: Đại số nằm trên vì đó là \
                    thứ tự làn của màn Lộ trình, và hai tiết Hình học phải là 9 rồi 10 chứ không \
                    phải 10 rồi 9""")
                .containsExactly("DAI_SO 5", "HINH_HOC 9", "HINH_HOC 10");
    }

    @Test @Order(2)
    @DisplayName("Cả năm đúng 105 tiết")
    void caNamDungMotTramLinhNamTiet() {
        assertThat(soTiet(null))
                .as("105 = 3 tiết một tuần × 35 tuần; lệch con số này là quy tắc sinh đã trôi")
                .isEqualTo(105);
        assertThat(Map.of("DAI_SO", soTiet("DAI_SO"), "HINH_HOC", soTiet("HINH_HOC"),
                        "THONG_KE", soTiet("THONG_KE"), "HDTN", soTiet("HDTN")))
                .as("tổng đúng mà chia sai thì vẫn là chương trình khác; đo cả bốn mạch")
                .isEqualTo(Map.of("DAI_SO", 31, "HINH_HOC", 22, "THONG_KE", 48, "HDTN", 4));
    }

    @Test @Order(3)
    @DisplayName("Tuần 12 là lần đầu mạch Thống kê xuất hiện, Hình học dừng ở tuần 11")
    void tuanMuoiHaiThongKeVaoThayCho() throws Exception {
        assertThat(ma(tuan(11)))
                .as("mốc chuyển của cả năm: tuần 11 vẫn là Hình học")
                .containsExactly("DAI_SO", "HINH_HOC", "HINH_HOC");
        assertThat(ma(tuan(12)))
                .as("tuần 12 Thống kê vào đúng ô Hình học vừa rời, không phải thêm một ô thứ tư")
                .containsExactly("DAI_SO", "THONG_KE", "THONG_KE");
        assertThat(jdbc.queryForObject("""
                select min(p.week_no) from program_periods p join program_strands s on s.id=p.strand_id
                where s.program_id=? and s.code='THONG_KE' and p.deleted_at is null""",
                Integer.class, chuongTrinh))
                .as("lần đầu Thống kê xuất hiện phải là tuần 12, không sớm hơn ở đâu đó")
                .isEqualTo(12);
    }

    @Test @Order(4)
    @DisplayName("Số tiết đếm riêng trong từng mạch")
    void soTietDemRiengTungMach() throws Exception {
        assertThat(tuan(12).stream().filter(x -> "THONG_KE".equals(x.get("strand_code")))
                        .map(x -> ((Number) x.get("period_no")).intValue()).toList())
                .as("""
                    Thống kê dùng lại đúng ô của Hình học, nên đánh số nối tiếp là chuyện dễ làm \
                    nhất và sai nhất — tiết đầu của một mạch luôn là tiết 1""")
                .containsExactly(1, 2);
        assertThat(jdbc.queryForObject("""
                select max(p.period_no) from program_periods p join program_strands s on s.id=p.strand_id
                where s.program_id=? and s.code='HINH_HOC' and p.deleted_at is null""",
                Integer.class, chuongTrinh))
                .as("Hình học đếm tới 22 rồi dừng; nếu bộ đếm là chung thì con số này sẽ khác")
                .isEqualTo(22);
    }

    @Test @Order(5)
    @DisplayName("Phân loại tiết đi theo tuần, không theo vẻ ngoài")
    void phanLoaiTietDiTheoTuan() throws Exception {
        // Phân loại quan trọng hơn tiêu đề: tiết kiểm tra sẽ có mặc định phân phối khác hẳn, nên
        // chỗ đọc nó là cột phân loại chứ không phải chữ "Kiểm tra" trong tên.
        assertThat(tuan(18).stream().filter(x -> "DAI_SO".equals(x.get("strand_code")))
                        .map(x -> x.get("period_kind")).toList())
                .as("tuần 18 là tuần cuối học kỳ I — ô đơn phải là tiết kiểm tra")
                .containsExactly("KIEM_TRA");
        // Làn xếp theo thứ tự mạch, mà Hoạt động trải nghiệm là làn thứ tư, nên tuần 6 nó nằm cuối
        // chứ không nằm ở chỗ Đại số vừa rời. Điều phải đúng là số tiết trong tuần và mạch nào vắng.
        assertThat(ma(tuan(6)))
                .as("Hoạt động trải nghiệm lấy chỗ của Đại số chứ không thêm tiết thứ tư vào tuần")
                .containsExactly("HINH_HOC", "HINH_HOC", "HDTN");
        assertThat(jdbc.queryForObject("""
                select count(*) from program_periods p join program_strands s on s.id=p.strand_id
                where s.program_id=? and p.deleted_at is null and p.lesson_id is not null""",
                Integer.class, chuongTrinh))
                .as("""
                    lượt sinh dựng bộ khung, không dựng nội dung: không dòng nào được tự trỏ vào \
                    một bài học. Chỗ trống nhìn thấy được thì có người lấp, chỗ đã lấp bằng đồ \
                    đoán thì không""")
                .isZero();
    }

    @Test @Order(6)
    @DisplayName("Học sinh đọc được bộ khung, chỉ admin sinh được")
    void hocSinhDocDuocConAdminMoiSinhDuoc() throws Exception {
        assertThat(mockMvc.perform(get("/api/programs/{id}/weeks/{n}", chuongTrinh, 5)
                        .with(authentication(ai(hocSinh, "em@damach.test", "STUDENT"))))
                        .andReturn().getResponse().getStatus())
                .as("bộ khung chương trình không phải bí mật; thứ có quyền đọc riêng là học liệu gắn vào tiết")
                .isEqualTo(200);
        assertThat(sinh(ai(giaoVien, "co@damach.test", "TEACHER")))
                .as("sinh lại phân phối là viết đè lên cả năm của mọi lớp — đó là việc của admin")
                .isEqualTo(403);
    }

    @Test @Order(7)
    @DisplayName("Sinh lại không nhân đôi")
    void sinhLaiKhongNhanDoi() throws Exception {
        assertThat(sinh(quanTri())).isEqualTo(200);
        assertThat(soTiet(null))
                .as("nút này người ta sẽ bấm hai lần; bấm hai lần mà thành 210 tiết là hỏng cả năm")
                .isEqualTo(105);
        assertThat(jdbc.queryForObject("""
                select count(*) from program_strands where program_id=? and deleted_at is null""",
                Integer.class, chuongTrinh))
                .as("mạch cũng không được nhân đôi: hai dòng cùng mã thì 'Hình học' thành hai thứ")
                .isEqualTo(4);
    }

    @Test @Order(8)
    @DisplayName("Sinh lại không xóa dòng nhập tay")
    void sinhLaiKhongXoaDongNhapTay() throws Exception {
        long tay = themTay(90, "Tiết bù do nghỉ bão");
        assertThat(sinh(quanTri())).isEqualTo(200);
        assertThat(jdbc.queryForObject(
                "select count(*) from program_periods where id=? and deleted_at is null", Integer.class, tay))
                .as("đây là toàn bộ lý do cột source tồn tại: sinh lại chỉ được dọn thứ chính nó đã sinh")
                .isEqualTo(1);
        assertThat(soTiet(null))
                .as("dòng tay nằm ngoài 105 tiết chuẩn, không bị đếm nhập vào cũng không làm hụt đi")
                .isEqualTo(106);
        jdbc.update("delete from program_periods where id=?", tay);
    }

    @Test @Order(9)
    @DisplayName("Số tiết bị dòng nhập tay chiếm chỗ thì dừng, không lách")
    void dongNhapTayChiemChoThiDung() throws Exception {
        // Dựng đúng cảnh có thật: admin bỏ tiết 5 của Đại số rồi thay bằng tiết của mình.
        jdbc.update("""
                update program_periods p set deleted_at=now() from program_strands s
                where s.id=p.strand_id and s.program_id=? and s.code='DAI_SO' and p.period_no=5 and p.deleted_at is null""",
                chuongTrinh);
        long tay = themTay(5, "Tiết 5 do trung tâm tự xếp");

        assertThat(sinh(quanTri()))
                .as("lách kiểu nào cũng để lại một mạch thủng mà không ai được báo")
                .isEqualTo(400);
        assertThat(soTiet(null))
                .as("""
                    dừng giữa chừng phải trả nguyên trạng: lượt sinh đã xóa mềm hết dòng SEED trước \
                    khi phát hiện va chạm, nên không cuộn lại được thì cả năm biến mất""")
                .isEqualTo(105);
        assertThat(jdbc.queryForObject(
                "select count(*) from program_periods where id=? and deleted_at is null", Integer.class, tay))
                .as("và dòng người ta nhập tay vẫn còn nguyên chỗ")
                .isEqualTo(1);
    }

    // ==================== dựng dữ liệu ====================

    private long themTay(int soTiet, String tieuDe) {
        return jdbc.queryForObject("""
                insert into program_periods(strand_id,period_no,week_no,term,title,period_kind,source,created_at,updated_at)
                select s.id,?,?,1,?,'BAI_MOI','MANUAL',now(),now() from program_strands s
                where s.program_id=? and s.code='DAI_SO' and s.deleted_at is null
                returning id""", Long.class, soTiet, Math.min(soTiet, 35), tieuDe, chuongTrinh);
    }

    /** Trả mã trạng thái thay vì ném, vì có ca cần 403, có ca cần 400 và có ca cần 200. */
    private int sinh(Authentication ai) throws Exception {
        return mockMvc.perform(post("/api/admin/programs/{id}/strands/seed", chuongTrinh)
                        .with(authentication(ai)).contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse().getStatus();
    }

    private List<Map<String,Object>> tuan(int so) throws Exception {
        var phanHoi = mockMvc.perform(get("/api/programs/{id}/weeks/{n}", chuongTrinh, so)
                        .with(authentication(quanTri()))).andReturn().getResponse();
        String than = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET tuần %d → %s", so, than).isEqualTo(200);
        Map<?,?> boc = json.readValue(than, Map.class);
        //noinspection unchecked
        return (List<Map<String,Object>>) boc.get("data");
    }

    private List<Object> ma(List<Map<String,Object>> tuan) {
        return tuan.stream().map(x -> x.get("strand_code")).toList();
    }

    private int soTiet(String maMach) {
        return jdbc.queryForObject("""
                select count(*) from program_periods p join program_strands s on s.id=p.strand_id
                where s.program_id=? and p.deleted_at is null and (?::varchar is null or s.code=?)""",
                Integer.class, chuongTrinh, maMach, maMach);
    }

    private long nguoiDung(String thu, String tenTaiKhoan, String hoTen, String vai) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, thu, hoTen, tenTaiKhoan, vai);
    }

    private Authentication quanTri() {
        return ai(quanTri, "quan.tri@damach.test", "ADMIN");
    }

    private Authentication ai(long ai, String thu, String vai) {
        Math10Principal principal = new Math10Principal(ai, thu, vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
