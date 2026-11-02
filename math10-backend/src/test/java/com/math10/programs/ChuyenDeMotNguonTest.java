package com.math10.programs;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
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
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Chuyên đề chỉ còn một chỗ định nghĩa, và luồng nội dung không phát ra thứ chưa xuất bản.
 *
 * <p>Trước lát này có hai bảng cùng tự nhận là "chuyên đề". {@code taxonomy_node} là cây thật: có
 * cha con, có gộp/tách, có màn hình quản trị đang chạy, và đã được {@code documents.taxonomy_node_id}
 * lẫn {@code class_curriculum} trỏ tới. {@code special_topics} là một bảng phẳng sinh sau, có bốn
 * endpoint quản trị và <em>không một màn hình nào</em> gọi tới chúng — nghĩa là đường ghi đã chết từ
 * lúc sinh ra, trong khi đường đọc vẫn sống: tab "Chuyên đề" của học sinh đọc
 * {@code program_resources} loại {@code SPECIAL_TOPIC}, mà loại ấy chỉ trỏ được vào
 * {@code special_topics}. Một tab vĩnh viễn rỗng, và cái rỗng ấy trông hệt như "trường chưa soạn
 * chuyên đề nào" chứ không như "tính năng này không có cách nào tạo nội dung".
 *
 * <p>Lát này cho {@code SPECIAL_TOPIC} trỏ vào {@code taxonomy_node} rồi bỏ hẳn
 * {@code special_topics}. Cột {@code related_chapter_id} của bảng cũ <b>không</b> được bê sang: xem
 * ghi chú ở nhóm "Một nguồn duy nhất" bên dưới.
 *
 * <p>Nhóm thứ ba là chỗ nặng nhất và không nằm trong phát biểu ban đầu của lát. Câu lệnh đọc luồng
 * nội dung chỉ lọc trạng thái của chính {@code program_resources}; nó không hỏi gì về thứ mà mục ấy
 * trỏ tới, trừ video (đã vá ở lát kho video). Nên một mục PUBLISHED trỏ vào tài liệu còn là bản
 * nháp, hoặc vào tài liệu đã xoá, vẫn phát tiêu đề ra cho mọi người đã đăng nhập. Vá riêng cho từng
 * loại chính là cách lỗ video sống sót lâu như vậy, nên ở đây cả bốn loại đi chung một luật.
 *
 * <p>Quy ước của dự án mà lớp này dựa vào: mọi lượt gọi thành công trả HTTP <b>200</b> — con số 201
 * nằm trong trường {@code code} của thân phản hồi. {@code BusinessException} mới ra 400 thật, và
 * {@code ResourceNotFoundException} ra 404.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Chuyên đề: một nguồn duy nhất")
class ChuyenDeMotNguonTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    @Qualifier("requestMappingHandlerMapping")
    private RequestMappingHandlerMapping duongDanDaKhaiBao;

    private final ObjectMapper json = new ObjectMapper();
    /** order_index của program_resources có ràng buộc duy nhất theo bài; slug của nút cũng vậy. */
    private final AtomicInteger dem = new AtomicInteger();

    private long quanTri, giaoVien;
    private long chuongTrinh, chuong, bai;

    @BeforeAll
    void dungDuLieu() {
        quanTri = taoNguoiDung("ADMIN", "qt-chuyen-de");
        giaoVien = taoNguoiDung("TEACHER", "gv-chuyen-de");
        chuongTrinh = taoChuongTrinh("CHUYEN-DE-MOT-NGUON");
        chuong = taoChuong(chuongTrinh, "Chương có chuyên đề");
        bai = taoBai(chuong, "Bài có chuyên đề");
    }

    // ==================== 1. Một nguồn duy nhất ====================

    @Nested
    @DisplayName("Một nguồn duy nhất")
    class MotNguon {

        /**
         * Điều kiện xong của cả lát, phát biểu thành một câu hỏi cho CSDL. Chừng nào bảng còn đó thì
         * "chỉ còn một chỗ định nghĩa chuyên đề" vẫn là lời hứa chứ chưa phải sự thật.
         */
        @Test
        @DisplayName("bảng special_topics không còn tồn tại")
        void bangSpecialTopicsBienMat() {
            assertThat(coBang("special_topics")).isFalse();
            assertThat(coBang("taxonomy_node")).as("bảng ở lại phải còn nguyên").isTrue();
        }

        /**
         * Hỏi thẳng bảng ánh xạ đường dẫn thay vì gọi thử URL: một endpoint đã gỡ trả về mã gì là
         * chuyện của Spring và của {@code GlobalExceptionHandler}, còn câu hỏi ở đây là "có còn
         * đường ghi riêng cho chuyên đề nữa không".
         */
        @Test
        @DisplayName("không còn đường ghi riêng cho special_topics")
        void khongConDuongGhiRieng() {
            List<String> con = duongDanDaKhaiBao.getHandlerMethods().keySet().stream()
                    .map(Object::toString)
                    .filter(x -> x.contains("special-topics"))
                    .toList();
            assertThat(con).as("endpoint còn sót").isEmpty();
        }

        /**
         * Chiều thuận: chuyên đề gắn vào bài bây giờ là một nút của cây phân loại.
         *
         * <p>Không có {@code related_chapter_id} đi kèm, và đó là chủ ý. Bảng cũ có cột ấy, nhưng
         * chương thì thuộc về một bộ sách của một chương trình, còn một nút phân loại dùng chung cho
         * cả khối — kế hoạch A1 đòi nhiều bộ sách song song cho mỗi lớp, nên ép một nút chỉ liên quan
         * tới một chương là ép nó chọn một bộ sách. Chỗ nói "chuyên đề này thuộc chương nào của
         * chương trình nào" chính là dòng {@code program_resources} này: nhiều-nhiều, có thứ tự, và
         * đã được lịch chương trình xếp sẵn.
         */
        @Test
        @DisplayName("gắn chuyên đề vào bài bằng nút của cây phân loại")
        void ganChuyenDeTuCayPhanLoai() throws Exception {
            long nut = taoNut("Bất đẳng thức Cauchy", "ACTIVE");

            MvcResult ketQua = gan("SPECIAL_TOPIC", nut, "Chuyên đề Cauchy");

            assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(200);
            assertThat(tieuDeCuaBai()).contains("Chuyên đề Cauchy");
        }

        @Test
        @DisplayName("nút không có thật thì báo không tìm thấy")
        void nutKhongCoThat() throws Exception {
            MvcResult ketQua = gan("SPECIAL_TOPIC", 999999L, "Chuyên đề mồ côi");

            assertThat(ketQua.getResponse().getStatus()).isEqualTo(404);
        }
    }

    // ==================== 2. Trạng thái của nút ====================

    /**
     * Cây phân loại có bốn trạng thái, và ba trong số đó nghĩa là "đừng gắn tôi vào đâu nữa".
     * {@code validateRef} cũ chỉ hỏi bảng đích có dòng chưa xoá hay không, mà {@code taxonomy_node}
     * không xoá mềm khi lưu trữ hay khi gộp — nó đổi cột {@code status}. Nên nếu chỉ đổi tên bảng
     * trong {@code validateRef} là xong, quản trị sẽ gắn được cả nút đã lưu trữ lẫn nút đã gộp.
     */
    @Nested
    @DisplayName("Trạng thái của nút")
    class TrangThaiNut {

        @Test
        @DisplayName("nút đã lưu trữ thì không gắn vào bài được")
        void nutDaLuuTru() throws Exception {
            long nut = taoNut("Chuyên đề đã lưu trữ", "ARCHIVED");

            MvcResult ketQua = gan("SPECIAL_TOPIC", nut, "Mục trỏ vào nút đã lưu trữ");

            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
            assertThat(than(ketQua)).contains("hoạt động");
        }

        /** Nút đã gộp đã chuyển hết nội dung sang chỗ khác; gắn nó vào là gắn một cái vỏ. */
        @Test
        @DisplayName("nút đã gộp vào nút khác thì không gắn được")
        void nutDaGop() throws Exception {
            long nut = taoNut("Chuyên đề đã gộp", "MERGED");

            MvcResult ketQua = gan("SPECIAL_TOPIC", nut, "Mục trỏ vào nút đã gộp");

            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
        }

        @Test
        @DisplayName("nút đã xoá thì báo không tìm thấy")
        void nutDaXoa() throws Exception {
            long nut = taoNut("Chuyên đề đã xoá", "ACTIVE");
            jdbc.update("update taxonomy_node set deleted_at=now() where id=?", nut);

            MvcResult ketQua = gan("SPECIAL_TOPIC", nut, "Mục trỏ vào nút đã xoá");

            assertThat(ketQua.getResponse().getStatus()).isEqualTo(404);
        }
    }

    // ==================== 3. Đường rò sang người học ====================

    @Nested
    @DisplayName("Đường rò sang người học")
    class DuongRo {

        /**
         * Nút bị lưu trữ <em>sau khi</em> đã gắn — đường ghi không chặn được chuyện này, chỉ đường
         * đọc mới chặn được. Học sinh thấy một dòng có tiêu đề mà bấm vào không có gì thì tệ hơn là
         * không thấy gì, vì nó trông như lỗi của các em.
         */
        @Test
        @DisplayName("chuyên đề bị lưu trữ thì mục trỏ vào nó biến mất khỏi luồng của bài")
        void luuTruThiMucBienMat() throws Exception {
            long nut = taoNut("Chuyên đề rồi sẽ lưu trữ", "ACTIVE");
            ganDuoc("SPECIAL_TOPIC", nut, "Mục trỏ vào chuyên đề sẽ lưu trữ");
            assertThat(tieuDeCuaBai()).as("tiền đề: mục đang hiện").contains("Mục trỏ vào chuyên đề sẽ lưu trữ");

            jdbc.update("update taxonomy_node set status='ARCHIVED' where id=?", nut);

            assertThat(tieuDeCuaBai()).doesNotContain("Mục trỏ vào chuyên đề sẽ lưu trữ");
        }

        /** Hai đường đọc luồng nội dung phải trả lời giống nhau về cùng một mục. */
        @Test
        @DisplayName("đường theo chương trình cũng giấu chuyên đề đã lưu trữ")
        void luuTruThiBienMatCaDuongChuongTrinh() throws Exception {
            long nut = taoNut("Chuyên đề rồi sẽ lưu trữ ở đường chương trình", "ACTIVE");
            ganDuoc("SPECIAL_TOPIC", nut, "Mục chương trình trỏ vào chuyên đề sẽ lưu trữ");
            assertThat(tieuDeCuaChuongTrinh()).as("tiền đề: mục đang hiện")
                    .contains("Mục chương trình trỏ vào chuyên đề sẽ lưu trữ");

            jdbc.update("update taxonomy_node set status='ARCHIVED' where id=?", nut);

            assertThat(tieuDeCuaChuongTrinh()).doesNotContain("Mục chương trình trỏ vào chuyên đề sẽ lưu trữ");
        }

        @Test
        @DisplayName("chuyên đề đang hoạt động thì hiện ra bình thường ở cả hai đường")
        void dangHoatDongThiHien() throws Exception {
            long nut = taoNut("Chuyên đề đang hoạt động", "ACTIVE");
            ganDuoc("SPECIAL_TOPIC", nut, "Mục trỏ vào chuyên đề đang hoạt động");

            assertThat(tieuDeCuaBai()).contains("Mục trỏ vào chuyên đề đang hoạt động");
            assertThat(tieuDeCuaChuongTrinh()).contains("Mục trỏ vào chuyên đề đang hoạt động");
        }

        /**
         * Cùng một lỗ, loại khác. Tài liệu có ba trạng thái DRAFT/PUBLISHED/HIDDEN mà luồng nội dung
         * chưa từng hỏi tới cái nào — bản nháp của người biên soạn lộ tiêu đề cho mọi người đã đăng
         * nhập, giống hệt video trước lát trước.
         */
        @Test
        @DisplayName("tài liệu còn là bản nháp không lộ tiêu đề qua luồng nội dung")
        void taiLieuBanNhapKhongLo() throws Exception {
            long taiLieu = taoTaiLieu("DRAFT");
            ganDuoc("DOCUMENT", taiLieu, "Mục trỏ vào tài liệu bản nháp");

            assertThat(tieuDeCuaBai()).doesNotContain("Mục trỏ vào tài liệu bản nháp");
            assertThat(tieuDeCuaChuongTrinh()).doesNotContain("Mục trỏ vào tài liệu bản nháp");
        }

        @Test
        @DisplayName("tài liệu đã xoá thì mục trỏ vào nó cũng biến mất")
        void taiLieuDaXoaKhongLo() throws Exception {
            long taiLieu = taoTaiLieu("PUBLISHED");
            ganDuoc("DOCUMENT", taiLieu, "Mục trỏ vào tài liệu sẽ bị xoá");
            assertThat(tieuDeCuaBai()).as("tiền đề: mục đang hiện").contains("Mục trỏ vào tài liệu sẽ bị xoá");

            jdbc.update("update documents set deleted_at=now() where id=?", taiLieu);

            assertThat(tieuDeCuaBai()).doesNotContain("Mục trỏ vào tài liệu sẽ bị xoá");
        }

        /**
         * Chiều ngược lại, và là phép thử duy nhất giữ cho bộ lọc mới không quét sạch mọi thứ:
         * {@code worksheets} không có cột trạng thái nào cả, nên luật cho phiếu bài tập chỉ là "còn
         * tồn tại". Viết nhầm thành đòi trạng thái xuất bản thì phiếu bài tập biến mất hết.
         */
        @Test
        @DisplayName("phiếu bài tập không có cột trạng thái vẫn hiện bình thường")
        void phieuBaiTapVanHien() throws Exception {
            long phieu = taoPhieu();
            ganDuoc("EXERCISE", phieu, "Mục trỏ vào phiếu bài tập");

            assertThat(tieuDeCuaBai()).contains("Mục trỏ vào phiếu bài tập");
            assertThat(tieuDeCuaChuongTrinh()).contains("Mục trỏ vào phiếu bài tập");
        }

        @Test
        @DisplayName("phiếu bài tập đã xoá thì mục trỏ vào nó biến mất")
        void phieuDaXoaKhongLo() throws Exception {
            long phieu = taoPhieu();
            ganDuoc("EXERCISE", phieu, "Mục trỏ vào phiếu sẽ bị xoá");
            assertThat(tieuDeCuaBai()).as("tiền đề: mục đang hiện").contains("Mục trỏ vào phiếu sẽ bị xoá");

            jdbc.update("update worksheets set deleted_at=now() where id=?", phieu);

            assertThat(tieuDeCuaBai()).doesNotContain("Mục trỏ vào phiếu sẽ bị xoá");
        }
    }

    // ==================== Hạ tầng ====================

    /** Gắn một tài nguyên vào bài qua đường quản trị, để {@code validateRef} thật sự chạy. */
    private MvcResult gan(String loai, long tham, String tieuDe) throws Exception {
        return goi(quanTri, "ADMIN", HttpMethod.POST, "/api/admin/lessons/%d/resources".formatted(bai), """
                {"resourceType":"%s","resourceRefId":%d,"title":"%s","orderIndex":%d,"status":"PUBLISHED"}
                """.formatted(loai, tham, tieuDe, dem.incrementAndGet()));
    }

    private void ganDuoc(String loai, long tham, String tieuDe) throws Exception {
        MvcResult ketQua = gan(loai, tham, tieuDe);
        assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(200);
    }

    private MvcResult goi(long nguoi, String vai, HttpMethod phuongThuc, String duongDan, String than)
            throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(phuongThuc, duongDan)
                .with(authentication(danhTinh(nguoi, vai)));
        if (than != null) yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content(than);
        return mockMvc.perform(yeuCau).andReturn();
    }

    private String than(MvcResult ketQua) throws Exception {
        return ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8);
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@chuyende.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }

    /** Tiêu đề các mục mà luồng nội dung của bài trả về cho một người đã đăng nhập. */
    private String tieuDeCuaBai() throws Exception {
        return tieuDe("/api/lessons/%d/program-resources".formatted(bai));
    }

    private String tieuDeCuaChuongTrinh() throws Exception {
        return tieuDe("/api/programs/%d/resources".formatted(chuongTrinh));
    }

    private String tieuDe(String duongDan) throws Exception {
        MvcResult ketQua = goi(giaoVien, "TEACHER", HttpMethod.GET, duongDan, null);
        assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(200);
        StringBuilder o = new StringBuilder();
        for (JsonNode hang : json.readTree(than(ketQua)).get("data")) o.append(hang.get("title").asText()).append('\n');
        return o.toString();
    }

    private boolean coBang(String ten) {
        Integer n = jdbc.queryForObject(
                "select count(*) from information_schema.tables where table_schema='public' and table_name=?",
                Integer.class, ten);
        return n != null && n > 0;
    }

    // ==================== Dựng dữ liệu ====================

    private long taoNguoiDung(String vai, String ten) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, ten + "@chuyende.test", ten, ten, vai);
    }

    private long taoChuongTrinh(String ma) {
        return jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values (?, ?, 'PUBLISHED', now(), now())
                returning id
                """, Long.class, ma, ma);
    }

    private long taoChuong(long chuongTrinhId, String ten) {
        return jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, ?, 1, 'PUBLISHED', now(), now())
                returning id
                """, Long.class, chuongTrinhId, ten);
    }

    private long taoBai(long chuongId, String ten) {
        return jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, ?, 1, 'PUBLISHED', now(), now())
                returning id
                """, Long.class, chuongId, ten);
    }

    /** Nút gốc của cây phân loại. Slug có ràng buộc duy nhất theo (subject, slug) ở nhánh gốc. */
    private long taoNut(String ten, String trangThai) {
        int so = dem.incrementAndGet();
        return jdbc.queryForObject("""
                insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status,
                                           created_at, updated_at)
                values (null, 'TOAN_10', 1, ?, ?, ?, ?, now(), now())
                returning id
                """, Long.class, ten, "chuyen-de-thu-" + so, so, trangThai);
    }

    /** {@code file_url} để rỗng: cột NOT NULL, và không lượt gọi nào ở đây đi ra R2. */
    private long taoTaiLieu(String trangThai) {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, created_at, updated_at)
                values (?, 'KHBD', 'STUDENT_ALLOWED', '', ?, now(), now())
                returning id
                """, Long.class, "Tài liệu chuyên đề " + dem.incrementAndGet(), trangThai);
    }

    private long taoPhieu() {
        return jdbc.queryForObject("""
                insert into worksheets (name, created_by, created_at, updated_at)
                values (?, ?, now(), now())
                returning id
                """, Long.class, "Phiếu chuyên đề " + dem.incrementAndGet(), quanTri);
    }
}
