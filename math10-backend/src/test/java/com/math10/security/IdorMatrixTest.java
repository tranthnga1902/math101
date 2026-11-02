package com.math10.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
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
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Ma trận IDOR: quyền theo <em>từng bản ghi</em>, thứ mà {@link PermissionMatrixTest} cố tình
 * không đụng tới.
 *
 * <p>Ma trận vai trò chỉ trả lời được "vai này có được gọi đường dẫn này không". Nó không trả lời
 * được câu hỏi đắt hơn: <em>giáo viên B, một tài khoản hoàn toàn hợp lệ, có đọc được lớp của giáo
 * viên A khi đoán ra id không</em>. Muốn tách hai lớp chặn đó ra thì phải có dữ liệu thật — nên
 * lớp này dựng hẳn hai lớp học song song với hai giáo viên và hai học sinh riêng, rồi cho mọi
 * người gọi chéo sang phần của người kia.
 *
 * <p>Bố cục dữ liệu, cố ý đối xứng để mỗi phép thử có cả chiều cho phép lẫn chiều chặn:
 * <pre>
 *   lớp A ── giáo viên A ── học sinh A ── bài giao A ── phiếu A ── tài liệu riêng A
 *   lớp B ── giáo viên B ── học sinh B ── bài giao B ── phiếu B ── tài liệu riêng B
 *   quản trị: không thuộc lớp nào, nhưng đi tắt qua mọi kiểm chủ sở hữu
 * </pre>
 *
 * <p>Quy ước khẳng định giống ma trận vai trò: bị chặn → đúng <b>403</b>; đi qua → mã bất kỳ
 * <em>trừ</em> 401/403. Riêng nhóm tài liệu chốt chặt hơn (403 với 400) vì ở đó khẳng định được
 * chính xác lượt gọi dừng ở đâu — xem {@link DocTaiLieu}.
 *
 * <p>Các phép thử ghi (xóa bài giao, gỡ học sinh, trả điểm…) chỉ chạy <b>chiều chặn</b>, và mỗi
 * lượt còn soi lại bản ghi trong CSDL để chắc rằng lượt gọi bị chặn không kịp sửa gì. Chiều cho
 * phép của chúng không chạy ở đây: một lượt xóa thành công sẽ phá dữ liệu nền của các phép thử
 * còn lại, mà bằng chứng "chủ sở hữu vào được" thì các đường đọc tương ứng đã cấp rồi.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IdorMatrixTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper json = new ObjectMapper();

    private long gvA, gvB, hsA, hsB, quanTri;
    private long lopA, lopB;
    private long baiA, baiB;
    private long phieuA, phieuB;
    private long nopA;
    private long ghiDanhA;
    private long tlRiengA, tlRiengB, tlChung, tlChungAn, tlGanLopA, tlLuuTruA;

    /** Lớp học. Mọi thứ trong bộ dữ liệu đều thuộc về đúng một trong hai lớp này. */
    enum Lop { A, B }

    /** Người gọi. {@code lop} là lớp người đó thuộc về; quản trị không thuộc lớp nào. */
    enum Nguoi {
        GV_A("TEACHER", Lop.A), GV_B("TEACHER", Lop.B),
        HS_A("STUDENT", Lop.A), HS_B("STUDENT", Lop.B),
        QUAN_TRI("ADMIN", null);

        private final String vai;
        private final Lop lop;

        Nguoi(String vai, Lop lop) { this.vai = vai; this.lop = lop; }

        String vai() { return vai; }

        Lop lop() { return lop; }
    }

    /**
     * Một dòng ma trận theo lớp. {@code mau} có đúng một chỗ {@code %d} để cắm id lớp.
     *
     * <p>{@code vaiHieuLuc} là những vai <em>thực sự</em> đi qua được khi gọi vào lớp của chính
     * mình. Nó không phải bản sao của {@code @PreAuthorize}: {@code /progress} chẳng hạn khai báo
     * cả ba vai ở cổng, nhưng phía sau {@code requireTeacher} loại học sinh ra, nên ở đây chỉ ghi
     * hai vai. Ghi theo hành vi hợp lệ chứ không theo chú thích thì test mới bắt được lỗi.
     */
    record OLop(HttpMethod phuongThuc, String mau, Set<String> vaiHieuLuc) {

        static OLop giaoVien(String mau) { return new OLop(HttpMethod.GET, mau, Set.of("ADMIN", "TEACHER")); }

        static OLop thanhVien(String mau) { return new OLop(HttpMethod.GET, mau, Set.of("ADMIN", "TEACHER", "STUDENT")); }

        static OLop hocSinh(String mau) { return new OLop(HttpMethod.GET, mau, Set.of("STUDENT")); }
    }

    private static final List<OLop> BANG_LOP = List.of(
            // Chỉ giáo viên phụ trách: ClassAccessGuard.requireTeacher
            OLop.giaoVien("/api/classes/%d/roster"),
            OLop.giaoVien("/api/classes/%d/roster/candidates"),
            OLop.giaoVien("/api/classes/%d/document-library"),
            OLop.giaoVien("/api/classes/%d/progress"),
            OLop.giaoVien("/api/classes/%d/submission-log"),
            // Thành viên lớp, kể cả học sinh: ClassAccessGuard.requireMember
            OLop.thanhVien("/api/classes/%d/curriculum"),
            OLop.thanhVien("/api/classes/%d/documents"),
            // Bản kiểm lớp riêng của AssignmentController, không dùng chung guard
            OLop.thanhVien("/api/assignments?classId=%d"),
            // Bản kiểm lớp riêng của TeacherSubmissionController và TeacherWorkspaceController
            OLop.giaoVien("/api/teacher/submissions?classId=%d"),
            OLop.giaoVien("/api/teacher/gradebook?classId=%d"),
            // Đường của học sinh: quản trị cũng không vào được vì cổng vai trò chỉ mở cho STUDENT
            OLop.hocSinh("/api/student/classes/%d/tasks"),
            OLop.hocSinh("/api/student/classes/%d/submission-log"));

    /**
     * Một dòng ma trận theo bản ghi: {@code mau} cắm id của chính bản ghi, và chủ của bản ghi
     * suy ra từ lớp mà nó thuộc về.
     */
    record OBanGhi(String mau, Set<String> vaiHieuLuc) {}

    private static final List<OBanGhi> BANG_BAN_GHI = List.of(
            // WorksheetController.owned: phiếu của ai người đó xem
            new OBanGhi("/api/worksheets/%d", Set.of("ADMIN", "TEACHER")),
            // TeacherSubmissionController.checkClass qua bài giao
            new OBanGhi("/api/teacher/submissions/assignments/%d/analysis", Set.of("ADMIN", "TEACHER")),
            // AssignmentProgressController.get: bài giao phải thuộc lớp của chính em đó
            new OBanGhi("/api/assignment-progress/%d/result", Set.of("STUDENT")));

    @BeforeAll
    void dungDuLieu() {
        gvA = taoNguoiDung("TEACHER", "gv-a");
        gvB = taoNguoiDung("TEACHER", "gv-b");
        hsA = taoNguoiDung("STUDENT", "hs-a");
        hsB = taoNguoiDung("STUDENT", "hs-b");
        quanTri = taoNguoiDung("ADMIN", "quan-tri");

        lopA = taoLop("IDOR-A");
        lopB = taoLop("IDOR-B");
        phanCongGiaoVien(lopA, gvA);
        phanCongGiaoVien(lopB, gvB);
        ghiDanhA = ghiDanhHocSinh(lopA, hsA);
        ghiDanhHocSinh(lopB, hsB);

        phieuA = taoPhieu("Phiếu của giáo viên A", gvA);
        phieuB = taoPhieu("Phiếu của giáo viên B", gvB);
        baiA = taoBaiGiao(lopA, gvA, phieuA);
        baiB = taoBaiGiao(lopB, gvB, phieuB);

        // Đã chấm nhưng chưa trả, và giờ công bố hẹn ở tương lai xa: đây là trạng thái duy nhất
        // mà điểm tồn tại trong CSDL nhưng học sinh chưa được phép thấy.
        nopA = taoBaiNop(baiA, hsA);
        jdbc.update("update assignments set publish_score_at = now() + interval '30 days' where id = ?", baiA);

        tlRiengA = taoTaiLieu("Tài liệu riêng của A", "DE_THI", "TEACHER_ONLY", "DRAFT", gvA);
        tlRiengB = taoTaiLieu("Tài liệu riêng của B", "DE_THI", "TEACHER_ONLY", "DRAFT", gvB);
        tlLuuTruA = taoTaiLieu("Tài liệu A để thử lưu trữ", "DE_THI", "TEACHER_ONLY", "DRAFT", gvA);
        tlChung = taoTaiLieu("Tài liệu kho chung", "KHBD", "STUDENT_ALLOWED", "PUBLISHED", null);
        tlChungAn = taoTaiLieu("Tài liệu kho chung đã ẩn", "KHBD", "STUDENT_ALLOWED", "HIDDEN", null);
        // Riêng của A, không mở cho học sinh, nhưng được gắn vào lớp A: quyền đến từ việc gắn lớp.
        tlGanLopA = taoTaiLieu("Tài liệu riêng của A gắn vào lớp A", "DE_THI", "TEACHER_ONLY", "DRAFT", gvA);
        ganTaiLieuVaoLop(lopA, tlGanLopA);
    }

    // ==================== Ma trận theo lớp ====================

    static Stream<Arguments> maTranTheoLop() {
        List<Arguments> o = new ArrayList<>();
        for (OLop dong : BANG_LOP) {
            for (Nguoi nguoi : Nguoi.values()) {
                for (Lop lop : Lop.values()) {
                    boolean qua = dong.vaiHieuLuc().contains(nguoi.vai())
                            && (nguoi == Nguoi.QUAN_TRI || nguoi.lop() == lop);
                    String nhan = "%s · %s (lớp %s) → %s".formatted(
                            nguoi, dong.mau().replace("%d", "{lớp}"), lop, qua ? "qua" : "chặn");
                    o.add(Arguments.of(nhan, nguoi, dong, lop, qua));
                }
            }
        }
        return o.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("maTranTheoLop")
    @DisplayName("Lớp của người khác")
    void oTheoLop(String nhan, Nguoi nguoi, OLop dong, Lop lop, boolean qua) throws Exception {
        int trangThai = goi(nguoi, dong.phuongThuc(), dong.mau().formatted(idLop(lop)));
        khangDinh(nhan, trangThai, qua);
    }

    // ==================== Ma trận theo bản ghi ====================

    static Stream<Arguments> maTranTheoBanGhi() {
        List<Arguments> o = new ArrayList<>();
        for (OBanGhi dong : BANG_BAN_GHI) {
            for (Nguoi nguoi : Nguoi.values()) {
                for (Lop lop : Lop.values()) {
                    boolean qua = dong.vaiHieuLuc().contains(nguoi.vai())
                            && (nguoi == Nguoi.QUAN_TRI || nguoi.lop() == lop);
                    String nhan = "%s · %s (của %s) → %s".formatted(
                            nguoi, dong.mau().replace("%d", "{id}"), lop, qua ? "qua" : "chặn");
                    o.add(Arguments.of(nhan, nguoi, dong, lop, qua));
                }
            }
        }
        return o.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("maTranTheoBanGhi")
    @DisplayName("Bản ghi của người khác")
    void oTheoBanGhi(String nhan, Nguoi nguoi, OBanGhi dong, Lop lop, boolean qua) throws Exception {
        long id = dong.mau().startsWith("/api/worksheets") ? idPhieu(lop) : idBaiGiao(lop);
        khangDinh(nhan, goi(nguoi, HttpMethod.GET, dong.mau().formatted(id)), qua);
    }

    @Nested
    @DisplayName("Sửa bản ghi của người khác")
    class SuaCuaNguoiKhac {

        /**
         * Năm đường ghi nguy hiểm nhất, mỗi đường gọi bằng tài khoản hợp lệ nhưng không phải chủ.
         * Ngoài mã 403, mỗi phép thử còn soi lại đúng cột mà lượt gọi định đổi — vì một guard đặt
         * nhầm chỗ (sau khi đã sửa xong rồi mới ném) vẫn trả 403 mà dữ liệu thì đã hỏng.
         */
        @Test
        @DisplayName("giáo viên B không xóa được bài giao của lớp A")
        void khongXoaDuocBaiGiao() throws Exception {
            assertThat(goi(Nguoi.GV_B, HttpMethod.DELETE, "/api/assignments/" + baiA)).isEqualTo(403);
            assertThat(conSong("assignments", baiA)).as("bài giao A vẫn còn").isTrue();
        }

        @Test
        @DisplayName("giáo viên B không xóa được phiếu bài tập của giáo viên A")
        void khongXoaDuocPhieu() throws Exception {
            assertThat(goi(Nguoi.GV_B, HttpMethod.DELETE, "/api/worksheets/" + phieuA)).isEqualTo(403);
            assertThat(conSong("worksheets", phieuA)).as("phiếu của A vẫn còn").isTrue();
        }

        @Test
        @DisplayName("giáo viên B không gỡ được học sinh khỏi lớp A")
        void khongGoDuocHocSinh() throws Exception {
            assertThat(goi(Nguoi.GV_B, HttpMethod.DELETE,
                    "/api/classes/%d/roster/students/%d".formatted(lopA, ghiDanhA))).isEqualTo(403);
            assertThat(conSong("class_students", ghiDanhA)).as("học sinh A vẫn trong lớp").isTrue();
        }

        @Test
        @DisplayName("giáo viên B không trả điểm được cho bài nộp của lớp A")
        void khongTraDuocDiem() throws Exception {
            assertThat(goi(Nguoi.GV_B, HttpMethod.PATCH,
                    "/api/teacher/submissions/%d/return".formatted(nopA))).isEqualTo(403);
            Integer daTra = jdbc.queryForObject(
                    "select count(*) from assignment_progress where id = ? and returned_at is not null",
                    Integer.class, nopA);
            assertThat(daTra).as("bài nộp chưa bị trả điểm").isZero();
        }

        @Test
        @DisplayName("giáo viên B không lưu trữ được tài liệu riêng của giáo viên A")
        void khongLuuTruDuocTaiLieu() throws Exception {
            assertThat(goi(Nguoi.GV_B, HttpMethod.PATCH,
                    "/api/teacher/documents/%d/archive".formatted(tlLuuTruA))).isEqualTo(403);
            String trangThai = jdbc.queryForObject(
                    "select status from documents where id = ?", String.class, tlLuuTruA);
            assertThat(trangThai).as("tài liệu của A giữ nguyên trạng thái").isEqualTo("DRAFT");
        }

        @Test
        @DisplayName("giáo viên A không thêm được mục chương trình vào lớp B")
        void khongThemDuocChuongTrinh() throws Exception {
            // Thân hợp lệ để qua tầng kiểm dữ liệu; guard nằm ngay dòng đầu thân hàm nên chặn
            // trước cả khi tra mục chuyên đề, vì vậy id 1 không cần có thật.
            int trangThai = mockMvc.perform(request(HttpMethod.POST, "/api/classes/%d/curriculum".formatted(lopB))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("{\"taxonomyNodeId\":1}")
                            .with(authentication(danhTinh(Nguoi.GV_A))))
                    .andReturn().getResponse().getStatus();
            assertThat(trangThai).isEqualTo(403);
            Integer them = jdbc.queryForObject(
                    "select count(*) from class_curriculum where class_id = ?", Integer.class, lopB);
            assertThat(them).as("chương trình lớp B không đổi").isZero();
        }
    }

    @Nested
    @DisplayName("Đọc file tài liệu")
    class DocTaiLieu {

        /**
         * {@code GET /api/documents/{id}/content} là cửa duy nhất tới file trên R2 sau khi bucket
         * chuyển private, nên đây là chỗ mà một lỗ IDOR có hậu quả nặng nhất: đoán id là tải được
         * đề và đáp án của trường khác.
         *
         * <p>Mọi tài liệu nền đều có {@code file_url} rỗng, nên lượt gọi đi qua được guard sẽ dừng
         * ở "tài liệu này không có file để xem" — <b>400</b>. Nhờ vậy khẳng định chốt được chính
         * xác lượt gọi dừng ở đâu (403 = chặn ở quyền, 400 = đã qua quyền), thay vì chỉ nói "không
         * phải 403" rồi bỏ qua một lỗi 500 tình cờ.
         */
        @Test
        @DisplayName("tài liệu riêng: chỉ chủ sở hữu và quản trị mở được")
        void taiLieuRieng() throws Exception {
            doc(tlRiengA, Set.of(Nguoi.GV_A, Nguoi.QUAN_TRI), "tài liệu riêng của A");
            doc(tlRiengB, Set.of(Nguoi.GV_B, Nguoi.QUAN_TRI), "tài liệu riêng của B");
        }

        @Test
        @DisplayName("tài liệu kho chung đã xuất bản: ai cũng mở được")
        void taiLieuKhoChung() throws Exception {
            doc(tlChung, Set.of(Nguoi.values()), "tài liệu kho chung");
        }

        @Test
        @DisplayName("tài liệu kho chung đã ẩn: chỉ quản trị mở được")
        void taiLieuKhoChungDaAn() throws Exception {
            doc(tlChungAn, Set.of(Nguoi.QUAN_TRI), "tài liệu kho chung đã ẩn");
        }

        /**
         * Cột sống của quyền tài liệu ở phía học sinh: quyền không đến từ thuộc tính của tài liệu
         * mà từ việc giáo viên chủ động gắn nó vào lớp. Học sinh lớp A đọc được, học sinh lớp B thì
         * không — dù hai em có vai giống hệt nhau và tài liệu thì giống hệt nhau.
         */
        @Test
        @DisplayName("tài liệu riêng gắn vào lớp: chỉ học sinh của chính lớp đó mở được")
        void taiLieuGanVaoLop() throws Exception {
            doc(tlGanLopA, Set.of(Nguoi.GV_A, Nguoi.QUAN_TRI, Nguoi.HS_A), "tài liệu gắn vào lớp A");
        }

        private void doc(long taiLieu, Set<Nguoi> aiDocDuoc, String ten) throws Exception {
            for (Nguoi nguoi : Nguoi.values()) {
                int trangThai = goi(nguoi, HttpMethod.GET, "/api/documents/%d/content".formatted(taiLieu));
                assertThat(trangThai)
                        .as("%s · %s", nguoi, ten)
                        .isEqualTo(aiDocDuoc.contains(nguoi) ? 400 : 403);
            }
        }
    }

    @Nested
    @DisplayName("Điểm chưa công bố")
    class DiemChuaCongBo {

        /**
         * Không phải IDOR theo nghĩa hẹp, nhưng cùng một câu hỏi: bản ghi có thật, người gọi có
         * quyền chạm vào nó, vậy API trả ra bao nhiêu phần của nó. Bài của học sinh A đã chấm 8.5
         * nhưng giáo viên chưa bấm trả và giờ công bố còn ở tương lai — chính em đó gọi thì thân
         * phản hồi phải rỗng chỗ điểm.
         */
        @Test
        @DisplayName("học sinh không thấy điểm và nhận xét của bài đã chấm nhưng chưa trả")
        void chuaTraThiChuaThayDiem() throws Exception {
            JsonNode data = than(Nguoi.HS_A, "/api/assignment-progress/%d/result".formatted(baiA)).get("data");
            assertThat(data.get("gradingStatus").asText()).isEqualTo("GRADED");
            assertThat(data.get("score").isNull()).as("điểm chưa lộ").isTrue();
            assertThat(data.get("teacherFeedback").isNull()).as("nhận xét chưa lộ").isTrue();
        }

        @Test
        @DisplayName("giáo viên phụ trách vẫn thấy điểm trong danh sách bài nộp")
        void giaoVienVanThayDiem() throws Exception {
            JsonNode data = than(Nguoi.GV_A, "/api/teacher/submissions?classId=" + lopA).get("data");
            assertThat(data).hasSize(1);
            assertThat(data.get(0).get("score").decimalValue()).isEqualByComparingTo("8.50");
        }
    }

    // ==================== Hạ tầng ====================

    private void khangDinh(String nhan, int trangThai, boolean qua) {
        if (qua) {
            assertThat(trangThai).as(nhan).isNotIn(401, 403);
        } else {
            assertThat(trangThai).as(nhan).isEqualTo(403);
        }
    }

    private int goi(Nguoi nguoi, HttpMethod phuongThuc, String duongDan) throws Exception {
        return thucHien(nguoi, phuongThuc, duongDan).getResponse().getStatus();
    }

    private JsonNode than(Nguoi nguoi, String duongDan) throws Exception {
        MvcResult ketQua = thucHien(nguoi, HttpMethod.GET, duongDan);
        assertThat(ketQua.getResponse().getStatus()).as(duongDan).isEqualTo(200);
        return json.readTree(ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8));
    }

    private MvcResult thucHien(Nguoi nguoi, HttpMethod phuongThuc, String duongDan) throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(phuongThuc, duongDan)
                .with(authentication(danhTinh(nguoi)));
        if (phuongThuc != HttpMethod.GET && phuongThuc != HttpMethod.DELETE) {
            yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content("{}");
        }
        return mockMvc.perform(yeuCau).andReturn();
    }

    /** Đúng loại Authentication mà JwtAuthenticationFilter đặt vào context khi chạy thật. */
    private Authentication danhTinh(Nguoi nguoi) {
        Math10Principal principal = new Math10Principal(idNguoi(nguoi), nguoi.name().toLowerCase() + "@idor.test", nguoi.vai());
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + nguoi.vai())));
    }

    private long idNguoi(Nguoi nguoi) {
        return switch (nguoi) {
            case GV_A -> gvA;
            case GV_B -> gvB;
            case HS_A -> hsA;
            case HS_B -> hsB;
            case QUAN_TRI -> quanTri;
        };
    }

    private long idLop(Lop lop) { return lop == Lop.A ? lopA : lopB; }

    private long idBaiGiao(Lop lop) { return lop == Lop.A ? baiA : baiB; }

    private long idPhieu(Lop lop) { return lop == Lop.A ? phieuA : phieuB; }

    private boolean conSong(String bang, long id) {
        Integer n = jdbc.queryForObject(
                "select count(*) from " + bang + " where id = ? and deleted_at is null", Integer.class, id);
        return n != null && n == 1;
    }

    // ==================== Dựng dữ liệu ====================

    private long taoNguoiDung(String vai, String ten) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, ten + "@idor.test", ten, ten, vai);
    }

    private long taoLop(String ma) {
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        return jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, ma, ma, khoi);
    }

    private void phanCongGiaoVien(long lop, long giaoVien) {
        jdbc.update("insert into class_teachers (class_id, teacher_id, created_at, updated_at) values (?, ?, now(), now())",
                lop, giaoVien);
    }

    private long ghiDanhHocSinh(long lop, long hocSinh) {
        return jdbc.queryForObject("""
                insert into class_students (class_id, student_id, created_at, updated_at)
                values (?, ?, now(), now())
                returning id
                """, Long.class, lop, hocSinh);
    }

    private long taoPhieu(String ten, long nguoiTao) {
        return jdbc.queryForObject("""
                insert into worksheets (name, columns_count, show_qr, show_student_fields, created_by, created_at, updated_at)
                values (?, 1, true, true, ?, now(), now())
                returning id
                """, Long.class, ten, nguoiTao);
    }

    private long taoBaiGiao(long lop, long nguoiTao, long phieu) {
        return jdbc.queryForObject("""
                insert into assignments (class_id, title, status, requirement, worksheet_id, created_by,
                                         max_attempts, late_policy, late_penalty_percent, created_at, updated_at)
                values (?, 'Bài giao thử quyền', 'PUBLISHED', 'BAT_BUOC', ?, ?, 1, 'REJECT', 0, now(), now())
                returning id
                """, Long.class, lop, phieu, nguoiTao);
    }

    private long taoBaiNop(long baiGiao, long hocSinh) {
        return jdbc.queryForObject("""
                insert into assignment_progress (assignment_id, student_id, completion_percent, submitted_at, graded_at,
                                                 raw_score, score, max_score, grading_status, attempt_no, submitted_late,
                                                 teacher_feedback, created_at, updated_at)
                values (?, ?, 100, now(), now(), 8.5, 8.5, 10, 'GRADED', 1, false, 'Làm tốt', now(), now())
                returning id
                """, Long.class, baiGiao, hocSinh);
    }

    /**
     * {@code file_url} để rỗng có chủ đích: xem {@link DocTaiLieu}. Cột này NOT NULL nên chuỗi rỗng
     * là cách duy nhất để lượt gọi hợp lệ dừng lại ở một mã xác định thay vì đi ra R2.
     */
    private long taoTaiLieu(String ten, String loai, String doiTuong, String trangThai, Long chuSoHuu) {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, base_page_offset, owner_id,
                                       created_at, updated_at)
                values (?, ?, ?, '', ?, 1, ?, now(), now())
                returning id
                """, Long.class, ten, loai, doiTuong, trangThai, chuSoHuu);
    }

    private void ganTaiLieuVaoLop(long lop, long taiLieu) {
        jdbc.update("""
                insert into class_documents (class_id, document_id, requirement, created_at, updated_at)
                values (?, ?, 'TU_CHON', now(), now())
                """, lop, taiLieu);
    }
}
