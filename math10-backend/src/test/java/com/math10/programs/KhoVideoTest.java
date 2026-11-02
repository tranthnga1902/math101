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

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Kho video: hàng rào ghi, ảnh bìa, dấu vết, và đường rò sang người học.
 *
 * <p>Bốn endpoint {@code /api/admin/videos} ra đời bằng cách ghi thẳng SQL, không qua một tầng
 * nghiệp vụ nào. Cổng vai trò thì có — chỉ quản trị vào được — nhưng sau cổng đó không còn gì cả:
 * không kiểm dữ liệu, không ghi nhật ký, và không ai hỏi "video này có thứ gì để xem không". Kết
 * quả là ba loại hỏng khác hẳn nhau mà lớp này chia thành bốn nhóm.
 *
 * <p><b>Một</b>, mọi lỗi nhập đều rơi xuống tận CSDL rồi bật lên thành 500: thiếu tiêu đề vi phạm
 * NOT NULL, mã chương trình sai vi phạm khoá ngoại, thời lượng âm vi phạm CHECK. Người dùng nhận
 * một trang lỗi trắng thay vì một câu nói rõ họ thiếu gì.
 *
 * <p><b>Hai</b>, và đây là chỗ nặng nhất: bảng cho phép một video <em>không có nguồn nào</em> —
 * {@code video_url} và {@code storage_key} đều rỗng. Dòng ấy nằm trong kho, có tiêu đề, có nhóm nội
 * dung, trông y hệt một video thật, và chỉ lộ ra là rỗng đúng vào lúc học sinh bấm vào nó.
 *
 * <p><b>Ba</b>, {@code GET /api/lessons/{'{'}id{'}'}/program-resources} đọc {@code program_resources}
 * mà không nối sang {@code videos}. Đường chị em của nó ({@code /api/programs/{'{'}id{'}'}/resources})
 * có nối, và có lọc {@code v.status='PUBLISHED'}. Chênh lệch giữa hai đường ấy nghĩa là: bản nháp
 * của giáo viên, và cả video đã lưu trữ, vẫn lộ tiêu đề cho bất kỳ ai đã đăng nhập.
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
@DisplayName("Kho video")
class KhoVideoTest {

    /** Một liên kết YouTube thật về hình dạng; không lượt gọi nào trong lớp này đi ra mạng. */
    private static final String LIEN_KET = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    private static final String ANH_BIA = "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper json = new ObjectMapper();
    /** Mã chương trình và tên đăng nhập đều có ràng buộc duy nhất. */
    private final AtomicInteger dem = new AtomicInteger();

    private long quanTri, giaoVien;
    private long chuongTrinhA, chuongA, baiA;
    private long chuongTrinhB, chuongB;

    /**
     * Hai chương trình song song, mỗi cái có cây riêng. Cần đúng hai để hỏi được câu "chương của
     * chương trình B có gắn nhầm vào video của chương trình A không" — một chương trình thì mọi
     * mã đều hợp lệ và phép thử ràng buộc cây sẽ xanh mà chẳng chứng minh gì.
     */
    @BeforeAll
    void dungDuLieu() {
        quanTri = taoNguoiDung("ADMIN", "qt-video");
        giaoVien = taoNguoiDung("TEACHER", "gv-video");

        chuongTrinhA = taoChuongTrinh("KHO-VIDEO-A");
        chuongA = taoChuong(chuongTrinhA, "Chương của A");
        baiA = taoBai(chuongA, "Bài của A");

        chuongTrinhB = taoChuongTrinh("KHO-VIDEO-B");
        chuongB = taoChuong(chuongTrinhB, "Chương của B");
    }

    // ==================== 1. Hàng rào ghi ====================

    @Nested
    @DisplayName("Hàng rào ghi")
    class HangRao {

        @Test
        @DisplayName("thiếu tiêu đề thì bị từ chối bằng một câu đọc được")
        void thieuTieuDe() throws Exception {
            MvcResult ketQua = tao("""
                    {"videoUrl":"%s","programId":%d}""".formatted(LIEN_KET, chuongTrinhA));
            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
            assertThat(than(ketQua)).contains("tiêu đề");
        }

        /**
         * Đường quan trọng nhất của cả nhóm. Một video không có {@code video_url} lẫn
         * {@code storage_key} là một dòng dữ liệu trông đầy đủ nhưng rỗng ruột — nó chỉ tự khai ra
         * vào lúc học sinh bấm vào và không có gì chạy. Chặn ngay lúc ghi thì kho không bao giờ
         * chứa loại dòng ấy.
         */
        @Test
        @DisplayName("không có nguồn nào thì không phải là một video")
        void khongCoNguon() throws Exception {
            MvcResult ketQua = tao("""
                    {"title":"Video rỗng ruột","programId":%d}""".formatted(chuongTrinhA));
            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
            assertThat(than(ketQua)).contains("nguồn");
            assertThat(demVideo("Video rỗng ruột")).as("không có dòng nào lọt vào kho").isZero();
        }

        @Test
        @DisplayName("khoá tệp cũng là một nguồn hợp lệ, không bắt buộc phải có đường dẫn")
        void khoaTepCungLaNguon() throws Exception {
            MvcResult ketQua = tao("""
                    {"title":"Video tải lên","storageKey":"math10-files/videos/abc.mp4","programId":%d}
                    """.formatted(chuongTrinhA));
            assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(200);
        }

        @Test
        @DisplayName("chương trình không có thật thì báo không tìm thấy, không phải lỗi máy chủ")
        void chuongTrinhKhongCoThat() throws Exception {
            MvcResult ketQua = tao("""
                    {"title":"Video mồ côi","videoUrl":"%s","programId":999999}""".formatted(LIEN_KET));
            assertThat(ketQua.getResponse().getStatus()).isEqualTo(404);
        }

        /**
         * Cây nội dung phải khép kín: một video khai thuộc chương trình A nhưng gắn vào chương của
         * chương trình B sẽ biến mất khỏi mọi màn hình — màn hình của A lọc theo chương của A nên
         * không thấy nó, màn hình của B lọc theo chương trình B nên cũng không. Nó nằm trong CSDL
         * mà không ai tìm ra.
         */
        @Test
        @DisplayName("chương phải thuộc đúng chương trình đã khai")
        void chuongLacChuongTrinh() throws Exception {
            MvcResult ketQua = tao("""
                    {"title":"Video gắn lạc chương","videoUrl":"%s","programId":%d,"chapterId":%d}
                    """.formatted(LIEN_KET, chuongTrinhA, chuongB));
            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
            assertThat(than(ketQua)).contains("Chương");
        }

        @Test
        @DisplayName("bài phải nằm trong đúng chương đã khai")
        void baiLacChuong() throws Exception {
            MvcResult ketQua = tao("""
                    {"title":"Video gắn lạc bài","videoUrl":"%s","programId":%d,"chapterId":%d,"lessonId":%d}
                    """.formatted(LIEN_KET, chuongTrinhB, chuongB, baiA));
            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
            assertThat(than(ketQua)).contains("Bài");
        }

        /**
         * Cột {@code status} có {@code default 'DRAFT'} trong CSDL, nhưng câu lệnh chèn liệt kê nó
         * tường minh — mà mặc định của PostgreSQL chỉ áp khi cột được <em>bỏ khỏi</em> danh sách.
         * Nên trước lát này, không gửi trạng thái nghĩa là chèn NULL vào một cột NOT NULL: 500.
         */
        @Test
        @DisplayName("không gửi trạng thái thì mặc định là bản nháp")
        void macDinhBanNhap() throws Exception {
            long id = taoDuoc("""
                    {"title":"Video không khai trạng thái","videoUrl":"%s","programId":%d}
                    """.formatted(LIEN_KET, chuongTrinhA));
            assertThat(cot(id, "status")).isEqualTo("DRAFT");
        }

        @Test
        @DisplayName("thời lượng âm bị từ chối trước khi xuống tới cơ sở dữ liệu")
        void thoiLuongAm() throws Exception {
            MvcResult ketQua = tao("""
                    {"title":"Video thời lượng âm","videoUrl":"%s","programId":%d,"durationSeconds":-1}
                    """.formatted(LIEN_KET, chuongTrinhA));
            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
            assertThat(than(ketQua)).contains("Thời lượng");
        }

        /** Hàng rào phải đứng ở cả đường sửa, không chỉ đường tạo. */
        @Test
        @DisplayName("sửa cũng không gỡ được nguồn của một video đã có")
        void suaKhongGoDuocNguon() throws Exception {
            long id = taoDuoc("""
                    {"title":"Video sẽ bị gỡ nguồn","videoUrl":"%s","programId":%d}
                    """.formatted(LIEN_KET, chuongTrinhA));

            MvcResult ketQua = goi(quanTri, "ADMIN", HttpMethod.PUT, "/api/admin/videos/" + id, """
                    {"title":"Video sẽ bị gỡ nguồn","programId":%d}""".formatted(chuongTrinhA));

            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
            assertThat(cot(id, "video_url")).as("nguồn cũ còn nguyên").isEqualTo(LIEN_KET);
        }
    }

    // ==================== 2. Ảnh bìa ====================

    @Nested
    @DisplayName("Ảnh bìa")
    class AnhBia {

        @Test
        @DisplayName("suy ảnh bìa từ liên kết YouTube khi người dùng không nhập")
        void suyTuLienKet() throws Exception {
            long id = taoDuoc("""
                    {"title":"Video tự suy ảnh bìa","videoUrl":"%s","programId":%d}
                    """.formatted(LIEN_KET, chuongTrinhA));
            assertThat(cot(id, "thumbnail_url")).isEqualTo(ANH_BIA);
        }

        @Test
        @DisplayName("nhận cả dạng rút gọn youtu.be và dạng nhúng")
        void cacDangLienKet() throws Exception {
            for (String dang : List.of(
                    "https://youtu.be/dQw4w9WgXcQ",
                    "https://www.youtube.com/embed/dQw4w9WgXcQ",
                    "https://www.youtube.com/shorts/dQw4w9WgXcQ")) {
                long id = taoDuoc("""
                        {"title":"Video dạng %s","videoUrl":"%s","programId":%d}
                        """.formatted(dem.incrementAndGet(), dang, chuongTrinhA));
                assertThat(cot(id, "thumbnail_url")).as(dang).isEqualTo(ANH_BIA);
            }
        }

        @Test
        @DisplayName("người dùng đã tự nhập ảnh bìa thì không đè lên")
        void khongDeLenAnhNguoiDungChon() throws Exception {
            long id = taoDuoc("""
                    {"title":"Video có ảnh bìa riêng","videoUrl":"%s","thumbnailUrl":"https://anh.example.com/bia.png",
                     "programId":%d}""".formatted(LIEN_KET, chuongTrinhA));
            assertThat(cot(id, "thumbnail_url")).isEqualTo("https://anh.example.com/bia.png");
        }

        /**
         * Không suy được thì để trống, chứ không dán một ảnh giữ chỗ. Ảnh giữ chỗ trông y hệt ảnh
         * thật trên màn hình, nên nó biến "chưa có ảnh bìa" thành một thứ không ai đếm được — cùng
         * loại hỏng với nhãn "Tham khảo" mà máy tự dán ở lát nhóm nội dung.
         */
        @Test
        @DisplayName("không suy được thì để trống chứ không bịa ảnh giữ chỗ")
        void khongSuyDuocThiDeTrong() throws Exception {
            long id = taoDuoc("""
                    {"title":"Video ngoài YouTube","videoUrl":"https://video.example.com/bai-1.mp4","programId":%d}
                    """.formatted(chuongTrinhA));
            assertThat(cot(id, "thumbnail_url")).isNull();
        }
    }

    // ==================== 3. Nhật ký ====================

    @Nested
    @DisplayName("Nhật ký")
    class NhatKy {

        @Test
        @DisplayName("vòng đời video: tạo, sửa, xoá đều để lại dòng riêng")
        void vongDoi() throws Exception {
            long id = taoDuoc("""
                    {"title":"Video ghi nhật ký","videoUrl":"%s","programId":%d}
                    """.formatted(LIEN_KET, chuongTrinhA));
            Map<String, Object> tao = mot("CREATE", "VIDEO", id);
            assertThat(tao.get("actor_user_id")).isEqualTo(quanTri);
            assertThat((String) tao.get("new_data")).contains("Video ghi nhật ký");
            assertThat(tao.get("old_data")).isNull();

            goi(quanTri, "ADMIN", HttpMethod.PUT, "/api/admin/videos/" + id, """
                    {"title":"Video đã đổi tên","videoUrl":"%s","programId":%d,"status":"PUBLISHED"}
                    """.formatted(LIEN_KET, chuongTrinhA));
            Map<String, Object> sua = mot("UPDATE", "VIDEO", id);
            assertThat((String) sua.get("old_data")).contains("Video ghi nhật ký").contains("status=DRAFT");
            assertThat((String) sua.get("new_data")).contains("Video đã đổi tên").contains("status=PUBLISHED");

            goi(quanTri, "ADMIN", HttpMethod.DELETE, "/api/admin/videos/" + id, null);
            Map<String, Object> xoa = mot("DELETE", "VIDEO", id);
            assertThat((String) xoa.get("old_data")).as("xoá phải giữ lại hình dạng cũ")
                    .contains("Video đã đổi tên");
            assertThat(xoa.get("new_data")).isNull();
        }

        /**
         * Nhật ký nằm sau guard. Ghi trước khi kiểm quyền thì bảng nhật ký sẽ đầy những việc chưa
         * từng xảy ra — và người đọc nhật ký sẽ tin là chúng đã xảy ra.
         */
        @Test
        @DisplayName("giáo viên bị chặn thì không để lại dòng nào")
        void biChanThiKhongGhi() throws Exception {
            int truoc = tongDong();

            MvcResult ketQua = goi(giaoVien, "TEACHER", HttpMethod.POST, "/api/admin/videos", """
                    {"title":"Video giáo viên thử tạo","videoUrl":"%s","programId":%d}
                    """.formatted(LIEN_KET, chuongTrinhA));

            assertThat(ketQua.getResponse().getStatus()).isEqualTo(403);
            assertThat(demVideo("Video giáo viên thử tạo")).as("không có video nào được tạo").isZero();
            assertThat(tongDong()).as("bảng nhật ký không dài thêm").isEqualTo(truoc);
        }

        /** Lượt gọi hỏng ở hàng rào cũng chưa xảy ra, nên cũng không được ghi. */
        @Test
        @DisplayName("bị hàng rào chặn thì cũng không để lại dòng nào")
        void hongOHangRaoThiKhongGhi() throws Exception {
            int truoc = tongDong();

            MvcResult ketQua = tao("""
                    {"title":"Video hỏng ở hàng rào","programId":%d}""".formatted(chuongTrinhA));

            assertThat(ketQua.getResponse().getStatus()).isEqualTo(400);
            assertThat(tongDong()).as("bảng nhật ký không dài thêm").isEqualTo(truoc);
        }
    }

    // ==================== 4. Đường rò sang người học ====================

    @Nested
    @DisplayName("Đường rò sang người học")
    class DuongRo {

        /**
         * Hai đường đọc luồng nội dung phải trả lời giống nhau về cùng một video. Đường theo chương
         * trình đã lọc {@code v.status='PUBLISHED'} từ đầu; đường theo bài thì không nối bảng
         * {@code videos} nên không lọc được gì. Chênh lệch ấy chính là chỗ bản nháp lọt ra.
         */
        @Test
        @DisplayName("video bản nháp không lộ qua luồng nội dung của bài")
        void banNhapKhongLo() throws Exception {
            long video = taoDuoc("""
                    {"title":"Video còn là bản nháp","videoUrl":"%s","programId":%d,"status":"DRAFT"}
                    """.formatted(LIEN_KET, chuongTrinhA));
            ganVaoBai(baiA, "VIDEO", video, "Mục trỏ vào bản nháp", 91);

            assertThat(tieuDeLuong(baiA)).doesNotContain("Mục trỏ vào bản nháp");
        }

        @Test
        @DisplayName("video đã xuất bản thì hiện ra bình thường")
        void daXuatBanThiHien() throws Exception {
            long video = taoDuoc("""
                    {"title":"Video đã xuất bản","videoUrl":"%s","programId":%d,"status":"PUBLISHED"}
                    """.formatted(LIEN_KET, chuongTrinhA));
            ganVaoBai(baiA, "VIDEO", video, "Mục trỏ vào video đã xuất bản", 92);

            assertThat(tieuDeLuong(baiA)).contains("Mục trỏ vào video đã xuất bản");
        }

        /**
         * Lưu trữ video mà mục trong luồng vẫn còn thì học sinh thấy một dòng có tiêu đề và bấm vào
         * thì không có gì — tệ hơn cả việc không thấy gì, vì nó trông như lỗi của các em.
         */
        @Test
        @DisplayName("video đã lưu trữ thì mục trỏ vào nó cũng biến mất")
        void luuTruThiMucCungBienMat() throws Exception {
            long video = taoDuoc("""
                    {"title":"Video rồi sẽ lưu trữ","videoUrl":"%s","programId":%d,"status":"PUBLISHED"}
                    """.formatted(LIEN_KET, chuongTrinhA));
            ganVaoBai(baiA, "VIDEO", video, "Mục trỏ vào video sẽ lưu trữ", 93);
            assertThat(tieuDeLuong(baiA)).as("tiền đề: mục đang hiện").contains("Mục trỏ vào video sẽ lưu trữ");

            goi(quanTri, "ADMIN", HttpMethod.DELETE, "/api/admin/videos/" + video, null);

            assertThat(tieuDeLuong(baiA)).doesNotContain("Mục trỏ vào video sẽ lưu trữ");
        }

        /**
         * Chiều ngược lại của cùng một câu lệnh: bộ lọc mới chỉ được nói về video. Tài liệu và phiếu
         * bài tập không có cột trạng thái trong phép nối ấy, nên nếu viết nhầm thành lọc chung thì
         * chúng sẽ biến mất sạch khỏi mọi luồng nội dung.
         */
        @Test
        @DisplayName("mục không phải video vẫn hiện, không bị bộ lọc video quét nhầm")
        void mucKhongPhaiVideoVanHien() throws Exception {
            long taiLieu = taoTaiLieu();
            ganVaoBai(baiA, "DOCUMENT", taiLieu, "Mục tài liệu đọc thêm", 94);

            assertThat(tieuDeLuong(baiA)).contains("Mục tài liệu đọc thêm");
        }
    }

    // ==================== Hạ tầng ====================

    private MvcResult tao(String than) throws Exception {
        return goi(quanTri, "ADMIN", HttpMethod.POST, "/api/admin/videos", than);
    }

    /** Tạo và bắt buộc phải thành công; trả về mã của video vừa tạo. */
    private long taoDuoc(String than) throws Exception {
        MvcResult ketQua = tao(than);
        assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(200);
        return json.readTree(than(ketQua)).get("data").get("id").asLong();
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
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@video.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }

    /** Tiêu đề các mục mà luồng nội dung của một bài trả về cho người đã đăng nhập. */
    private String tieuDeLuong(long bai) throws Exception {
        MvcResult ketQua = goi(giaoVien, "TEACHER", HttpMethod.GET,
                "/api/lessons/%d/program-resources".formatted(bai), null);
        assertThat(ketQua.getResponse().getStatus()).as(than(ketQua)).isEqualTo(200);
        StringBuilder o = new StringBuilder();
        for (JsonNode hang : json.readTree(than(ketQua)).get("data")) o.append(hang.get("title").asText()).append('\n');
        return o.toString();
    }

    private String cot(long video, String ten) {
        return jdbc.queryForObject("select " + ten + " from videos where id=?", String.class, video);
    }

    private int demVideo(String tieuDe) {
        Integer n = jdbc.queryForObject("select count(*) from videos where title=?", Integer.class, tieuDe);
        return n == null ? 0 : n;
    }

    private List<Map<String, Object>> dong(String action, String targetType, long targetId) {
        return jdbc.queryForList("""
                select actor_user_id, old_data, new_data from audit_logs
                where action=? and target_type=? and target_id=? order by id
                """, action, targetType, targetId);
    }

    /** Đúng một dòng, không nhiều hơn: ghi hai lần cùng một việc cũng là nhật ký sai. */
    private Map<String, Object> mot(String action, String targetType, long targetId) {
        List<Map<String, Object>> rows = dong(action, targetType, targetId);
        assertThat(rows).as("%s %s #%d", action, targetType, targetId).hasSize(1);
        return rows.get(0);
    }

    private int tongDong() {
        Integer n = jdbc.queryForObject("select count(*) from audit_logs", Integer.class);
        return n == null ? 0 : n;
    }

    // ==================== Dựng dữ liệu ====================

    private long taoNguoiDung(String vai, String ten) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, ten + "@video.test", ten, ten, vai);
    }

    private long taoChuongTrinh(String ma) {
        return jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values (?, ?, 'PUBLISHED', now(), now())
                returning id
                """, Long.class, ma, ma);
    }

    private long taoChuong(long chuongTrinh, String ten) {
        return jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, ?, 1, 'PUBLISHED', now(), now())
                returning id
                """, Long.class, chuongTrinh, ten);
    }

    private long taoBai(long chuong, String ten) {
        return jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, ?, 1, 'PUBLISHED', now(), now())
                returning id
                """, Long.class, chuong, ten);
    }

    /** {@code file_url} để rỗng: cột NOT NULL, và không lượt gọi nào ở đây đi ra R2. */
    private long taoTaiLieu() {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, created_at, updated_at)
                values (?, 'KHBD', 'STUDENT_ALLOWED', '', 'PUBLISHED', now(), now())
                returning id
                """, Long.class, "Tài liệu cho luồng video " + dem.incrementAndGet());
    }

    /** Mục trong luồng nội dung của một bài. Trạng thái PUBLISHED để chính nó không phải thứ bị lọc. */
    private void ganVaoBai(long bai, String loai, long tham, String tieuDe, int thuTu) {
        jdbc.update("""
                insert into program_resources (lesson_id, resource_type, resource_ref_id, title, order_index,
                                               status, created_at, updated_at)
                values (?, ?, ?, ?, ?, 'PUBLISHED', now(), now())
                """, bai, loai, tham, tieuDe, thuTu);
    }
}
