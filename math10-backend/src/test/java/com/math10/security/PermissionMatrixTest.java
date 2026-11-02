package com.math10.security;

import com.math10.configuration.security.Math10Principal;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Ma trận quyền: mỗi endpoint nhạy cảm được gọi bằng cả bốn tư cách — khách, học sinh, giáo viên,
 * quản trị — và khẳng định ai bị chặn, ai đi qua.
 *
 * <p>Vì sao dựng cả ứng dụng thay vì {@code @WebMvcTest}: {@code @EnableMethodSecurity} nằm trên
 * {@code Math10BackendApplication}, còn chuỗi lọc thật nằm trong {@code SecurityConfig}. Lát cắt
 * web chỉ dựng lại một phiên bản gần đúng của hai thứ đó, nên nó có thể xanh trong khi bản chạy
 * thật đang hở. Ở đây dùng đúng chuỗi lọc và đúng lớp chặn phương thức của production.
 *
 * <p>Phạm vi là <em>cổng vai trò</em>, không phải quyền theo từng bản ghi. Quy ước khẳng định:
 * <ul>
 *   <li>bị chặn → đúng 403 (không phải 401 — xem {@link CachChanKhach});</li>
 *   <li>đi qua → mã trạng thái bất kỳ <em>trừ</em> 401/403. Phần lớn các ô này trả 200 với danh
 *       sách rỗng, hoặc 404/400 vì id trong bảng cố tình không tồn tại. Điều đó là đủ: câu hỏi
 *       duy nhất ở đây là "vai trò này có bị cổng chặn không".</li>
 * </ul>
 *
 * <p>Các endpoint theo lớp ({@code /api/classes/**}, {@code /api/assignments?classId=}) nằm riêng
 * ở {@link QuyenTheoLop} vì chúng còn một lớp kiểm chủ sở hữu phía sau cổng vai trò. Tách hai lớp
 * đó ra khỏi nhau cần dữ liệu thật (giáo viên A và giáo viên B) — đó là việc của ma trận IDOR.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class PermissionMatrixTest {

    @Autowired
    private MockMvc mockMvc;

    /** Tư cách người gọi. {@code ma} là role_code như JwtAuthenticationFilter đọc ra từ token. */
    enum Vai {
        KHACH(null), HOC_SINH("STUDENT"), GIAO_VIEN("TEACHER"), QUAN_TRI("ADMIN");

        private final String ma;

        Vai(String ma) {
            this.ma = ma;
        }

        String ma() {
            return ma;
        }
    }

    /** Một dòng của ma trận: gọi {@code phuongThuc duongDan}, những vai trong {@code choPhep} thì qua. */
    record O(HttpMethod phuongThuc, String duongDan, List<String> choPhep, boolean choKhach) {

        static O chiQuanTri(HttpMethod m, String p) {
            return new O(m, p, List.of("ADMIN"), false);
        }

        static O quanTriVaGiaoVien(HttpMethod m, String p) {
            return new O(m, p, List.of("ADMIN", "TEACHER"), false);
        }

        static O chiGiaoVien(HttpMethod m, String p) {
            return new O(m, p, List.of("TEACHER"), false);
        }

        static O chiHocSinh(HttpMethod m, String p) {
            return new O(m, p, List.of("STUDENT"), false);
        }

        static O daDangNhap(HttpMethod m, String p) {
            return new O(m, p, List.of("ADMIN", "TEACHER", "STUDENT"), false);
        }

        static O congKhai(HttpMethod m, String p) {
            return new O(m, p, List.of("ADMIN", "TEACHER", "STUDENT"), true);
        }
    }

    /**
     * Bảng chỉ chứa những endpoint mà cổng vai trò là thứ <em>duy nhất</em> chặn — không có kiểm
     * chủ sở hữu phía sau. Nhờ vậy khi gỡ một {@code @PreAuthorize} thì ô tương ứng đỏ lên thật,
     * chứ không được một lớp kiểm khác đỡ hộ rồi vẫn xanh.
     *
     * <p>Các id đều là 999999 để lượt gọi được phép dừng ở "không tìm thấy" thay vì sửa dữ liệu.
     */
    private static final List<O> BANG = List.of(
            // ----- Chỉ quản trị -----
            O.chiQuanTri(HttpMethod.GET, "/api/admin/dashboard"),
            O.chiQuanTri(HttpMethod.GET, "/api/audit-logs"),
            O.chiQuanTri(HttpMethod.GET, "/api/admin/class-overview"),
            O.chiQuanTri(HttpMethod.GET, "/api/admin/taxonomy/tree"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/admin/taxonomy/nodes/999999"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/courses/999999"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/chapters/999999"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/lessons/999999"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/admin/program-resources/999999"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/program-schedules/999999"),
            O.chiQuanTri(HttpMethod.POST, "/api/admin/programs/999999/publish"),
            O.chiQuanTri(HttpMethod.GET, "/api/admin/program-templates"),
            O.chiQuanTri(HttpMethod.GET, "/api/admin/course-instances"),
            O.chiQuanTri(HttpMethod.PUT, "/api/admin/course-instances/999999"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/admin/course-instances/999999"),
            O.chiQuanTri(HttpMethod.GET, "/api/admin/videos"),
            O.chiQuanTri(HttpMethod.POST, "/api/admin/videos"),
            O.chiQuanTri(HttpMethod.PUT, "/api/admin/videos/999999"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/admin/videos/999999"),
            O.chiQuanTri(HttpMethod.GET, "/api/admin/document-folders"),
            O.chiQuanTri(HttpMethod.POST, "/api/admin/document-folders"),
            O.chiQuanTri(HttpMethod.PATCH, "/api/admin/document-folders/999999/parent"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/admin/document-folders/999999"),
            O.chiQuanTri(HttpMethod.PATCH, "/api/admin/document-folders/documents"),
            // /api/admin/special-topics đã gỡ cùng bảng của nó; chuyên đề nay đi qua
            // /api/admin/taxonomy, đã có hai hàng ở trên canh.
            O.chiQuanTri(HttpMethod.GET, "/api/users"),
            O.chiQuanTri(HttpMethod.DELETE, "/api/users/999999"),

            // ----- Quản trị và giáo viên -----
            O.quanTriVaGiaoVien(HttpMethod.GET, "/api/users/students"),
            O.quanTriVaGiaoVien(HttpMethod.GET, "/api/teacher/dashboard"),
            O.quanTriVaGiaoVien(HttpMethod.GET, "/api/teacher/classes"),
            O.quanTriVaGiaoVien(HttpMethod.GET, "/api/teacher/class-results"),
            O.quanTriVaGiaoVien(HttpMethod.GET, "/api/worksheets"),
            O.quanTriVaGiaoVien(HttpMethod.GET, "/api/documents"),
            // Hai đường chấm bài dưới đây tra bài giao trước khi kiểm lớp, nên id không tồn tại
            // dừng ở 404 — đủ để thấy cổng vai trò đã cho đi qua.
            O.quanTriVaGiaoVien(HttpMethod.GET, "/api/teacher/submissions/assignments/999999/analysis"),
            O.quanTriVaGiaoVien(HttpMethod.POST, "/api/teacher/submissions/assignments/999999/regrade"),

            // ----- Chỉ giáo viên: quản trị cũng không vào được -----
            O.chiGiaoVien(HttpMethod.GET, "/api/teacher/documents"),
            O.chiGiaoVien(HttpMethod.GET, "/api/teacher/document-folders"),
            O.chiGiaoVien(HttpMethod.GET, "/api/teacher/resources"),

            // ----- Chỉ học sinh -----
            O.chiHocSinh(HttpMethod.GET, "/api/student/classes"),
            O.chiHocSinh(HttpMethod.GET, "/api/student/taxonomy"),
            O.chiHocSinh(HttpMethod.GET, "/api/student/courses"),
            O.chiHocSinh(HttpMethod.GET, "/api/student/assignments"),
            O.chiHocSinh(HttpMethod.GET, "/api/student/teacher-resources"),
            O.chiHocSinh(HttpMethod.PATCH, "/api/assignment-progress/999999/opened"),
            O.chiHocSinh(HttpMethod.PATCH, "/api/problem-progress/999999/opened"),

            // ----- Mọi vai đã đăng nhập, nhưng khách thì không -----
            O.daDangNhap(HttpMethod.GET, "/api/taxonomy/tree"),
            O.daDangNhap(HttpMethod.GET, "/api/documents/student"),
            O.daDangNhap(HttpMethod.GET, "/api/documents/student/exams"),
            O.daDangNhap(HttpMethod.GET, "/api/documents/textbooks"),
            O.daDangNhap(HttpMethod.GET, "/api/program-schedules/current?courseId=999999"),
            O.daDangNhap(HttpMethod.GET, "/api/programs"),
            O.daDangNhap(HttpMethod.GET, "/api/programs/999999/resources"),
            O.daDangNhap(HttpMethod.GET, "/api/lessons/999999/program-resources"),
            // Không có @PreAuthorize; chỉ dựa vào anyRequest().authenticated() của chuỗi lọc.
            O.daDangNhap(HttpMethod.POST, "/api/auth/change-password"),

            // ----- Khách vào được -----
            O.congKhai(HttpMethod.POST, "/api/auth/login"),
            O.congKhai(HttpMethod.GET, "/api/public/problems/khong-ton-tai"));

    static Stream<Arguments> maTran() {
        List<Arguments> o = new ArrayList<>();
        for (O dong : BANG) {
            for (Vai vai : Vai.values()) {
                boolean choPhep = vai == Vai.KHACH ? dong.choKhach() : dong.choPhep().contains(vai.ma());
                String nhan = "%s · %s %s → %s".formatted(
                        vai, dong.phuongThuc(), dong.duongDan(), choPhep ? "qua" : "chặn");
                o.add(Arguments.of(nhan, vai, dong, choPhep));
            }
        }
        return o.stream();
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("maTran")
    void oTrongMaTran(String nhan, Vai vai, O dong, boolean choPhep) throws Exception {
        int trangThai = goi(vai, dong);
        if (choPhep) {
            assertThat(trangThai).as(nhan).isNotIn(401, 403);
        } else {
            assertThat(trangThai).as(nhan).isEqualTo(403);
        }
    }

    @Nested
    @DisplayName("Quyền theo lớp")
    class QuyenTheoLop {

        /**
         * Ở nhóm này cổng vai trò không phải thứ duy nhất chặn: phía sau còn {@code ClassAccessGuard}
         * hỏi "người này có phụ trách/đang học lớp đó không". Giáo viên trong test không được gán
         * lớp nào nên vẫn bị chặn, và đó là hành vi đúng. Quản trị đi tắt qua cả hai lớp, nên ô
         * quản trị là bằng chứng duy nhất ở đây rằng đường dẫn có thật và chạy được.
         */
        @Test
        @DisplayName("quản trị đi tắt qua kiểm chủ sở hữu, ba vai còn lại đều bị chặn")
        void quanTriDiTat() throws Exception {
            for (String duongDan : List.of(
                    "/api/classes/999999/roster",
                    "/api/classes/999999/curriculum",
                    "/api/assignments?classId=999999",
                    "/api/teacher/submissions?classId=999999")) {
                O dong = new O(HttpMethod.GET, duongDan, List.of("ADMIN"), false);
                assertThat(goi(Vai.QUAN_TRI, dong)).as("quản trị · " + duongDan).isNotIn(401, 403);
                assertThat(goi(Vai.GIAO_VIEN, dong)).as("giáo viên không phụ trách · " + duongDan).isEqualTo(403);
                assertThat(goi(Vai.HOC_SINH, dong)).as("học sinh · " + duongDan).isEqualTo(403);
                assertThat(goi(Vai.KHACH, dong)).as("khách · " + duongDan).isEqualTo(403);
            }
        }
    }

    @Nested
    @DisplayName("Cách chặn khách")
    class CachChanKhach {

        /**
         * Chuỗi lọc không khai báo formLogin hay httpBasic, nên Spring Security dùng
         * {@code Http403ForbiddenEntryPoint}: khách chưa đăng nhập nhận 403 chứ không phải 401.
         * Ghim lại ở đây vì phía client không phân biệt được "chưa đăng nhập" với "sai vai trò".
         */
        @Test
        @DisplayName("khách chưa đăng nhập nhận 403, không phải 401")
        void khachNhan403() throws Exception {
            assertThat(goi(Vai.KHACH, O.chiQuanTri(HttpMethod.GET, "/api/admin/dashboard"))).isEqualTo(403);
        }

        @Test
        @DisplayName("token rác bị chặn ngay ở chuỗi lọc bằng 401")
        void tokenRacNhan401() throws Exception {
            int trangThai = mockMvc.perform(request(HttpMethod.GET, "/api/admin/dashboard")
                            .header("Authorization", "Bearer khong-phai-mot-token"))
                    .andReturn().getResponse().getStatus();
            assertThat(trangThai).isEqualTo(401);
        }
    }

    private int goi(Vai vai, O dong) throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(dong.phuongThuc(), dong.duongDan());
        if (dong.phuongThuc() != HttpMethod.GET) {
            // Thân rỗng là đủ: nếu thân sai thì lỗi validation trả 400, mà 400 vẫn nghĩa là
            // "đã qua cổng vai trò" — đúng thứ ô này cần biết.
            yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content("{}");
        }
        if (vai != Vai.KHACH) {
            yeuCau = yeuCau.with(authentication(danhTinh(vai)));
        }
        return mockMvc.perform(yeuCau).andReturn().getResponse().getStatus();
    }

    /** Dựng đúng loại Authentication mà JwtAuthenticationFilter đặt vào context khi chạy thật. */
    private Authentication danhTinh(Vai vai) {
        Math10Principal principal = new Math10Principal(
                switch (vai) {
                    case HOC_SINH -> 9001L;
                    case GIAO_VIEN -> 9002L;
                    case QUAN_TRI -> 9003L;
                    case KHACH -> throw new IllegalArgumentException("khách không có danh tính");
                },
                vai.ma().toLowerCase() + "@math10.test",
                vai.ma());
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai.ma())));
    }
}
