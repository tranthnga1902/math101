package com.math10.programs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.configuration.security.Math10Principal;
import com.math10.programs.support.PhanPhoiChuan;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.*;
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

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;

/**
 * Cấu hình PPCT lưu trong DB, không cứng trong code.
 *
 * <p>Ca đầu kiểm tra endpoint đặt cấu hình (GET/PUT). Ca thứ hai kiểm tra seed() đọc đúng
 * cấu hình từ DB — không còn hardcode CTST. Ca thứ ba kiểm tra seed() báo lỗi khi chương
 * trình chưa có cấu hình: thứ quan trọng nhất của thiết kế này là lỗi rõ thay vì tự lấp.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Cấu hình PPCT từ DB")
class PpctConfigTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private long chuongTrinhCoConfig;
    private long chuongTrinhChuaConfig;
    private long quanTri;

    @BeforeAll
    void chuanBi() {
        quanTri = jdbc.queryForObject("""
                insert into users(email,password_hash,full_name,username,role_code,status,created_at,updated_at)
                values('qt@ppct-config.test','x','Admin','qt.ppct.config','ADMIN','ACTIVE',now(),now())
                returning id""", Long.class);

        chuongTrinhCoConfig = jdbc.queryForObject("""
                insert into courses(code,name,status,created_at,updated_at)
                values('PPCT-CFG-CO','CT co config','PUBLISHED',now(),now()) returning id""", Long.class);

        chuongTrinhChuaConfig = jdbc.queryForObject("""
                insert into courses(code,name,status,created_at,updated_at)
                values('PPCT-CFG-CHUA','CT chua config','PUBLISHED',now(),now()) returning id""", Long.class);
    }

    @Test @Order(1)
    @DisplayName("GET trả null khi chưa có config; PUT lưu được; GET đọc lại đúng")
    void getVaPutThamSo() throws Exception {
        var layTruoc = mockMvc.perform(get("/api/admin/programs/{id}/ppct-config", chuongTrinhCoConfig)
                        .with(authentication(admin())))
                .andReturn().getResponse();
        assertThat(layTruoc.getStatus()).isEqualTo(200);
        assertThat(json.readValue(layTruoc.getContentAsString(), Map.class).get("data")).isNull();

        // Đặt cấu hình: 37 tuần, HK1 kết tuần 19, 3 tiết/tuần
        var luuRes = mockMvc.perform(put("/api/admin/programs/{id}/ppct-config", chuongTrinhCoConfig)
                        .with(authentication(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"so_tuan\":37,\"tuan_ky_1\":19,\"tiet_mot_tuan\":3}"))
                .andReturn().getResponse();
        assertThat(luuRes.getStatus()).as(luuRes.getContentAsString()).isEqualTo(200);

        // Đọc lại — phải đúng 37
        var layLai = json.readValue(mockMvc.perform(get("/api/admin/programs/{id}/ppct-config", chuongTrinhCoConfig)
                .with(authentication(admin()))).andReturn().getResponse().getContentAsString(), Map.class);
        assertThat(((Map<?,?>) layLai.get("data")).get("so_tuan")).isEqualTo(37);
        assertThat(((Map<?,?>) layLai.get("data")).get("tuan_ky_1")).isEqualTo(19);
    }

    @Test @Order(2)
    @DisplayName("PUT từ khóa; seed() đọc đúng từ khóa, mạch suy khớp")
    void tuKhoaVaSeed() throws Exception {
        // Seed mạch config (4 mạch CTST) và tuần đặc biệt vào DB
        var cfg = PhanPhoiChuan.ctst();
        // Upsert config — ca Order 1 có thể đã tạo row ppct_config qua PUT endpoint
        jdbc.update("insert into program_ppct_config(program_id,so_tuan,tuan_ky_1,tiet_mot_tuan,created_at,updated_at) values(?,?,?,?,now(),now()) on conflict(program_id) do update set so_tuan=excluded.so_tuan,tuan_ky_1=excluded.tuan_ky_1,tiet_mot_tuan=excluded.tiet_mot_tuan,updated_at=now()",
                chuongTrinhCoConfig, cfg.soTuan(), cfg.tuanKy1(), cfg.tietMotTuan());
        // Mạch và tuần đặc biệt: xóa mềm hàng cũ rồi insert mới nếu chưa có
        jdbc.update("update program_mach_config set deleted_at=now(),updated_at=now() where program_id=? and deleted_at is null", chuongTrinhCoConfig);
        for (var m : cfg.mach())
            jdbc.update("insert into program_mach_config(program_id,ma_mach,ten_mach,thu_tu,bat_dau_tuan,ket_thuc_tuan,so_tiet_mot_tuan,created_at,updated_at) values(?,?,?,?,?,?,?,now(),now())",
                    chuongTrinhCoConfig, m.ma(), m.ten(), m.thuTu(),
                    m.batDauTuan() <= 0 ? null : m.batDauTuan(),
                    m.ketThucTuan() <= 0 ? null : m.ketThucTuan(),
                    m.soTietMotTuan());
        jdbc.update("update program_tuan_dac_biet set deleted_at=now(),updated_at=now() where program_id=? and deleted_at is null", chuongTrinhCoConfig);
        for (var d : cfg.tuanDacBiet())
            jdbc.update("insert into program_tuan_dac_biet(program_id,tuan_so,loai,ma_mach,nhan,created_at,updated_at) values(?,?,?,?,?,now(),now())",
                    chuongTrinhCoConfig, d.tuanSo(), d.loai(), d.maMach(), d.nhan());

        // PUT từ khóa cho DAI_SO — thêm "logarit" để test keyword mới
        var putTk = mockMvc.perform(put("/api/admin/programs/{id}/tu-khoa/{ma}", chuongTrinhCoConfig, "DAI_SO")
                        .with(authentication(admin()))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("[\"mệnh đề\",\"tập hợp\",\"hàm số\",\"bất phương trình\",\"logarit\"]"))
                .andReturn().getResponse();
        assertThat(putTk.getStatus()).as(putTk.getContentAsString()).isEqualTo(200);

        // Seed phải thành công vì đã có config
        var seedRes = mockMvc.perform(post("/api/admin/programs/{id}/strands/seed", chuongTrinhCoConfig)
                        .with(authentication(admin())).contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();
        assertThat(seedRes.getStatus()).as("seed() phải thành công khi đã có config").isEqualTo(200);

        // Số tiết đúng = soTuan * tietMotTuan = 35 * 3 = 105
        int soTiet = jdbc.queryForObject("""
                select count(*) from program_periods p join program_strands s on s.id=p.strand_id
                where s.program_id=? and p.deleted_at is null""", Integer.class, chuongTrinhCoConfig);
        assertThat(soTiet).as("số tiết = soTuan × tietMotTuan của config").isEqualTo(cfg.soTuan() * cfg.tietMotTuan());
    }

    @Test @Order(3)
    @DisplayName("seed() báo lỗi rõ khi chương trình chưa có config — không tự lấp CTST")
    void seedKhiChuaCoConfigThiBaoLoi() throws Exception {
        var seedRes = mockMvc.perform(post("/api/admin/programs/{id}/strands/seed", chuongTrinhChuaConfig)
                        .with(authentication(admin())).contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();
        assertThat(seedRes.getStatus())
                .as("chưa config → 400, không phải 200 với CTST mặc định ngầm định")
                .isEqualTo(400);
        assertThat(seedRes.getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .as("thông điệp lỗi phải hướng admin đến UI cấu hình")
                .contains("Cấu hình");
    }

    // ==================== Helpers ====================

    private Authentication admin() {
        Math10Principal p = new Math10Principal(quanTri, "qt@ppct-config.test", "ADMIN");
        return new UsernamePasswordAuthenticationToken(p, null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
    }
}
