package com.math10.enrollments;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;
import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;

import javax.sql.DataSource;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Bước chuyển dữ liệu của {@code V202608311100__class_courses_tro_sang_khoa.sql}.
 *
 * <p>Bước này chạy đúng một lần trên CSDL thật và không lùi lại được: nó bỏ cột {@code course_id}.
 * Nếu phần chuyển sót một dòng thì câu {@code set not null} dừng cả lượt nâng cấp — an toàn nhưng
 * kẹt; nếu nó chuyển sai thì lớp im lặng gắn vào nhầm khóa và học sinh mở ra học liệu của chương
 * trình khác. Cả hai đều không phát hiện được bằng phép thử chạy trên CSDL trống, mà CSDL của mọi
 * phép thử khác đều trống ở bảng này.
 *
 * <p>Nên phép thử này dựng riêng một PostgreSQL, nâng cấp tới đúng bản ngay trước bước chuyển, đổ
 * vào dữ liệu hình dạng cũ, rồi mới chạy tiếp. Nó chậm hơn hẳn các phép thử khác — đó là giá của
 * việc thử một bước chỉ xảy ra một lần.
 */
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Chuyển lớp từ trỏ chương trình sang trỏ khóa")
class ChuyenLopSangKhoaTest {

    /** Bản ngay trước bước chuyển: cây chương trình, bộ SGK, khóa — nhưng lớp vẫn trỏ chương trình. */
    private static final String TRUOC_BUOC_CHUYEN = "202608311000";

    private EmbeddedPostgres postgres;
    private JdbcTemplate jdbc;
    private DataSource dataSource;

    private long chuongTrinhChuaCoKhoa;
    private long chuongTrinhDaCoKhoa;
    private long khoaCoSan;
    private long chuongTrinhCoLich;
    private long ganDangSong;
    private long ganDaXoa;

    @BeforeAll
    void dungDuLieuHinhDangCu() throws Exception {
        postgres = EmbeddedPostgres.start();
        dataSource = new SingleConnectionDataSource(postgres.getPostgresDatabase().getConnection(), true);
        jdbc = new JdbcTemplate(dataSource);

        nangCap(TRUOC_BUOC_CHUYEN);

        // (1) Chương trình chưa ai tạo khóa — bước chuyển phải tự sinh mẫu và khóa tạm.
        chuongTrinhChuaCoKhoa = taoChuongTrinh("TOAN10-CHUA-KHOA", "Toán 10 chưa có khóa");
        long lopA = taoLop("CHUYEN-10A");
        ganDangSong = ganCu(lopA, chuongTrinhChuaCoKhoa);

        // (2) Chương trình đã có khóa thật — bước chuyển phải dùng lại, không đẻ thêm khóa tạm.
        chuongTrinhDaCoKhoa = taoChuongTrinh("TOAN10-CO-KHOA", "Toán 10 đã có khóa");
        long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu thật', 'PUBLISHED', now(), now()) returning id""", Long.class, chuongTrinhDaCoKhoa);
        khoaCoSan = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Khóa thật 2026/2027', '2026-2027', '2026-08-15'::date, '2027-05-25'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau);
        ganCu(taoLop("CHUYEN-10B"), chuongTrinhDaCoKhoa);

        // (3) Chương trình chưa có khóa nhưng đã có lịch — ngày của khóa tạm phải lấy từ lịch đó.
        chuongTrinhCoLich = taoChuongTrinh("TOAN10-CO-LICH", "Toán 10 có lịch cũ");
        long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 1', 1, 'PUBLISHED', now(), now()) returning id""", Long.class, chuongTrinhCoLich);
        jdbc.update("""
                insert into program_schedules (course_id, chapter_id, starts_on, ends_on, status, created_at, updated_at)
                values (?, ?, '2025-09-10'::date, '2026-04-20'::date, 'ACTIVE', now(), now())""", chuongTrinhCoLich, chuong);
        ganCu(taoLop("CHUYEN-10C"), chuongTrinhCoLich);

        // (4) Dòng đã xoá mềm — lịch sử cũng phải được chuyển, không được rơi lại.
        ganDaXoa = ganCu(taoLop("CHUYEN-10D"), chuongTrinhChuaCoKhoa);
        jdbc.update("update class_courses set deleted_at = now() where id = ?", ganDaXoa);

        nangCap(null);
    }

    @AfterAll
    void dongCsdl() throws Exception {
        if (postgres != null) postgres.close();
    }

    @Test
    @DisplayName("Không dòng nối nào rơi lại: mọi dòng đều có khóa")
    void moiDongDeuCoKhoa() {
        assertThat(jdbc.queryForObject("select count(*) from class_courses", Integer.class))
                .as("bốn dòng đổ vào trước bước chuyển phải còn nguyên bốn")
                .isEqualTo(4);
        assertThat(jdbc.queryForObject("select count(*) from class_courses where course_instance_id is null", Integer.class))
                .isZero();
    }

    @Test
    @DisplayName("Dòng đã xoá mềm cũng được chuyển, không mất lịch sử")
    void dongDaXoaVanConVaVanCoKhoa() {
        Map<String, Object> row = jdbc.queryForMap("select course_instance_id, deleted_at from class_courses where id = ?", ganDaXoa);
        assertThat(row.get("deleted_at")).as("vẫn là dòng đã gỡ").isNotNull();
        assertThat(row.get("course_instance_id")).as("nhưng vẫn trỏ được về khóa").isNotNull();
    }

    @Test
    @DisplayName("Lớp vẫn trỏ đúng chương trình cũ, chỉ là đi vòng qua khóa")
    void lopVanTroDungChuongTrinhCu() {
        assertThat(chuongTrinhCua(ganDangSong))
                .as("gắn nhầm chương trình nghĩa là học sinh mở ra học liệu của lớp khác")
                .isEqualTo(chuongTrinhChuaCoKhoa);
    }

    @Test
    @DisplayName("Chương trình đã có khóa thật thì dùng lại, không đẻ thêm khóa tạm")
    void dungLaiKhoaDaCo() {
        assertThat(khoaCuaChuongTrinh(chuongTrinhDaCoKhoa))
                .as("sinh thêm khóa tạm bên cạnh khóa thật là để Admin phải đi dọn")
                .containsExactly(khoaCoSan);
    }

    @Test
    @DisplayName("Khóa sinh tự động ở trạng thái nháp và mang tên nói rõ là chưa xong")
    void khoaTamPhaiNhinThayDuoc() {
        Map<String, Object> khoa = jdbc.queryForMap(
                "select name, status from course_instances where id = ?", khoaCuaChuongTrinh(chuongTrinhChuaCoKhoa).get(0));

        assertThat((String) khoa.get("status"))
                .as("để PUBLISHED thì khóa máy sinh trông y hệt khóa người đặt")
                .isEqualTo("DRAFT");
        assertThat((String) khoa.get("name")).contains("cần đặt lịch");
    }

    @Test
    @DisplayName("Khóa tạm lấy ngày từ lịch đang có, không bịa ngày mới")
    void ngayKhoaTamLayTuLichDangCo() {
        Map<String, Object> khoa = jdbc.queryForMap(
                "select starts_on, ends_on, school_year from course_instances where id = ?",
                khoaCuaChuongTrinh(chuongTrinhCoLich).get(0));

        assertThat(khoa.get("starts_on")).hasToString("2025-09-10");
        assertThat(khoa.get("ends_on")).hasToString("2026-04-20");
        assertThat(khoa.get("school_year"))
                .as("lịch bắt đầu tháng 9/2025 thì đó là năm học 2025-2026")
                .isEqualTo("2025-2026");
    }

    @Test
    @DisplayName("Cột course_id đã bỏ hẳn, không còn hai đường song song")
    void khongConCotCu() {
        assertThat(jdbc.queryForObject("""
                select count(*) from information_schema.columns
                where table_name = 'class_courses' and column_name = 'course_id'
                """, Integer.class))
                .as("giữ lại cột cũ là giữ lại cơ chế cũ, và rồi hai cái lệch nhau")
                .isZero();
    }

    private void nangCap(String den) {
        var config = Flyway.configure().dataSource(dataSource).locations("classpath:db/migration");
        if (den != null) config = config.target(MigrationVersion.fromVersion(den));
        config.load().migrate();
    }

    private Long chuongTrinhCua(long ganId) {
        return jdbc.queryForObject("""
                select pt.program_id from class_courses cc
                join course_instances ci on ci.id = cc.course_instance_id
                join program_templates pt on pt.id = ci.template_id
                where cc.id = ?""", Long.class, ganId);
    }

    private List<Long> khoaCuaChuongTrinh(long chuongTrinh) {
        return jdbc.queryForList("""
                select ci.id from course_instances ci
                join program_templates pt on pt.id = ci.template_id
                where pt.program_id = ? and ci.deleted_at is null
                order by ci.id""", Long.class, chuongTrinh);
    }

    private long taoChuongTrinh(String ma, String ten) {
        return jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values (?, ?, 'PUBLISHED', now(), now()) returning id""", Long.class, ma, ten);
    }

    private long taoLop(String ma) {
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        return jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now()) returning id""", Long.class, ma, ma, khoi);
    }

    /** Hình dạng cũ: lớp trỏ thẳng chương trình. */
    private long ganCu(long lop, long chuongTrinh) {
        return jdbc.queryForObject("""
                insert into class_courses (class_id, course_id, created_at, updated_at)
                values (?, ?, now(), now()) returning id""", Long.class, lop, chuongTrinh);
    }
}
