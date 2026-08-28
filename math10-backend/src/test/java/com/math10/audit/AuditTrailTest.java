package com.math10.audit;

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
 * Nhật ký hoạt động, sau khi mở rộng khỏi 5 loại đối tượng ban đầu.
 *
 * <p>Trước lát này nhật ký chỉ ghi tài khoản, khoá học, chuyên đề, lớp và câu hỏi. Những việc
 * đắt nhất của một trường thì không để lại dấu vết nào: giao và xoá bài, chấm điểm, <b>chấm lại
 * cả lớp bằng một nút bấm</b>, thêm/gỡ học sinh, và gắn/gỡ tài liệu vào lớp — mà gắn tài liệu
 * vào lớp <em>chính là</em> cơ chế cấp quyền đọc cho học sinh.
 *
 * <p>Lớp này gọi thẳng các endpoint thật rồi soi bảng {@code audit_logs}, nên nó chứng minh cả
 * đường dây: guard → nghiệp vụ → ghi nhật ký. Ba nhóm khẳng định, mỗi nhóm trả lời một câu:
 * <ol>
 *   <li><b>Ghi đủ</b> — mỗi thao tác nhạy cảm để lại đúng một dòng, đúng người, đúng đối tượng.</li>
 *   <li><b>Không lộ</b> — mật khẩu khởi tạo và bài làm của học sinh không được sao chép vào bảng
 *       nhật ký, chỗ mà mọi quản trị viên đều đọc được.</li>
 *   <li><b>Lọc thật</b> — bộ lọc chạy dưới CSDL. Đây là khiếm khuyết mà chính việc mở rộng gây
 *       ra: màn hình cũ tải 50 dòng mới nhất rồi lọc trong trình duyệt, nên khi nhật ký dày lên,
 *       nó báo "không có kết quả" cho những việc thật sự đã xảy ra.</li>
 * </ol>
 *
 * <p>Hai quy ước của dự án mà lớp này dựa vào. <b>Một</b>: mọi lượt gọi thành công đều trả HTTP
 * <b>200</b> — con số 201/204 nằm trong trường {@code code} của thân phản hồi, không phải ở tầng
 * HTTP, vì không có {@code ResponseBodyAdvice} nào đổi mã. <b>Hai</b>: mỗi phép thử ghi vào lớp
 * đều dựng lớp riêng cho mình, để khẳng định "đúng một dòng" nói về chính việc nó vừa làm chứ
 * không phụ thuộc thứ tự chạy giữa các phép thử.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AuditTrailTest {

    private static final String MAT_KHAU = "MatKhauKhoiTao2026";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper json = new ObjectMapper();
    /** Mã lớp và tên đăng nhập đều có ràng buộc duy nhất, nên mỗi lần dựng phải có số riêng. */
    private final AtomicInteger dem = new AtomicInteger();

    private long giaoVien, giaoVienKhac, hocSinh, quanTri;
    private long lop;
    private long phieu, cauHoi;
    private String baiLam;

    @BeforeAll
    void dungDuLieu() {
        giaoVien = taoNguoiDung("TEACHER", "gv-audit");
        giaoVienKhac = taoNguoiDung("TEACHER", "gv-audit-khac");
        hocSinh = taoNguoiDung("STUDENT", "hs-audit");
        quanTri = taoNguoiDung("ADMIN", "qt-audit");

        lop = taoLopCuaGiaoVien();
        phieu = taoPhieu();
        cauHoi = taoCauHoi();
        jdbc.update("""
                insert into worksheet_items (worksheet_id, problem_id, order_index, created_at, updated_at)
                values (?, ?, 1, now(), now())
                """, phieu, cauHoi);
        // Đáp án đúng là 'A', bài làm chọn 'C': chấm lại phải làm điểm đổi thật thì con số
        // scoreChanged trong nhật ký mới có gì để chứng minh.
        baiLam = "{\"%d\":\"C\"}".formatted(cauHoi);
    }

    // ==================== 1. Ghi đủ dấu vết ====================

    @Nested
    @DisplayName("Ghi đủ dấu vết")
    class GhiDu {

        @Test
        @DisplayName("vòng đời bài giao: tạo, sửa, xoá đều để lại dòng riêng")
        void vongDoiBaiGiao() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài giao ghi nhật ký");
            Map<String, Object> tao = mot("CREATE", "ASSIGNMENT", bai);
            assertThat(tao.get("actor_user_id")).isEqualTo(giaoVien);
            assertThat((String) tao.get("new_data")).contains("Bài giao ghi nhật ký");

            goi(giaoVien, "TEACHER", HttpMethod.PUT, "/api/assignments/" + bai, thanBaiGiao("Tên đã đổi"));
            Map<String, Object> sua = mot("UPDATE", "ASSIGNMENT", bai);
            assertThat((String) sua.get("old_data")).contains("Bài giao ghi nhật ký");
            assertThat((String) sua.get("new_data")).contains("Tên đã đổi");

            goi(giaoVien, "TEACHER", HttpMethod.DELETE, "/api/assignments/" + bai, null);
            Map<String, Object> xoa = mot("DELETE", "ASSIGNMENT", bai);
            assertThat((String) xoa.get("old_data")).as("xoá phải giữ lại hình dạng cũ").contains("Tên đã đổi");
            assertThat(xoa.get("new_data")).isNull();
        }

        @Test
        @DisplayName("chấm điểm và trả bài: mỗi lượt một dòng, có điểm trước và sau")
        void chamVaTraBai() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài để chấm");
            long nop = taoBaiNop(bai);

            goi(giaoVien, "TEACHER", HttpMethod.PUT, "/api/teacher/submissions/%d/grade".formatted(nop),
                    "{\"score\":8.5,\"feedback\":\"Làm tốt\"}");
            Map<String, Object> cham = mot("GRADE", "SUBMISSION", nop);
            assertThat((String) cham.get("old_data")).as("trước khi chấm chưa có điểm")
                    .isEqualTo("student=%d,score=null,rawScore=null,status=SUBMITTED".formatted(hocSinh));
            assertThat((String) cham.get("new_data")).contains("rawScore=8.5").contains("status=GRADED");

            goi(giaoVien, "TEACHER", HttpMethod.PATCH, "/api/teacher/submissions/%d/return".formatted(nop), null);
            Map<String, Object> tra = mot("RETURN", "SUBMISSION", nop);
            assertThat((String) tra.get("old_data")).contains("status=GRADED");
            assertThat((String) tra.get("new_data")).contains("status=RETURNED");
        }

        /**
         * Đường nguy hiểm nhất trong cả module: một lượt bấm đổi điểm của cả lớp. Nhật ký phải nói
         * được bao nhiêu bài bị đổi, không chỉ "đã chạy".
         */
        @Test
        @DisplayName("chấm lại cả lớp ghi rõ số bài đổi điểm")
        void chamLaiCaLop() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài để chấm lại");
            taoBaiNop(bai);

            goi(giaoVien, "TEACHER", HttpMethod.POST,
                    "/api/teacher/submissions/assignments/%d/regrade".formatted(bai), null);
            assertThat((String) mot("REGRADE", "ASSIGNMENT", bai).get("new_data"))
                    .isEqualTo("updated=1,scoreChanged=1");
        }

        @Test
        @DisplayName("thêm và gỡ học sinh khỏi lớp")
        void thanhVienLop() throws Exception {
            long lopRieng = taoLopCuaGiaoVien();

            goi(giaoVien, "TEACHER", HttpMethod.POST, "/api/classes/%d/roster/students".formatted(lopRieng),
                    "{\"userId\":%d}".formatted(hocSinh));
            assertThat((String) mot("ADD_STUDENT", "CLASS", lopRieng).get("new_data"))
                    .isEqualTo("studentId=%d,newAccount=false".formatted(hocSinh));

            Long ghiDanh = jdbc.queryForObject(
                    "select id from class_students where class_id=? and student_id=? and deleted_at is null",
                    Long.class, lopRieng, hocSinh);
            goi(giaoVien, "TEACHER", HttpMethod.DELETE,
                    "/api/classes/%d/roster/students/%d".formatted(lopRieng, ghiDanh), null);
            assertThat((String) mot("REMOVE_STUDENT", "CLASS", lopRieng).get("old_data"))
                    .isEqualTo("studentId=%d,enrollmentId=%d".formatted(hocSinh, ghiDanh));
        }

        /**
         * Gắn tài liệu vào lớp là cách duy nhất mở tài liệu ra cho học sinh, nên nó là một phép
         * cấp quyền chứ không phải một phép sắp xếp nội dung — phải ghi ngang hàng với thêm người.
         */
        @Test
        @DisplayName("gắn, sửa nhãn, gỡ tài liệu khỏi lớp")
        void taiLieuCuaLop() throws Exception {
            long lopRieng = taoLopCuaGiaoVien();
            long taiLieu = taoTaiLieu("KHBD", "TEACHER_ONLY", "PUBLISHED", null);

            goi(giaoVien, "TEACHER", HttpMethod.POST, "/api/classes/%d/documents".formatted(lopRieng),
                    "{\"documentId\":%d,\"requirement\":\"TU_CHON\"}".formatted(taiLieu));
            assertThat((String) mot("ATTACH_DOCUMENT", "CLASS", lopRieng).get("new_data"))
                    .isEqualTo("documentId=%d,requirement=TU_CHON".formatted(taiLieu));

            Long ganKet = jdbc.queryForObject(
                    "select id from class_documents where class_id=? and document_id=? and deleted_at is null",
                    Long.class, lopRieng, taiLieu);
            goi(giaoVien, "TEACHER", HttpMethod.PATCH, "/api/classes/%d/documents/%d".formatted(lopRieng, ganKet),
                    "{\"requirement\":\"BAT_BUOC\"}");
            Map<String, Object> sua = mot("UPDATE_DOCUMENT", "CLASS", lopRieng);
            assertThat((String) sua.get("old_data")).isEqualTo("documentId=%d,requirement=TU_CHON".formatted(taiLieu));
            assertThat((String) sua.get("new_data")).isEqualTo("documentId=%d,requirement=BAT_BUOC".formatted(taiLieu));

            goi(giaoVien, "TEACHER", HttpMethod.DELETE,
                    "/api/classes/%d/documents/%d".formatted(lopRieng, ganKet), null);
            assertThat((String) mot("DETACH_DOCUMENT", "CLASS", lopRieng).get("old_data"))
                    .isEqualTo("documentId=%d,requirement=BAT_BUOC".formatted(taiLieu));
        }

        /**
         * Ghi nhật ký đặt ở tầng nghiệp vụ chứ không ở controller, vì cùng một phép đổi trạng thái
         * được gọi từ hai controller khác nhau. Phép thử này đi vào đường của giáo viên.
         */
        @Test
        @DisplayName("lưu trữ và khôi phục tài liệu riêng ghi lại trạng thái hai đầu")
        void luuTruTaiLieu() throws Exception {
            long taiLieu = taoTaiLieu("DE_THI", "TEACHER_ONLY", "DRAFT", giaoVien);

            goi(giaoVien, "TEACHER", HttpMethod.PATCH, "/api/teacher/documents/%d/archive".formatted(taiLieu), null);
            Map<String, Object> an = mot("ARCHIVE", "DOCUMENT", taiLieu);
            assertThat((String) an.get("old_data")).isEqualTo("status=DRAFT");
            assertThat((String) an.get("new_data")).isEqualTo("status=HIDDEN");

            goi(giaoVien, "TEACHER", HttpMethod.PATCH, "/api/teacher/documents/%d/restore".formatted(taiLieu), null);
            Map<String, Object> khoiPhuc = mot("RESTORE", "DOCUMENT", taiLieu);
            assertThat((String) khoiPhuc.get("old_data")).isEqualTo("status=HIDDEN");
            assertThat((String) khoiPhuc.get("new_data")).isEqualTo("status=DRAFT");
        }

        /** Và đây là đường của quản trị, cùng một hàm nghiệp vụ, cùng một chỗ ghi. */
        @Test
        @DisplayName("xuất bản và ẩn sách giáo khoa")
        void xuatBanSach() throws Exception {
            long sach = taoTaiLieu("SGK", "STUDENT_ALLOWED", "DRAFT", null);

            goi(quanTri, "ADMIN", HttpMethod.PATCH, "/api/admin/documents/textbooks/%d/publish".formatted(sach), null);
            Map<String, Object> xuatBan = mot("PUBLISH", "DOCUMENT", sach);
            assertThat((String) xuatBan.get("new_data")).isEqualTo("status=PUBLISHED");
            assertThat(xuatBan.get("actor_user_id")).isEqualTo(quanTri);

            goi(quanTri, "ADMIN", HttpMethod.PATCH, "/api/admin/documents/textbooks/%d/hide".formatted(sach), null);
            Map<String, Object> an = mot("HIDE", "DOCUMENT", sach);
            assertThat((String) an.get("old_data")).isEqualTo("status=PUBLISHED");
            assertThat((String) an.get("new_data")).isEqualTo("status=HIDDEN");
        }

        /** Xoá tài liệu là đường mất dữ liệu, nên dòng nhật ký phải giữ lại tên và loại của thứ đã mất. */
        @Test
        @DisplayName("quản trị xoá tài liệu vẫn còn dấu vết về thứ đã xoá")
        void xoaTaiLieu() throws Exception {
            long taiLieu = taoTaiLieu("KHBD", "TEACHER_ONLY", "PUBLISHED", null);

            goi(quanTri, "ADMIN", HttpMethod.DELETE, "/api/admin/documents/" + taiLieu, null);
            Map<String, Object> xoa = mot("DELETE", "DOCUMENT", taiLieu);
            assertThat((String) xoa.get("old_data")).contains("docType=KHBD").contains("status=PUBLISHED");
            assertThat(xoa.get("new_data")).isNull();
        }

        /**
         * Nhật ký nằm <em>sau</em> guard, không phải trước. Một lượt gọi bị chặn mà vẫn ghi dòng
         * thì bảng nhật ký sẽ đầy những việc chưa từng xảy ra, và tệ hơn: người đọc nhật ký sẽ
         * tin là chúng đã xảy ra.
         */
        @Test
        @DisplayName("lượt gọi bị chặn không để lại dòng nào")
        void biChanThiKhongGhi() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài của giáo viên phụ trách");
            int truoc = tongDong();

            int trangThai = goi(giaoVienKhac, "TEACHER", HttpMethod.DELETE, "/api/assignments/" + bai, null, false);

            assertThat(trangThai).isEqualTo(403);
            assertThat(dong("DELETE", "ASSIGNMENT", bai)).as("không có dòng xoá nào").isEmpty();
            assertThat(tongDong()).as("bảng nhật ký không dài thêm").isEqualTo(truoc);
        }
    }

    // ==================== 2. Không lộ dữ liệu ====================

    @Nested
    @DisplayName("Không lộ dữ liệu nhạy cảm")
    class KhongLo {

        /**
         * {@code AddStudentRequest} mang mật khẩu khởi tạo. Ghi cả thân yêu cầu vào nhật ký là
         * cách nhanh nhất biến bảng nhật ký thành kho mật khẩu đọc được bằng mắt.
         */
        @Test
        @DisplayName("mật khẩu khởi tạo không lọt vào bảng nhật ký")
        void khongLoMatKhau() throws Exception {
            long lopRieng = taoLopCuaGiaoVien();
            String ten = "hs-moi-" + dem.incrementAndGet();

            goi(giaoVien, "TEACHER", HttpMethod.POST, "/api/classes/%d/roster/students".formatted(lopRieng), """
                    {"fullName":"Học sinh mới","username":"%s","email":"%s@audit.test","password":"%s"}
                    """.formatted(ten, ten, MAT_KHAU));

            assertThat((String) mot("ADD_STUDENT", "CLASS", lopRieng).get("new_data"))
                    .as("việc thêm vẫn được ghi").endsWith("newAccount=true");
            assertThat(demChuoi(MAT_KHAU)).as("mật khẩu xuất hiện trong nhật ký").isZero();
        }

        /**
         * {@code answer_json} là bài làm của học sinh. Nhân bản nó sang bảng nhật ký là mở dữ liệu
         * học tập của từng em cho mọi quản trị viên, trong khi câu hỏi nhật ký cần trả lời chỉ là
         * điểm đã đổi từ bao nhiêu sang bao nhiêu.
         */
        @Test
        @DisplayName("bài làm của học sinh không lọt vào bảng nhật ký")
        void khongLoBaiLam() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài kiểm tra rò rỉ");
            long nop = taoBaiNop(bai);

            goi(giaoVien, "TEACHER", HttpMethod.PUT, "/api/teacher/submissions/%d/grade".formatted(nop),
                    "{\"score\":7,\"feedback\":\"Ổn\"}");
            goi(giaoVien, "TEACHER", HttpMethod.POST,
                    "/api/teacher/submissions/assignments/%d/regrade".formatted(bai), null);

            assertThat(dong("GRADE", "SUBMISSION", nop)).as("việc chấm vẫn được ghi").hasSize(1);
            assertThat(demChuoi(baiLam)).as("bài làm xuất hiện trong nhật ký").isZero();
        }
    }

    // ==================== 3. Bộ lọc chạy dưới CSDL ====================

    @Nested
    @DisplayName("Bộ lọc chạy dưới cơ sở dữ liệu")
    class LocDuoiCsdl {

        @Test
        @DisplayName("lọc theo loại đối tượng, mã đối tượng, thao tác và người thực hiện")
        void locTungTieuChi() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài để lọc");

            JsonNode theoDoiTuong = tra("targetType=ASSIGNMENT&targetId=" + bai);
            assertThat(theoDoiTuong.get("totalElements").asInt()).isEqualTo(1);
            assertThat(theoDoiTuong.get("content").get(0).get("action").asText()).isEqualTo("CREATE");

            assertThat(dem("action=CREATE&targetType=ASSIGNMENT&targetId=" + bai)).isEqualTo(1);
            assertThat(dem("action=DELETE&targetType=ASSIGNMENT&targetId=" + bai)).isZero();
            assertThat(dem("actorUserId=%d&targetId=%d".formatted(giaoVien, bai))).isEqualTo(1);
            assertThat(dem("actorUserId=%d&targetId=%d".formatted(giaoVienKhac, bai))).isZero();
            assertThat(dem("targetType=CLASS&targetId=" + bai)).as("cùng mã nhưng khác loại").isZero();
        }

        /**
         * Vai trò lọc qua bảng {@code users} chứ không lưu vào chính dòng nhật ký: vai của một
         * người có thể đổi, và câu hỏi cần trả lời là "theo danh sách hôm nay, ai đang là giáo viên
         * đã làm việc này".
         */
        @Test
        @DisplayName("lọc theo vai trò của người thực hiện")
        void locTheoVaiTro() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài để lọc theo vai");

            assertThat(dem("actorRole=TEACHER&targetType=ASSIGNMENT&targetId=" + bai)).isEqualTo(1);
            assertThat(dem("actorRole=STUDENT&targetType=ASSIGNMENT&targetId=" + bai)).isZero();
            assertThat(dem("actorRole=ADMIN&targetType=ASSIGNMENT&targetId=" + bai)).isZero();
        }

        @Test
        @DisplayName("lọc theo số ngày bỏ qua dòng cũ")
        void locTheoNgay() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài để lọc theo ngày");
            jdbc.update("""
                    insert into audit_logs (actor_user_id, action, target_type, target_id, created_at, updated_at)
                    values (?, 'UPDATE', 'ASSIGNMENT', ?, now() - interval '40 days', now() - interval '40 days')
                    """, giaoVien, bai);

            assertThat(dem("targetType=ASSIGNMENT&targetId=" + bai)).as("không lọc thì thấy cả hai").isEqualTo(2);
            assertThat(dem("targetType=ASSIGNMENT&targetId=%d&days=7".formatted(bai)))
                    .as("7 ngày qua chỉ còn dòng mới").isEqualTo(1);
        }

        /**
         * Chính khiếm khuyết mà việc mở rộng nhật ký gây ra, và là lý do bộ lọc phải xuống CSDL.
         *
         * <p>Màn hình cũ tải 50 dòng mới nhất rồi lọc trong trình duyệt. Từ khi nhật ký ghi thêm
         * bài giao, điểm và thành viên lớp, 50 dòng chỉ còn là vài phút hoạt động — nên một việc
         * xảy ra sáng nay đã bị đẩy khỏi cửa sổ đó, và màn hình sẽ khẳng định "không có kết quả"
         * về một việc thật sự đã xảy ra. Phép thử dựng đúng tình huống ấy: một dòng cần tìm, rồi
         * 60 dòng mới hơn đè lên nó.
         */
        @Test
        @DisplayName("dòng cũ bị 60 dòng mới đè lên vẫn tìm ra")
        void khongBiTrangDauNuot() throws Exception {
            long bai = taoBaiGiaoQuaApi("Bài bị đè");
            for (int i = 0; i < 60; i++) taoBaiGiaoQuaApi("Bài gây nhiễu " + i);

            JsonNode trangDau = tra("size=50");
            assertThat(trangDau.get("content")).hasSize(50);
            boolean thayTrongTrangDau = false;
            for (JsonNode hang : trangDau.get("content")) {
                if (hang.get("targetId").asLong() == bai) thayTrongTrangDau = true;
            }
            assertThat(thayTrongTrangDau).as("tiền đề: dòng cần tìm đã rơi khỏi trang đầu").isFalse();

            assertThat(dem("size=50&targetType=ASSIGNMENT&targetId=" + bai))
                    .as("lọc dưới CSDL vẫn tìm ra").isEqualTo(1);
        }

        /**
         * Không truyền tham số sắp xếp thì máy chủ phải tự đặt mới nhất lên đầu. Truy vấn nhật ký
         * không có {@code order by} nào, nên nếu thứ tự phó mặc cho lời gọi thì một client quên
         * gửi {@code sort} sẽ nhận về nhật ký xáo trộn mà không có dấu hiệu gì báo là đã xáo.
         */
        @Test
        @DisplayName("không truyền sort thì máy chủ vẫn xếp mới nhất lên đầu")
        void thuTuMacDinh() throws Exception {
            long cu = taoBaiGiaoQuaApi("Bài cũ hơn");
            long moi = taoBaiGiaoQuaApi("Bài mới hơn");

            JsonNode noiDung = tra("size=50&action=CREATE&targetType=ASSIGNMENT").get("content");
            int viTriCu = -1, viTriMoi = -1;
            for (int i = 0; i < noiDung.size(); i++) {
                long id = noiDung.get(i).get("targetId").asLong();
                if (id == cu) viTriCu = i;
                if (id == moi) viTriMoi = i;
            }
            assertThat(viTriMoi).as("dòng mới phải có trong trang đầu").isNotNegative();
            assertThat(viTriCu).as("dòng cũ phải có trong trang đầu").isNotNegative();
            assertThat(viTriMoi).as("dòng mới hơn phải đứng trước").isLessThan(viTriCu);
        }
    }

    // ==================== Hạ tầng ====================

    private JsonNode tra(String thamSo) throws Exception {
        MvcResult ketQua = mockMvc.perform(request(HttpMethod.GET, "/api/audit-logs?" + thamSo)
                .with(authentication(danhTinh(quanTri, "ADMIN")))).andReturn();
        assertThat(ketQua.getResponse().getStatus()).as(thamSo).isEqualTo(200);
        return json.readTree(ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8)).get("data");
    }

    private int dem(String thamSo) throws Exception {
        return tra(thamSo).get("totalElements").asInt();
    }

    /** Lượt gọi phải thành công; dùng cho mọi bước dựng bối cảnh. */
    private void goi(long nguoi, String vai, HttpMethod phuongThuc, String duongDan, String than) throws Exception {
        goi(nguoi, vai, phuongThuc, duongDan, than, true);
    }

    private int goi(long nguoi, String vai, HttpMethod phuongThuc, String duongDan, String than, boolean phaiThanhCong)
            throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(phuongThuc, duongDan).with(authentication(danhTinh(nguoi, vai)));
        if (than != null) yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content(than);
        else if (phuongThuc != HttpMethod.GET && phuongThuc != HttpMethod.DELETE) {
            yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content("{}");
        }
        var phanHoi = mockMvc.perform(yeuCau).andReturn().getResponse();
        if (phaiThanhCong) {
            assertThat(phanHoi.getStatus())
                    .as("%s %s → %s", phuongThuc, duongDan, phanHoi.getContentAsString(StandardCharsets.UTF_8))
                    .isEqualTo(200);
        }
        return phanHoi.getStatus();
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@audit.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }

    private List<Map<String, Object>> dong(String action, String targetType, long targetId) {
        return jdbc.queryForList("""
                select actor_user_id, old_data, new_data, ip_address from audit_logs
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

    /** Quét cả ba cột dữ liệu của mọi dòng — rò rỉ ở cột nào cũng là rò rỉ. */
    private int demChuoi(String canTim) {
        Integer n = jdbc.queryForObject("""
                select count(*) from audit_logs
                where coalesce(old_data,'') like ? or coalesce(new_data,'') like ? or coalesce(metadata,'') like ?
                """, Integer.class, "%" + canTim + "%", "%" + canTim + "%", "%" + canTim + "%");
        return n == null ? 0 : n;
    }

    // ==================== Dựng dữ liệu ====================

    private String thanBaiGiao(String ten) {
        return """
                {"classId":%d,"worksheetId":%d,"title":"%s","status":"PUBLISHED",
                 "requirement":"BAT_BUOC","maxAttempts":1,"latePolicy":"REJECT","latePenaltyPercent":0}
                """.formatted(lop, phieu, ten);
    }

    private long taoBaiGiaoQuaApi(String ten) throws Exception {
        MvcResult ketQua = mockMvc.perform(request(HttpMethod.POST, "/api/assignments")
                .contentType(MediaType.APPLICATION_JSON).content(thanBaiGiao(ten))
                .with(authentication(danhTinh(giaoVien, "TEACHER")))).andReturn();
        String than = ketQua.getResponse().getContentAsString(StandardCharsets.UTF_8);
        assertThat(ketQua.getResponse().getStatus()).as("tạo bài giao %s → %s", ten, than).isEqualTo(200);
        return json.readTree(than).get("data").get("id").asLong();
    }

    private long taoNguoiDung(String vai, String ten) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, ten + "@audit.test", ten, ten, vai);
    }

    /**
     * Lớp mới cho mỗi phép thử có ghi nhật ký ở cấp lớp. Dùng chung một lớp thì khẳng định "đúng
     * một dòng ADD_STUDENT" của phép thử này sẽ đỏ lên vì phép thử khác cũng vừa thêm học sinh —
     * và JUnit không bảo đảm thứ tự chạy, nên hỏng sẽ lúc có lúc không.
     */
    private long taoLopCuaGiaoVien() {
        String ma = "AUDIT-" + dem.incrementAndGet();
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        Long id = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, ma, ma, khoi);
        jdbc.update("insert into class_teachers (class_id, teacher_id, created_at, updated_at) values (?, ?, now(), now())",
                id, giaoVien);
        return id;
    }

    private long taoPhieu() {
        return jdbc.queryForObject("""
                insert into worksheets (name, columns_count, show_qr, show_student_fields, created_by, created_at, updated_at)
                values ('Phiếu cho nhật ký', 1, true, true, ?, now(), now())
                returning id
                """, Long.class, giaoVien);
    }

    /** Câu hỏi có đáp án đúng, để đường chấm lại cả lớp chạy được thật chứ không dừng ở kiểm tra đề. */
    private long taoCauHoi() {
        Long loai = jdbc.queryForObject(
                "select id from problem_types where deleted_at is null order by id limit 1", Long.class);
        return jdbc.queryForObject("""
                insert into problems (problem_type_id, public_code, qr_slug, statement_latex, difficulty, status,
                                      correct_option, created_by, created_at, updated_at)
                values (?, 'AUDIT-01', 'audit01', 'Câu hỏi cho nhật ký', 'NHAN_BIET', 'PUBLISHED', 'A', ?, now(), now())
                returning id
                """, Long.class, loai, giaoVien);
    }

    /** Bài nộp chưa chấm: điểm phải là null lúc đầu thì cột "trước" của dòng nhật ký mới có nghĩa. */
    private long taoBaiNop(long baiGiao) {
        return jdbc.queryForObject("""
                insert into assignment_progress (assignment_id, student_id, completion_percent, submitted_at,
                                                 grading_status, attempt_no, submitted_late, answer_json,
                                                 created_at, updated_at)
                values (?, ?, 100, now(), 'SUBMITTED', 1, false, ?, now(), now())
                returning id
                """, Long.class, baiGiao, hocSinh, baiLam);
    }

    /** {@code file_url} để rỗng có chủ đích: cột NOT NULL, và không lượt gọi nào ở đây đi ra R2. */
    private long taoTaiLieu(String loai, String doiTuong, String trangThai, Long chuSoHuu) {
        int so = dem.incrementAndGet();
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, base_page_offset, owner_id,
                                       created_at, updated_at)
                values (?, ?, ?, '', ?, 1, ?, now(), now())
                returning id
                """, Long.class, "Tài liệu nhật ký " + so, loai, doiTuong, trangThai, chuSoHuu);
    }
}
