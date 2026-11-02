package com.math10.programs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Thời gian thôi làm cổng chặn, chỉ còn làm thứ tự — và đây là chỗ chứng minh cả hai vế.
 *
 * <p>Trước lát này màn nội dung chặn theo lịch chương: chương chưa mở thì học liệu của nó không đọc
 * được. Cổng ấy vừa gỡ, học sinh thấy tài liệu cả năm, nên hai chuyện phải được kiểm riêng ra:
 *
 * <ul>
 *   <li><b>Thứ tự</b> — bốn dải quanh tuần hiện tại, cộng dải TUONG_LAI chỉ có ở màn Lộ trình. Sai
 *       thứ tự thì không có lỗi nào nổi lên, không có gì trống trên màn hình, chỉ là mọi người phải
 *       cuộn thêm mãi rồi quen dần.
 *   <li><b>Chặn</b> — giờ hoàn toàn do đối tượng và lớp lo. Cổng thời gian trước đây che giúp một
 *       phần sai sót: dòng của lớp khác thường nằm ở chương chưa mở nên không lọt ra. Tấm che ấy
 *       không còn, nên hai ca chặn phải có phép thử riêng chứ không dựa vào may.
 * </ul>
 *
 * <p>Bảy ca của kế hoạch nằm đủ ở đây. Ca 1–4 kiểm thứ tự chứ không kiểm chặn, nên chúng assert trên
 * <em>dải</em> và <em>vị trí</em>, không phải trên "có xuất hiện hay không" — có xuất hiện là điều
 * bốn ca ấy chưa bao giờ nghi ngờ.
 *
 * <p>Mỗi ca chặn đi kèm một chứng cứ ngược: dòng chỉ-giáo-viên phải hiện ra với quản trị, dòng của
 * lớp B phải hiện ra với học sinh lớp B. Không có vế ấy thì một câu truy vấn trả rỗng vì bất kỳ lý
 * do nào cũng làm phép thử xanh.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Bốn dải hiển thị và bảy ca chặn của màn nội dung")
class ThuTuBonDaiTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();

    /** Tuần mà lịch khóa trùm lên hôm nay. Mọi kỳ vọng về dải đo theo con số này. */
    private static final int TUAN_NAY = 10;

    private long chuongTrinh, lopA, lopB, emA, emB;

    @BeforeAll
    void dungDuLieu() {
        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-BONDAI', 'Toán 10 thử bốn dải', 'PUBLISHED', now(), now())
                returning id""", Long.class);

        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu bốn dải', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        // Năm học và tên tài khoản phải riêng: các phép thử cùng ngữ cảnh Spring chia chung một CSDL
        // nhúng, và có phép thử tra khóa bằng school_year trên toàn bảng chứ không theo id nó tạo ra.
        Long khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status,
                                              created_at, updated_at)
                values (?, 'Khóa bốn dải 2094/2095', '2094-2095',
                        current_date - 70, current_date + 50, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau);

        lopA = taoLop("BONDAI-10A", "Lớp 10A bốn dải", khoa);
        lopB = taoLop("BONDAI-10B", "Lớp 10B bốn dải", khoa);
        emA = taoHocSinh("an@bondai.test", "An bốn dải", "an.bon.dai", lopA);
        emB = taoHocSinh("binh@bondai.test", "Bình bốn dải", "binh.bon.dai", lopB);

        // Lịch neo vào hôm nay chứ không vào một ngày cố định: phép thử phải còn đúng sang năm sau.
        // Tuần 10 chạy từ ba ngày trước tới ba ngày sau nên hôm nay luôn nằm gọn trong nó, kể cả khi
        // phép thử chạy vào Chủ nhật.
        for (int tuan = 1; tuan <= 16; tuan++) {
            jdbc.update("""
                    insert into course_weeks (course_instance_id, week_no, starts_on, ends_on, is_break,
                                              edited_by_hand, created_at, updated_at)
                    values (?, ?, current_date + ?, current_date + ?, false, false, now(), now())""",
                    khoa, tuan, (tuan - TUAN_NAY) * 7 - 3, (tuan - TUAN_NAY) * 7 + 3);
        }

        Long mach = jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, 'DS', 'Đại số', 1, now(), now())
                returning id""", Long.class, chuongTrinh);
        Long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương bốn dải', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);

        long tiet3 = tiet(mach, chuong, 3);
        long tiet8 = tiet(mach, chuong, 8);
        long tiet10 = tiet(mach, chuong, TUAN_NAY);
        long tiet11 = tiet(mach, chuong, 11);
        long tiet15 = tiet(mach, chuong, 15);

        // Số thứ tự tăng dần theo dòng, để nếu thứ tự dải hỏng thì cái hiện ra là thứ tự chèn — tức
        // là ngược hẳn kỳ vọng ở dải đã học, chứ không phải một danh sách trông na ná đúng.
        gan("Dải tuần này", "TIET", tiet10, null, "STUDENT_ALLOWED", 1);
        gan("Dải sắp tới", "TIET", tiet11, null, "STUDENT_ALLOWED", 2);
        gan("Dải tương lai", "TIET", tiet15, null, "STUDENT_ALLOWED", 3);
        gan("Dải luôn hiện", "HE_THONG", null, null, "STUDENT_ALLOWED", 4);
        gan("Đã học tuần tám", "TIET", tiet8, null, "STUDENT_ALLOWED", 5);
        gan("Đã học tuần ba", "TIET", tiet3, null, "STUDENT_ALLOWED", 6);
        gan("Chỉ giáo viên", "TIET", tiet10, null, "TEACHER_ONLY", 7);
        gan("Riêng lớp B", "TIET", tiet10, lopB, "STUDENT_ALLOWED", 8);
        gan("Riêng lớp A", "TIET", tiet10, lopA, "STUDENT_ALLOWED", 9);

        khoaOn();
    }

    @Test
    @DisplayName("Ca 1 · tiết của tuần chưa tới vẫn đọc được, nằm ở dải sắp tới hoặc tương lai")
    void tuanChuaToiVanDocDuoc() throws Exception {
        JsonNode ds = danhSach(hocSinh(emA));
        assertThat(dai(ds, "Dải sắp tới")).isEqualTo("SAP_TOI");
        assertThat(dai(ds, "Dải tương lai"))
                .as("xa hơn hai tuần thì là TUONG_LAI, và nó vẫn phải được trả ra — lọc ở đây là dựng "
                        + "lại đúng cổng thời gian vừa gỡ, chỉ khác chỗ đứng")
                .isEqualTo("TUONG_LAI");
    }

    @Test
    @DisplayName("Ca 2 · tiết của tuần này nằm ở dải hiện tại và xếp đầu tiên")
    void tuanNayXepDauTien() throws Exception {
        JsonNode ds = danhSach(hocSinh(emA));
        assertThat(dai(ds, "Dải tuần này")).isEqualTo("TUAN_NAY");
        assertThat(viTri(ds, "Dải tuần này")).as("phải là dòng đầu danh sách").isZero();
    }

    @Test
    @DisplayName("Ca 3 · tiết của tuần đã qua vẫn đọc được, nằm ở dải đã học và xếp sau")
    void tuanDaQuaXepSau() throws Exception {
        JsonNode ds = danhSach(hocSinh(emA));
        assertThat(dai(ds, "Đã học tuần tám")).isEqualTo("DA_HOC");
        assertThat(viTri(ds, "Đã học tuần tám"))
                .as("đã học phải nằm dưới cả dải luôn hiện")
                .isGreaterThan(viTri(ds, "Dải luôn hiện"));
    }

    @Test
    @DisplayName("Ca 4 · trong dải đã học, tuần 8 nằm trên tuần 3")
    void daHocXepNguoc() throws Exception {
        JsonNode ds = danhSach(hocSinh(emA));
        assertThat(viTri(ds, "Đã học tuần tám"))
                .as("mở lại phần đã qua gần như luôn là để tìm tuần vừa rồi, không phải tuần đầu năm")
                .isLessThan(viTri(ds, "Đã học tuần ba"));
    }

    @Test
    @DisplayName("Thứ tự năm dải chạy đúng một mạch từ tuần này tới đã học")
    void namDaiChayDungMotMach() throws Exception {
        assertThat(ten(danhSach(hocSinh(emA))))
                .containsExactly("Dải tuần này", "Riêng lớp A", "Dải sắp tới", "Dải tương lai",
                        "Dải luôn hiện", "Đã học tuần tám", "Đã học tuần ba");
    }

    @Test
    @DisplayName("Ca 5 · học sinh không thấy tài liệu chỉ-giáo-viên, quản trị thì thấy")
    void chiGiaoVienKhongLotSangHocSinh() throws Exception {
        assertThat(ten(danhSach(hocSinh(emA)))).doesNotContain("Chỉ giáo viên");
        assertThat(ten(danhSach(quanTri())))
                .as("vế ngược: thiếu nó thì một câu truy vấn trả rỗng vì bất kỳ lý do gì cũng làm ca 5 xanh")
                .contains("Chỉ giáo viên");
    }

    @Test
    @DisplayName("Ca 6 · dòng gắn riêng cho lớp khác không lọt sang học sinh lớp này")
    void dongCuaLopKhacKhongLot() throws Exception {
        // Lỗ có thật trước lát này: đường đọc theo chương trình chưa từng hỏi tới lop_id, và cổng
        // thời gian che giúp vì dòng của lớp khác thường nằm ở chương chưa mở.
        assertThat(ten(danhSach(hocSinh(emA)))).doesNotContain("Riêng lớp B");
        assertThat(ten(danhSach(hocSinh(emB)))).contains("Riêng lớp B").doesNotContain("Riêng lớp A");
    }

    @Test
    @DisplayName("Ca 7 · quản trị không đọc được kho học liệu riêng của giáo viên")
    void quanTriKhongVaoKhoRiengGiaoVien() throws Exception {
        int ma = mockMvc.perform(get("/api/teacher/resources").with(authentication(quanTri())))
                .andReturn().getResponse().getStatus();
        assertThat(ma).as("kho riêng là riêng với cả người có quyền cao hơn").isEqualTo(403);
    }

    @Test
    @DisplayName("Người lớn không có khóa thì thấy đủ, chỉ là không xếp theo dải")
    void nguoiLonKhongCoTuanThiMoiDongLuonHien() throws Exception {
        assertThat(dai(danhSach(quanTri()), "Đã học tuần ba"))
                .as("đoán một tuần hiện tại cho người không có khóa là bịa dữ liệu")
                .isEqualTo("LUON_HIEN");
    }


    @Test
    @DisplayName("Tuần đo theo khóa của chương trình này, không theo khóa nào em cũng đang học")
    void tuanDoTheoKhoaCuaChuongTrinhNay() throws Exception {
        // Em A học hai chương trình cùng lúc — Toán 10 và một lớp ôn — và hai khóa lệch tuần: khóa
        // này đang ở tuần 10, khóa kia ở tuần 2. Ở trung tâm dạy thêm đây là chuyện thường, không
        // phải ca hiếm.
        //
        // Khóa ôn mở gần đây hơn nên nó đứng trước trong danh sách khóa của em. Bỏ bộ lọc chương
        // trình đi thì màn này đo theo tuần 2, và tiết tuần 10 rơi từ "tuần này" xuống "tương lai" —
        // vẫn ra một con số trông hợp lý, vẫn một màn hình đầy đủ, chỉ là xếp sai toàn bộ và không
        // có gì báo.
        assertThat(dai(danhSach(hocSinh(emA)), "Dải tuần này")).isEqualTo("TUAN_NAY");
    }

    @Test
    @DisplayName("Dòng của tiết vẫn biết chương của nó, dòng toàn hệ thống thì không")
    void dongCuaTietVanBietChuongCuaNo() throws Exception {
        JsonNode ds = danhSach(hocSinh(emA));
        assertThat(ds.get(viTri(ds, "Dải tuần này")).get("chapter_title").asText())
                .as("tiết biết bài của nó, bài biết chương — hỏi thẳng pr.lesson_id thì mọi dòng của "
                        + "tiết trả về chương rỗng và phần gom theo chương dồn hết vào một đống")
                .isEqualTo("Chương bốn dải");
        assertThat(ds.get(viTri(ds, "Dải luôn hiện")).get("chapter_title").isNull())
                .as("dòng toàn hệ thống không thuộc chương nào, và rỗng ở đây là câu trả lời thật")
                .isTrue();
    }

    // ---- dựng dữ liệu ----


    /**
     * Khóa thứ hai của em A, thuộc một chương trình khác và lệch tuần.
     *
     * <p>Không có nó thì ca {@code tuanDoTheoKhoaCuaChuongTrinhNay} xanh vì em chỉ có đúng một khóa —
     * bỏ bộ lọc chương trình đi cũng chọn ra đúng khóa ấy. Một phép thử chỉ đúng khi dữ liệu đủ để
     * nó sai được.
     *
     * <p>Khóa ôn mở gần đây hơn khóa chính, nên trong danh sách khóa của em nó đứng <em>trước</em>:
     * hai khóa cùng phủ lên hôm nay thì thứ tự rơi về {@code starts_on desc}. Chọn ngày như vậy có
     * chủ đích — nếu khóa ôn xếp sau thì bỏ bộ lọc đi vẫn ra kết quả đúng và phép thử không bắt được
     * gì.
     */
    private void khoaOn() {
        Long chuongTrinh2 = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('ONTHI-BONDAI', 'Lớp ôn thi bốn dải', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        Long mau2 = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu ôn thi bốn dải', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh2);
        Long khoa2 = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status,
                                              created_at, updated_at)
                values (?, 'Khóa ôn bốn dải 2094/2095', '2094-2095b',
                        current_date - 10, current_date + 60, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau2);
        // Khóa ôn mới tới tuần 2 trong khi khóa chính đã ở tuần 10: đúng độ lệch làm tiết tuần 10
        // rơi từ "tuần này" xuống "tương lai" nếu hỏi nhầm khóa.
        for (int tuan = 1; tuan <= 8; tuan++) {
            jdbc.update("""
                    insert into course_weeks (course_instance_id, week_no, starts_on, ends_on, is_break,
                                              edited_by_hand, created_at, updated_at)
                    values (?, ?, current_date + ?, current_date + ?, false, false, now(), now())""",
                    khoa2, tuan, (tuan - 2) * 7 - 3, (tuan - 2) * 7 + 3);
        }
        long lopOn = taoLop("BONDAI-ON", "Lớp ôn bốn dải", khoa2);
        jdbc.update("""
                insert into class_students (class_id, student_id, created_at, updated_at)
                values (?, ?, now(), now())""", lopOn, emA);
    }

    private long taoLop(String ma, String ten, Long khoa) {
        Long khoi = jdbc.queryForObject(
                "select id from grades where deleted_at is null order by id limit 1", Long.class);
        Long lop = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, ma, ten, khoi);
        jdbc.update("""
                insert into class_courses (class_id, course_instance_id, created_at, updated_at)
                values (?, ?, now(), now())""", lop, khoa);
        return lop;
    }

    private long taoHocSinh(String thu, String ten, String taiKhoan, long lop) {
        Long em = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status,
                                   created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, 'STUDENT', 'ACTIVE', now(), now())
                returning id""", Long.class, thu, ten, taiKhoan);
        jdbc.update("""
                insert into class_students (class_id, student_id, created_at, updated_at)
                values (?, ?, now(), now())""", lop, em);
        return em;
    }

    /** Một tiết ở tuần này, kèm bài riêng của nó để {@code NOI_TUAN} có chỗ đọc ra số tuần. */
    private long tiet(Long mach, Long chuong, int soTuan) {
        Long bai = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong, "Bài của tuần " + soTuan, soTuan);
        return jdbc.queryForObject("""
                insert into program_periods (strand_id, period_no, week_no, term, lesson_id, title,
                                             period_kind, created_at, updated_at)
                values (?, ?, ?, 1, ?, ?, 'BAI_MOI', now(), now())
                returning id""", Long.class, mach, soTuan, soTuan, bai, "Tiết tuần " + soTuan);
    }

    private void gan(String ten, String noiDenLoai, Long neo, Long lop, String doiTuong, int thuTu) {
        Long tep = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, created_at, updated_at)
                values (?, 'KHBD', ?, '', 'PUBLISHED', now(), now())
                returning id""", Long.class, ten, doiTuong);
        jdbc.update("""
                insert into program_resources
                    (noi_den_loai, neo, lop_id, resource_type, resource_ref_id, title, order_index,
                     status, audience, created_at, updated_at)
                values (?, ?, ?, 'DOCUMENT', ?, ?, ?, 'PUBLISHED', ?, now(), now())""",
                noiDenLoai, neo, lop, tep, ten, thuTu, doiTuong);
    }

    // ---- đọc kết quả ----

    private JsonNode danhSach(Authentication ai) throws Exception {
        var phanHoi = mockMvc.perform(get("/api/programs/" + chuongTrinh + "/resources")
                        .with(authentication(ai)).contentType(MediaType.APPLICATION_JSON))
                .andReturn().getResponse();
        String than = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET nội dung chương trình → %s", than).isEqualTo(200);
        return mapper.readTree(than).get("data");
    }

    private List<String> ten(JsonNode ds) {
        return java.util.stream.StreamSupport.stream(ds.spliterator(), false)
                .map(dong -> dong.get("title").asText()).toList();
    }

    private int viTri(JsonNode ds, String tenDong) {
        int i = ten(ds).indexOf(tenDong);
        assertThat(i).as("không tìm thấy '%s' trong %s", tenDong, ten(ds)).isGreaterThanOrEqualTo(0);
        return i;
    }

    private String dai(JsonNode ds, String tenDong) {
        return ds.get(viTri(ds, tenDong)).get("dai").asText();
    }

    private Authentication hocSinh(long id) {
        return ai(id, "hs" + id + "@bondai.test", "STUDENT");
    }

    private Authentication quanTri() {
        return ai(1L, "admin@bondai.test", "ADMIN");
    }

    private Authentication ai(long id, String thu, String vai) {
        return new UsernamePasswordAuthenticationToken(new Math10Principal(id, thu, vai), null,
                List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
