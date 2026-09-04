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
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * Nơi đến của một dòng phân phối: trục thứ ba, tách hẳn khỏi đối tượng và trạng thái.
 *
 * <p>Trước lát này một dòng gắn chỉ tới được đúng một chỗ — một bài — vì nơi đến của nó là cột
 * {@code lesson_id} và không có gì khác. Bốn chỗ gắn tài liệu đang chạy song song trong hệ chính là
 * hậu quả: mỗi lần cần gắn vào một chỗ không phải bài, người ta dựng thêm một bảng. Lát này cho một
 * bảng trả lời đủ bảy nơi đến, nên phép thử của nó là bảy nơi ấy có thật sự tới đúng chỗ không.
 *
 * <p>Bảy nơi đến, hai trục: <em>neo vào nội dung nào</em> (năm loại) nhân <em>hẹp tới lớp nào</em>
 * (có hoặc không). Nên bốn ca đầu đi theo năm loại neo và ca thứ năm đi theo trục lớp; ghép đủ hai
 * trục mới ra bảy, và kiểm một trục thôi thì cái còn lại là chỗ trống không ai canh.
 *
 * <p>Ca {@code chuyenDeKhongToiBaiNao} canh nhánh {@code else false} — nhánh mà mọi câu
 * {@code case} đều có và không ai nghĩ tới. Thêm một loại neo mới mà quên khai trong luật đọc thì
 * hoặc nó im lặng không tới đâu, hoặc nó im lặng tới mọi nơi; hai kết cục ấy cách nhau đúng một
 * dòng, và chỉ một trong hai là hỏng-an-toàn.
 *
 * <p>Ca cổng tệp là ca đắt nhất: danh sách vừa rộng ra bảy lần, và cổng tệp không tự rộng theo. Rộng
 * lệch về phía nào cũng hỏng — cổng hẹp hơn thì học liệu hiện tên rồi bấm vào báo cấm, cổng rộng hơn
 * thì là lỗ. Hai bên phải hỏi chung một hàm.
 *
 * <p>Hai ca cuối hỏi CSDL chứ không hỏi Java, vì hàng rào thật nằm ở đó: tầng Java chỉ dịch lỗi ra
 * tiếng Việt, và một đường ghi thứ ba viết sau này sẽ không đi qua tầng ấy.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Nơi đến của dòng phân phối")
class NoiDenCuaDongPhanPhoiTest {

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private long chuongTrinh, daiSo, hinhHoc, nutChuyenDe;
    private long baiA, baiB, baiC;
    private long tietCuaBaiA;
    private long lopA, lopB;
    private long em, emKhac, co, qt;
    private long tepChung, tepTiet, tepRiengLopA;
    private long tlDapAn;

    @BeforeAll
    void dungDuLieu() throws Exception {
        qt = nguoiDung("qt@noiden.test", "qt.noi.den", "ADMIN");
        co = nguoiDung("co@noiden.test", "co.noi.den", "TEACHER");
        em = nguoiDung("em@noiden.test", "em.noi.den", "STUDENT");
        emKhac = nguoiDung("emkhac@noiden.test", "em.khac.noi.den", "STUDENT");

        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-NOIDEN', 'Toan 10 noi den', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 1 - Mệnh đề và tập hợp', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        baiA = bai(chuong, "Bài 1 - Mệnh đề", 1);
        baiB = bai(chuong, "Bài 2 - Tập hợp", 2);
        // Bài không có tiết nào: chỗ duy nhất phân biệt "mạch tới mọi bài của chương trình" với
        // "mạch tới bài có tiết trong mạch ấy". Bỏ bài này đi thì hai luật khác hẳn nhau cùng xanh.
        baiC = bai(chuong, "Bài 3 - Bài chưa xếp tiết", 3);

        daiSo = mach("DAI_SO", "Đại số", 1);
        hinhHoc = mach("HINH_HOC", "Hình học", 2);
        tietCuaBaiA = tiet(daiSo, 1, 1, baiA, "Mệnh đề chứa biến");
        tiet(daiSo, 2, 1, baiB, "Tập hợp con");
        tiet(hinhHoc, 1, 1, baiB, "Điểm và đường thẳng");

        nutChuyenDe = jdbc.queryForObject("""
                insert into taxonomy_node (subject, depth, title, slug, status, created_at, updated_at)
                values ('TOAN_10', 1, 'Hàm số bậc hai', 'ham-so-bac-hai-noiden', 'ACTIVE', now(), now())
                returning id""", Long.class);

        long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu nơi đến', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        lopA = lop("NOIDEN-10A", "Lớp 10A nơi đến", khoaHoc(mau, "Khóa 10A", "2026-2027-ND-A"));
        lopB = lop("NOIDEN-10B", "Lớp 10B nơi đến", khoaHoc(mau, "Khóa 10B", "2026-2027-ND-B"));
        vaoLop(lopA, em);
        vaoLop(lopB, emKhac);

        tepChung = tep("noi-quy.pdf");
        tepTiet = tep("phieu-tiet-1.pdf");
        tepRiengLopA = tep("de-rieng-10a.pdf");
        tlDapAn = taiLieu("Đáp án và barem chương 1", null, "TEACHER_ONLY");

        // Năm dòng, năm nơi đến, đi qua đúng cửa ghi thật. Chèn thẳng SQL ở đây là tự trả lời hộ nửa
        // câu hỏi: chuyện cần canh gồm cả việc cửa ghi có đặt đúng cột neo hay không.
        phanPhoi("""
                {"noiDenLoai":"HE_THONG","resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Nội quy lớp học 2026","orderIndex":1,"status":"PUBLISHED"}"""
                .formatted(taiLieu("Nội quy lớp học 2026", tepChung, "STUDENT_ALLOWED")), 200);
        phanPhoi("""
                {"noiDenLoai":"TIET","neo":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Phiếu của tiết mệnh đề","orderIndex":1,"status":"PUBLISHED"}"""
                .formatted(tietCuaBaiA, taiLieu("Phiếu của tiết mệnh đề", tepTiet, "STUDENT_ALLOWED")), 200);
        phanPhoi("""
                {"noiDenLoai":"MACH","neo":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Sổ tay công thức đại số","orderIndex":1,"status":"PUBLISHED"}"""
                .formatted(daiSo, taiLieu("Sổ tay công thức đại số", null, "STUDENT_ALLOWED")), 200);
        phanPhoi("""
                {"noiDenLoai":"CHUYEN_DE","neo":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Chuyên đề hàm số bậc hai","orderIndex":1,"status":"PUBLISHED"}"""
                .formatted(nutChuyenDe, taiLieu("Chuyên đề hàm số bậc hai", null, "STUDENT_ALLOWED")), 200);
        phanPhoi("""
                {"noiDenLoai":"BAI","lessonId":%d,"lopId":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Đề riêng của lớp 10A","orderIndex":1,"status":"PUBLISHED"}"""
                .formatted(baiA, lopA, taiLieu("Đề riêng của lớp 10A", tepRiengLopA, "STUDENT_ALLOWED")), 200);
    }

    @Test @Order(1)
    @DisplayName("Dòng toàn hệ thống tới mọi bài, kể cả bài chưa xếp tiết")
    void toanHeThongToiMoiBai() throws Exception {
        assertThat(tenHocLieu(baiA, em)).contains("Nội quy lớp học 2026");
        assertThat(tenHocLieu(baiB, em)).contains("Nội quy lớp học 2026");
        assertThat(tenHocLieu(baiC, em))
                .as("""
                    nội quy không neo vào nội dung nào nên nó không cần bài phải có tiết; \
                    tới được sáu bài rồi hụt bài thứ bảy thì đó không phải là 'toàn hệ thống'""")
                .contains("Nội quy lớp học 2026");
    }

    @Test @Order(2)
    @DisplayName("Dòng của một tiết chỉ tới đúng bài mà tiết ấy dạy")
    void tietChiToiBaiCuaTietAy() throws Exception {
        assertThat(tenHocLieu(baiA, em)).contains("Phiếu của tiết mệnh đề");
        assertThat(tenHocLieu(baiB, em))
                .as("hai tiết cùng một mạch nhưng khác bài; lẫn sang nhau thì trục tiết vô nghĩa")
                .doesNotContain("Phiếu của tiết mệnh đề");
    }

    @Test @Order(3)
    @DisplayName("Dòng của một mạch tới mọi bài có tiết trong mạch ấy, và dừng ở đó")
    void machToiMoiBaiCoTietTrongMach() throws Exception {
        assertThat(tenHocLieu(baiA, em)).contains("Sổ tay công thức đại số");
        assertThat(tenHocLieu(baiB, em))
                .as("bài 2 có tiết Đại số, nên sổ tay đại số tới được — dù tiết ấy không phải tiết đầu")
                .contains("Sổ tay công thức đại số");
        assertThat(tenHocLieu(baiC, em))
                .as("""
                    bài chưa xếp tiết nào thì không thuộc mạch nào; tới được nó nghĩa là luật đang \
                    đọc thành 'mọi bài của chương trình', một câu hỏi khác hẳn""")
                .doesNotContain("Sổ tay công thức đại số");
    }

    @Test @Order(4)
    @DisplayName("Dòng của nút chuyên đề không tới bài nào cả")
    void chuyenDeKhongToiBaiNao() throws Exception {
        for (long b : List.of(baiA, baiB, baiC)) {
            assertThat(tenHocLieu(b, em))
                    .as("""
                        nút chuyên đề không phải một bài, nên câu hỏi 'nút này có phải bài L không' \
                        chỉ có một câu trả lời đúng. Nhánh else của luật đọc phải là 'không tới đâu' — \
                        rơi vào 'tới mọi nơi' thì mỗi loại neo thêm vào sau này là một lỗ""")
                    .doesNotContain("Chuyên đề hàm số bậc hai");
        }
    }

    @Test @Order(5)
    @DisplayName("Dòng gắn cho một lớp chỉ tới học sinh lớp ấy")
    void dongCuaLopChiToiHocSinhLopAy() throws Exception {
        assertThat(tenHocLieu(baiA, em)).contains("Đề riêng của lớp 10A");
        assertThat(tenHocLieu(baiA, emKhac))
                .as("""
                    cùng một bài, cùng một chương trình, cùng một đối tượng học sinh — thứ duy nhất \
                    khác là lớp. Bỏ trục lớp thì đề của lớp này ra thẳng lớp kia mà không ai thấy sai""")
                .doesNotContain("Đề riêng của lớp 10A");
        assertThat(tenHocLieu(baiA, emKhac))
                .as("hẹp một dòng tới một lớp không được làm hẹp những dòng còn lại")
                .contains("Nội quy lớp học 2026", "Phiếu của tiết mệnh đề");
    }

    @Test @Order(6)
    @DisplayName("Giáo viên thấy cả dòng gắn riêng cho lớp khác")
    void giaoVienThayCaDongCuaLopKhac() throws Exception {
        assertThat(tenHocLieu(baiA, co))
                .as("""
                    với người lớn 'gắn cho lớp nào' là thông tin phải thấy, không phải hàng rào; \
                    hàng rào của họ là đối tượng. Chặn cả họ thì cô không soạn được cho lớp mình dạy""")
                .contains("Đề riêng của lớp 10A");
    }

    @Test @Order(7)
    @DisplayName("Cổng tệp mở đúng bằng danh sách, không rộng hơn và không hẹp hơn")
    void congTepMoTheoDungDanhSach() throws Exception {
        assertThat(moTep(tepChung, em))
                .as("dòng toàn hệ thống hiện tên trong danh sách thì tệp của nó phải tải được")
                .isNotEqualTo(403);
        assertThat(moTep(tepTiet, em))
                .as("""
                    đây là chỗ dễ hỏng nhất của cả lát: danh sách đi qua trục nơi đến còn cổng thì \
                    vẫn so lesson_id, nên học liệu hiện tên rồi bấm vào báo cấm""")
                .isNotEqualTo(403);
        assertThat(moTep(tepRiengLopA, emKhac))
                .as("giấu khỏi danh sách mà cổng vẫn phát cho ai đoán trúng số hiệu thì việc giấu vô nghĩa")
                .isEqualTo(403);
        assertThat(moTep(tepRiengLopA, em)).isNotEqualTo(403);
    }

    @Test @Order(8)
    @DisplayName("Cửa phân phối không nới rộng được đối tượng so với tài liệu gốc")
    void khongNoiRongDoiTuongQuaCuaPhanPhoi() throws Exception {
        String than = phanPhoi("""
                {"noiDenLoai":"HE_THONG","resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Đáp án phát toàn trường","status":"PUBLISHED","audience":"STUDENT_ALLOWED"}"""
                .formatted(tlDapAn), 400);

        assertThat(than)
                .as("""
                    cửa ghi thứ hai vào cùng một bảng là chỗ trần đối tượng dễ hụt nhất, và hụt ở đây \
                    thì nó còn tệ hơn không có trần: nơi đến rộng nhất gặp đối tượng rộng nhất""")
                .contains("chỉ dành cho giáo viên");
        assertThat(tenHocLieu(baiA, em)).doesNotContain("Đáp án phát toàn trường");
    }

    @Test @Order(9)
    @DisplayName("Nơi đến phải nói đủ chỗ neo, và chỉ đúng chỗ neo của nó")
    void noiDenPhaiNoiDuChoNeo() throws Exception {
        long tl = taiLieu("Tài liệu để thử neo", null, "STUDENT_ALLOWED");

        assertThat(phanPhoi(neoThu("HE_THONG", "\"lessonId\":" + baiA, tl), 400))
                .as("toàn hệ thống mà kèm bài là hai câu trả lời cho một câu hỏi; CSDL cũng chặn, "
                        + "nhưng người gắn xứng đáng nhận một câu tiếng Việt")
                .contains("không neo vào bài");
        assertThat(phanPhoi(neoThu("MACH", null, tl), 400)).contains("phải nói mạch nào");
        assertThat(phanPhoi(neoThu("BAI", null, tl), 400)).contains("phải nói bài nào");
        assertThat(phanPhoi(neoThu("MACH", "\"neo\":999999", tl), 404))
                .as("""
                    neo vào mạch không có thật thì dòng ấy không phát ra ở đâu và cũng không báo gì — \
                    dữ liệu sai nhìn không ra, chỉ khác là lần này nó nằm ở cột mới toanh""")
                .contains("Không tìm thấy");
        assertThat(phanPhoi(neoThu("CA_TRUONG", "\"neo\":1", tl), 400)).contains("Nơi đến không hợp lệ");
    }

    @Test @Order(10)
    @DisplayName("Thứ tự kế tiếp đếm trong đúng nhóm chỗ đứng của dòng")
    void thuTuDemTrongDungNhomChoDung() throws Exception {
        // Ba tài liệu khác nhau chứ không phải một dùng ba lần: một nguồn chỉ gắn được một lần vào
        // một chỗ đến, nên hai dòng đầu — cùng bài 3, cùng không lớp — sẽ đụng luật ấy trước khi
        // kịp trả lời câu hỏi về thứ tự, và ca này lại xanh/đỏ vì một chuyện khác hẳn tên nó.
        long tlMot = taiLieu("Tài liệu đếm thứ tự 1", null, "STUDENT_ALLOWED");
        long tlHai = taiLieu("Tài liệu đếm thứ tự 2", null, "STUDENT_ALLOWED");
        long tlBa = taiLieu("Tài liệu đếm thứ tự 3", null, "STUDENT_ALLOWED");

        assertThat(thuTuMoi("""
                {"noiDenLoai":"BAI","lessonId":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Dòng thứ nhất của bài 3","status":"PUBLISHED"}""".formatted(baiC, tlMot)))
                .as("bài 3 chưa có dòng nào nên dòng đầu tiên đứng ở vị trí 1")
                .isEqualTo(1);
        assertThat(thuTuMoi("""
                {"noiDenLoai":"BAI","lessonId":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Dòng thứ hai của bài 3","status":"PUBLISHED"}""".formatted(baiC, tlHai)))
                .isEqualTo(2);
        // Chỗ đứng thứ ba đi vào một tiết mới toanh. Trước đây nó đi vào "toàn hệ thống" và đòi
        // số 2 — đúng, nhưng đúng nhờ nhóm ấy đang sẵn có đúng một dòng, mà dòng ấy có mặt hay
        // không lại do một ca khác của lớp này quyết. Vòng đột biến M7 lôi chuyện ấy ra: gỡ trần
        // đối tượng đi thì ca này đỏ, dù nó chẳng nói gì về đối tượng. Nhóm mới tinh thì con số
        // tự nó đứng vững, không nhờ ai.
        long tietRieng = tiet(hinhHoc, 71, 7, baiC, "Tiết riêng để đếm thứ tự");
        assertThat(thuTuMoi("""
                {"noiDenLoai":"TIET","neo":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Phiếu của tiết riêng","status":"PUBLISHED"}""".formatted(tietRieng, tlBa)))
                .as("""
                    đếm chung cả bảng thì hai dòng ở hai nơi đến khác nhau tranh nhau vị trí, và \
                    người sắp lại thứ tự của một bài sẽ thấy số nhảy theo việc của người khác""")
                .isEqualTo(1);
    }

    @Test @Order(11)
    @DisplayName("CSDL tự canh chỗ đứng của dòng, không nhờ tầng Java")
    void csdlCanhChoDungCuaDong() {
        assertThatThrownBy(() -> jdbc.update("""
                insert into program_resources
                    (lesson_id, noi_den_loai, neo, resource_type, resource_ref_id, title, order_index,
                     status, audience, created_at, updated_at)
                values (?, 'BAI', ?, 'DOCUMENT', ?, 'Dòng bài mang thêm neo', 90,
                        'PUBLISHED', 'STUDENT_ALLOWED', now(), now())""",
                baiA, daiSo, tlDapAn))
                .as("""
                    một dòng BAI mang thêm neo trỏ vào mạch là hai sự thật về cùng một câu hỏi; \
                    câu đọc nào tin vào neo sẽ phát nó ra ở chỗ thứ hai mà không ai biết""")
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);

        // Hai dòng tranh chỗ 91 phải là hai tài liệu khác nhau. Dùng chung một tài liệu thì dòng thứ
        // hai chết vì "một nguồn gắn một lần vào một chỗ" chứ không phải vì tranh thứ tự, và ca này
        // vẫn xanh sau khi chỉ mục thứ tự bị gỡ mất — xanh vì lý do khác là chưa canh được gì.
        long tlChiem = taiLieu("Tài liệu chiếm chỗ 91", null, "TEACHER_ONLY");
        long tlKhac = taiLieu("Tài liệu tranh chỗ 91", null, "TEACHER_ONLY");
        // Dòng chiếm chỗ dùng tài liệu riêng chứ không mượn tlDapAn. Ca 8 thử gắn chính tlDapAn
        // vào toàn hệ thống và bị trần đối tượng chặn, nên chỗ ấy đang trống — nhưng "trống nhờ
        // một ca khác" là sợi dây vô hình giữa hai ca: gỡ trần ra là ca này chết vì trùng nguồn
        // chứ không phải vì tranh thứ tự, và tên ca sẽ nói dối.
        jdbc.update("""
                insert into program_resources
                    (noi_den_loai, resource_type, resource_ref_id, title, order_index, status, audience,
                     created_at, updated_at)
                values ('HE_THONG', 'DOCUMENT', ?, 'Dòng hệ thống chiếm chỗ 91', 91,
                        'PUBLISHED', 'TEACHER_ONLY', now(), now())""", tlChiem);
        assertThatThrownBy(() -> jdbc.update("""
                insert into program_resources
                    (noi_den_loai, resource_type, resource_ref_id, title, order_index, status, audience,
                     created_at, updated_at)
                values ('HE_THONG', 'DOCUMENT', ?, 'Dòng hệ thống tranh chỗ 91', 91,
                        'PUBLISHED', 'TEACHER_ONLY', now(), now())""", tlKhac))
                .as("""
                    chỉ mục duy nhất cũ canh trên (lesson_id, order_index), mà dòng toàn hệ thống \
                    không có bài — NULL trong chỉ mục duy nhất của Postgres không đụng nhau, nên \
                    mọi dòng ấy đều 'khác nhau' và thứ tự lại trùng được""")
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }

    @Test @Order(12)
    @DisplayName("Một nguồn gắn một lần vào một chỗ, nhưng hai lớp là hai chỗ")
    void motNguonMotLanVaoMotCho() throws Exception {
        long de = taiLieu("Đề kiểm tra giữa kỳ dùng chung", null, "STUDENT_ALLOWED");

        phanPhoi(giaoDe(de, baiB, lopA), 200);
        assertThat(phanPhoi(giaoDe(de, baiB, lopB), 200))
                .as("""
                    đây là nhánh D của kế hoạch: cùng một đề, cùng một bài, hai lớp. Chỉ mục cũ canh \
                    trên (lesson_id, loại, nguồn) nên nó không thấy lớp, và lớp thứ hai lãnh một lỗi \
                    khóa trùng — nhân bản tệp lên thành hai tài liệu là cách người ta sẽ tự chữa, rồi \
                    sửa đề một chỗ quên chỗ kia""")
                .contains("Đã phân phối");

        assertThat(phanPhoi(giaoDe(de, baiB, lopA), 400))
                .as("còn đúng chỗ cũ thì chặn, và chặn bằng một câu đọc được chứ không phải mã 500")
                .contains("đã được gắn vào đúng chỗ ấy rồi");
    }

    private String giaoDe(long taiLieu, long bai, long lop) {
        return """
                {"noiDenLoai":"BAI","lessonId":%d,"lopId":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Đề kiểm tra giữa kỳ","status":"PUBLISHED"}""".formatted(bai, lop, taiLieu);
    }

    // ==================== gọi và đọc ====================

    @Test @Order(13)
    @DisplayName("Gắn vào tiết kiểm tra mà quên khai đối tượng thì mặc định là chỉ-giáo-viên")
    void tietKiemTraMacDinhChiGiaoVien() throws Exception {
        long tietKt = tietLoai(daiSo, 91, 9, baiA, "Kiểm tra giữa kỳ", "KIEM_TRA");
        long de = taiLieu("Đề kiểm tra giữa kỳ", tep("de-giua-ky.pdf"), "STUDENT_ALLOWED");

        phanPhoi("""
                {"noiDenLoai":"TIET","neo":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Đề kiểm tra giữa kỳ","status":"PUBLISHED"}"""
                .formatted(tietKt, de), 200);

        // Tài liệu tự nó khai cho học sinh, nên trước lát này dòng gắn cũng theo đó mà mở. Cái che nó
        // lại là cổng thời gian: đề nằm ở tuần chưa tới. Gỡ cổng đi thì phải có người khác đứng chỗ ấy.
        assertThat(tenHocLieu(baiA, em)).doesNotContain("Đề kiểm tra giữa kỳ");
        assertThat(tenHocLieu(baiA, co)).contains("Đề kiểm tra giữa kỳ");
    }

    @Test @Order(14)
    @DisplayName("Sàn của tiết kiểm tra là sàn, không phải trần: khai rõ cho học sinh thì vẫn được")
    void tietKiemTraVanPhatLaiDuocSauKhiCham() throws Exception {
        long tietKt = tietLoai(daiSo, 92, 9, baiB, "Kiểm tra 15 phút", "KIEM_TRA");
        long de = taiLieu("Đề 15 phút đã chấm", tep("de-15p.pdf"), "STUDENT_ALLOWED");

        phanPhoi("""
                {"noiDenLoai":"TIET","neo":%d,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Đề 15 phút đã chấm","status":"PUBLISHED","audience":"STUDENT_ALLOWED"}"""
                .formatted(tietKt, de), 200);

        // Chấm xong phát lại cả lớp là việc thường ngày. Biến mặc định thành lệnh cấm là lấy mất một
        // việc thật để đổi lấy một dòng an toàn trên giấy.
        assertThat(tenHocLieu(baiB, em)).contains("Đề 15 phút đã chấm");
    }

    /** Như {@link #tiet} nhưng nói rõ loại tiết, vì sàn đối tượng hỏi đúng cột ấy. */
    private long tietLoai(long mach, int soTiet, int soTuan, Long bai, String ten, String loai) {
        return jdbc.queryForObject("""
                insert into program_periods
                    (strand_id, period_no, week_no, term, lesson_id, title, period_kind, created_at, updated_at)
                values (?, ?, ?, 1, ?, ?, ?::varchar, now(), now())
                returning id""", Long.class, mach, soTiet, soTuan, bai, ten, loai);
    }

    private List<String> tenHocLieu(long bai, long ai) throws Exception {
        var phanHoi = mockMvc.perform(get("/api/lessons/{id}/program-resources", bai)
                        .with(authentication(ai(ai))))
                .andReturn().getResponse();
        String than = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET học liệu của bài %d → %s", bai, than).isEqualTo(200);
        return danhSach(than).stream().map(d -> (String) d.get("title")).toList();
    }

    private int moTep(long tep, long ai) throws Exception {
        return mockMvc.perform(get("/api/files/{id}", tep).with(authentication(ai(ai))))
                .andReturn().getResponse().getStatus();
    }

    /** Gọi cửa phân phối và đòi đúng mã trạng thái đã dự đoán; trả về thân để soi câu từ chối. */
    private String phanPhoi(String than, int mongDoi) throws Exception {
        var phanHoi = mockMvc.perform(post("/api/admin/phan-phoi").with(authentication(ai(qt)))
                        .contentType(MediaType.APPLICATION_JSON).content(than))
                .andReturn().getResponse();
        String traVe = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("POST /api/admin/phan-phoi → %s", traVe).isEqualTo(mongDoi);
        return traVe;
    }

    private String neoThu(String loai, String them, long taiLieu) {
        return """
                {"noiDenLoai":"%s"%s,"resourceType":"DOCUMENT","resourceRefId":%d,
                 "title":"Thử neo %s","status":"PUBLISHED"}"""
                .formatted(loai, them == null ? "" : "," + them, taiLieu, loai);
    }

    private int thuTuMoi(String than) throws Exception {
        return ((Number) doc(phanPhoi(than, 200)).get("order_index")).intValue();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> danhSach(String than) throws Exception {
        return (List<Map<String,Object>>) json.readValue(than, Map.class).get("data");
    }

    @SuppressWarnings("unchecked")
    private Map<String,Object> doc(String than) throws Exception {
        return (Map<String,Object>) json.readValue(than, Map.class).get("data");
    }

    // ==================== dựng dữ liệu ====================

    private long bai(long chuong, String ten, int thuTu) {
        return jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, ?, ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong, ten, thuTu);
    }

    private long mach(String ma, String ten, int thuTu) {
        return jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, ?, ?, ?, now(), now())
                returning id""", Long.class, chuongTrinh, ma, ten, thuTu);
    }

    private long tiet(long mach, int soTiet, int soTuan, Long bai, String ten) {
        return jdbc.queryForObject("""
                insert into program_periods
                    (strand_id, period_no, week_no, term, lesson_id, title, period_kind, created_at, updated_at)
                values (?, ?, ?, 1, ?, ?, 'BAI_MOI', now(), now())
                returning id""", Long.class, mach, soTiet, soTuan, bai, ten);
    }

    private long tep(String ten) {
        return jdbc.queryForObject("""
                insert into file_assets (file_name, file_url, mime_type, file_size, created_at, updated_at)
                values (?, ?, 'application/pdf', 2048, now(), now())
                returning id""", Long.class, ten, "https://vi-du.test/noiden/" + ten);
    }

    private long taiLieu(String ten, Long tep, String doiTuong) {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, file_asset_id, status, created_at, updated_at)
                values (?, 'KHBD', ?::varchar, '', ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, ten, doiTuong, tep);
    }

    private long khoaHoc(long mau, String ten, String namHoc) {
        return jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, ?, ?, '2026-10-26'::date, '2027-06-30'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau, ten, namHoc);
    }

    private long lop(String ma, String ten, long khoaHoc) {
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        Long lop = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id""", Long.class, ma, ten, khoi);
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())",
                lop, khoaHoc);
        return lop;
    }

    private void vaoLop(long lop, long em) {
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())",
                lop, em);
    }

    private long nguoiDung(String thu, String tenTaiKhoan, String vai) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?::varchar, 'ACTIVE', now(), now())
                returning id""", Long.class, thu, tenTaiKhoan, tenTaiKhoan, vai);
    }

    private Authentication ai(long nguoi) {
        String vai = String.valueOf(jdbc.queryForObject("select role_code from users where id=?", String.class, nguoi));
        return new UsernamePasswordAuthenticationToken(
                new Math10Principal(nguoi, "nguoi-" + nguoi + "@noiden.test", vai),
                null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
