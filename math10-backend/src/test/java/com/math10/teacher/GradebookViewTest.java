package com.math10.teacher;

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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

/**
 * Sổ điểm của một lớp — cái bảng học sinh × bài tập mà năm màn hình khác nhau đọc chung.
 *
 * <p>Phép thử này canh ba nhóm khẳng định, mỗi nhóm ứng với một kiểu hỏng đã có thật trong bảng:
 *
 * <ol>
 *   <li><b>Hình dạng bảng.</b> Bài nháp không được thành cột: nó chưa tới tay ai nên ô nào cũng
 *       "chưa mở", và mọi con số trung bình mà màn hình tính từ sổ điểm đều bị nó kéo xuống.
 *       Thứ tự dòng phải chốt tới khoá chính, vì lớp có hai em trùng họ tên là chuyện thường.</li>
 *   <li><b>Trạng thái chấm.</b> Sau khi mở đường tự luận, "nộp rồi chưa ai đụng" và "giáo viên
 *       chấm dở nửa chừng" mang cùng một {@code grading_status}. Chỉ số câu đã chấm tách được
 *       hai nhóm đó, và hàng đợi chấm bài đếm bằng đúng con số này.</li>
 *   <li><b>Lớp lớn.</b> Sổ điểm là tích chéo học sinh × bài, nên nó là chỗ đầu tiên phình ra.
 *       Bốn mươi em mười hai bài phải ra đúng 480 dòng, không thiếu ô nào và không nhân đôi ô
 *       nào — nhân đôi thì mọi phép trung bình phía màn hình lệch mà không ai thấy.</li>
 * </ol>
 *
 * <p>Chạy trên PostgreSQL nhúng, gọi thẳng endpoint thật. Quyền truy cập lớp đã có
 * {@code IdorMatrixTest} canh nên ở đây không lặp lại.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class GradebookViewTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper json = new ObjectMapper();
    private final AtomicInteger dem = new AtomicInteger();

    private long giaoVien;
    /** Phiếu trộn: câu 1 trắc nghiệm đáp án A, câu 2 và 3 tự luận. */
    private long phieuTron, tracNghiem, tuLuan1, tuLuan2;
    /** Phiếu toàn trắc nghiệm, để dựng bài tự lên điểm ngay lúc nộp. */
    private long phieuTracNghiem, tracNghiemA;

    @BeforeAll
    void dungDuLieu() {
        giaoVien = taoNguoiDung("TEACHER", "gv-sodiem");
        tracNghiem = taoCauHoi("A");
        tuLuan1 = taoCauHoi(null);
        tuLuan2 = taoCauHoi(null);
        phieuTron = taoPhieu(tracNghiem, tuLuan1, tuLuan2);
        tracNghiemA = taoCauHoi("A");
        phieuTracNghiem = taoPhieu(tracNghiemA);
    }

    // ==================== 1. Hình dạng bảng ====================

    @Nested
    @DisplayName("Hình dạng bảng")
    class HinhDangBang {

        /**
         * Bài nháp không được thành cột.
         *
         * <p>Giáo viên soạn sẵn mười bài cho cả học kỳ là chuyện bình thường. Nếu sổ điểm đếm cả
         * bài nháp thì mỗi bài soạn trước là một cột trắng, và tỉ lệ hoàn thành của lớp tụt xuống
         * theo — trên màn hình quản lý lớp, lớp ấy tự nhiên rơi vào nhóm "cần chú ý" mà giáo viên
         * không làm gì sai cả.
         */
        @Test
        void boBaiNhap() throws Exception {
            long lop = taoLopCoHocSinh(1);
            long congBo = taoBaiGiao(lop, phieuTracNghiem, "Đã giao", "PUBLISHED");
            taoBaiGiao(lop, phieuTracNghiem, "Còn soạn", "DRAFT");

            List<JsonNode> dong = soDiem(lop);

            assertThat(dong).hasSize(1);
            assertThat(dong.get(0).get("assignment_id").asLong()).isEqualTo(congBo);
        }

        /** Bài đã đóng vẫn phải nằm trong sổ: điểm cũ là điểm thật, không biến mất theo trạng thái. */
        @Test
        void giuBaiDaDong() throws Exception {
            long lop = taoLopCoHocSinh(1);
            long bai = taoBaiGiao(lop, phieuTracNghiem, "Đã đóng", "CLOSED");

            List<JsonNode> dong = soDiem(lop);

            assertThat(dong).hasSize(1);
            assertThat(dong.get(0).get("assignment_id").asLong()).isEqualTo(bai);
            assertThat(dong.get(0).get("assignment_status").asText()).isEqualTo("CLOSED");
        }

        /** Mỗi cặp học sinh × bài xuất hiện đúng một lần, kể cả khi chưa em nào làm bài. */
        @Test
        void moiOMotDong() throws Exception {
            long lop = taoLopCoHocSinh(6);
            for (int i = 0; i < 4; i++) taoBaiGiao(lop, phieuTracNghiem, "Bài " + i, "PUBLISHED");

            List<JsonNode> dong = soDiem(lop);

            assertThat(dong).hasSize(24);
            Set<String> o = new LinkedHashSet<>();
            for (JsonNode item : dong) {
                o.add(item.get("student_id").asLong() + ":" + item.get("assignment_id").asLong());
            }
            assertThat(o).hasSize(24);
        }

        /**
         * Hai em trùng họ tên thì thứ tự giữa hai em phải do khoá chính quyết định, không phải do
         * PostgreSQL tuỳ nghi. Sắp theo mỗi {@code full_name} là hai lần tải cùng dữ liệu có thể
         * ra hai thứ tự khác nhau — và người dùng đọc bảng theo vị trí dòng.
         */
        @Test
        void thuTuOnDinhKhiTrungTen() throws Exception {
            long lop = taoLop();
            long em1 = taoNguoiDung("STUDENT", "hs-trung-ten");
            long em2 = taoNguoiDung("STUDENT", "hs-trung-ten");
            jdbc.update("update users set full_name='Nguyễn Văn An' where id in (?,?)", em1, em2);
            vaoLop(lop, em1);
            vaoLop(lop, em2);
            taoBaiGiao(lop, phieuTracNghiem, "Một bài", "PUBLISHED");

            List<Long> lanDau = thuTuHocSinh(soDiem(lop));
            List<Long> lanHai = thuTuHocSinh(soDiem(lop));

            assertThat(lanDau).containsExactly(Math.min(em1, em2), Math.max(em1, em2));
            assertThat(lanHai).isEqualTo(lanDau);
        }

        /** Em đã rời lớp thì biến khỏi sổ, nhưng bài nộp cũ vẫn nằm nguyên trong cơ sở dữ liệu. */
        @Test
        void hocSinhRoiLopThiKhongCon() throws Exception {
            long lop = taoLop();
            long oLai = taoNguoiDung("STUDENT", "hs-o-lai");
            long roiDi = taoNguoiDung("STUDENT", "hs-roi-di");
            vaoLop(lop, oLai);
            vaoLop(lop, roiDi);
            taoBaiGiao(lop, phieuTracNghiem, "Một bài", "PUBLISHED");
            jdbc.update("update class_students set deleted_at=now() where class_id=? and student_id=?", lop, roiDi);

            assertThat(thuTuHocSinh(soDiem(lop))).containsExactly(oLai);
        }
    }

    // ==================== 2. Trạng thái chấm ====================

    @Nested
    @DisplayName("Trạng thái chấm trong sổ")
    class TrangThaiCham {

        /** Chưa mở bài thì không có dòng tiến độ nào — sổ vẫn phải có ô, và ô ấy rỗng. */
        @Test
        void chuaLamThiOTrong() throws Exception {
            long lop = taoLopCoHocSinh(1);
            taoBaiGiao(lop, phieuTron, "Chưa ai làm", "PUBLISHED");

            JsonNode o = soDiem(lop).get(0);

            assertThat(o.get("progress_id").isNull()).isTrue();
            assertThat(o.get("status").asText()).isEqualTo("NOT_OPENED");
            assertThat(o.get("grading_status").asText()).isEqualTo("NOT_SUBMITTED");
            assertThat(o.get("graded_items").asInt()).isZero();
        }

        /** Đề toàn trắc nghiệm tự lên điểm ngay lúc nộp: sổ thấy điểm mà không cần ai chấm. */
        @Test
        void tracNghiemLenDiemNgay() throws Exception {
            long lop = taoLop();
            long em = taoNguoiDung("STUDENT", "hs-trac-nghiem");
            vaoLop(lop, em);
            long bai = taoBaiGiao(lop, phieuTracNghiem, "Trắc nghiệm", "PUBLISHED");
            nop(em, bai, Map.of(tracNghiemA, "A"));

            JsonNode o = soDiem(lop).get(0);

            assertThat(o.get("grading_status").asText()).isEqualTo("GRADED");
            assertThat(o.get("score").decimalValue()).isEqualByComparingTo("10.00");
            assertThat(o.get("graded_items").asInt()).isZero();
        }

        /** Nộp đề trộn xong mà chưa ai chấm: chờ chấm, chưa có điểm, chưa câu nào được đọc. */
        @Test
        void nopRoiChuaAiCham() throws Exception {
            long lop = taoLop();
            long em = taoNguoiDung("STUDENT", "hs-cho-cham");
            vaoLop(lop, em);
            long bai = taoBaiGiao(lop, phieuTron, "Đề trộn", "PUBLISHED");
            nop(em, bai, Map.of(tracNghiem, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));

            JsonNode o = soDiem(lop).get(0);

            assertThat(o.get("grading_status").asText()).isEqualTo("SUBMITTED");
            assertThat(o.get("score").isNull()).isTrue();
            assertThat(o.get("graded_items").asInt()).isZero();
            assertThat(o.get("submitted_at").isNull()).isFalse();
        }

        /**
         * Chỗ mấu chốt của lát này. Chấm một trong hai câu tự luận: bài vẫn mang
         * {@code SUBMITTED} y hệt bài chưa ai đụng tới, chỉ {@code graded_items} phân biệt được.
         * Không có con số đó thì hàng đợi chấm bài gộp hai nhóm làm một, và giáo viên bỏ dở mười
         * hai bài không có cách nào tìm lại chúng.
         */
        @Test
        void chamDoThiDemDungSoCau() throws Exception {
            long lop = taoLop();
            long em = taoNguoiDung("STUDENT", "hs-cham-do");
            vaoLop(lop, em);
            long bai = taoBaiGiao(lop, phieuTron, "Chấm dở", "PUBLISHED");
            nop(em, bai, Map.of(tracNghiem, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            cham(nopId(bai, em), "3.33", null);

            JsonNode o = soDiem(lop).get(0);

            assertThat(o.get("grading_status").asText()).isEqualTo("SUBMITTED");
            assertThat(o.get("score").isNull()).isTrue();
            assertThat(o.get("graded_items").asInt()).isEqualTo(1);
        }

        /** Chấm đủ thì chốt tổng và bài rời hàng chờ. */
        @Test
        void chamDuThiChotDiem() throws Exception {
            long lop = taoLop();
            long em = taoNguoiDung("STUDENT", "hs-cham-du");
            vaoLop(lop, em);
            long bai = taoBaiGiao(lop, phieuTron, "Chấm đủ", "PUBLISHED");
            nop(em, bai, Map.of(tracNghiem, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            cham(nopId(bai, em), "3.33", "3.33");

            JsonNode o = soDiem(lop).get(0);

            assertThat(o.get("grading_status").asText()).isEqualTo("GRADED");
            assertThat(o.get("score").decimalValue()).isEqualByComparingTo("10.00");
            assertThat(o.get("graded_items").asInt()).isEqualTo(2);
        }

        /**
         * Xoá trắng một ô đã chấm là mở lại bài, không phải cho 0 điểm — và sổ điểm phải thấy
         * đúng điều đó, nếu không thì học sinh vẫn đang nhìn một con số giáo viên đã rút lại.
         */
        @Test
        void xoaTrangThiMoLaiBai() throws Exception {
            long lop = taoLop();
            long em = taoNguoiDung("STUDENT", "hs-xoa-trang");
            vaoLop(lop, em);
            long bai = taoBaiGiao(lop, phieuTron, "Xoá trắng", "PUBLISHED");
            nop(em, bai, Map.of(tracNghiem, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = nopId(bai, em);
            cham(nop, "3.33", "3.33");
            cham(nop, "3.33", null);

            JsonNode o = soDiem(lop).get(0);

            assertThat(o.get("grading_status").asText()).isEqualTo("SUBMITTED");
            assertThat(o.get("score").isNull()).isTrue();
            assertThat(o.get("graded_items").asInt()).isEqualTo(1);
        }
    }

    // ==================== 3. Lớp lớn ====================

    @Nested
    @DisplayName("Lớp lớn")
    class LopLon {

        /**
         * Bốn mươi em, mười hai bài. Sổ điểm là tích chéo nên đây là chỗ số dòng phình nhanh
         * nhất trong toàn hệ thống; phép thử ghim đúng con số 480 và ghim rằng không ô nào bị
         * nhân đôi. Ô nhân đôi không làm màn hình vỡ — nó chỉ lặng lẽ kéo lệch mọi phép trung
         * bình mà năm màn hình khác đang tính từ chính mảng này.
         */
        @Test
        void bonMuoiEmMuoiHaiBai() throws Exception {
            long lop = taoLopCoHocSinh(40);
            for (int i = 0; i < 12; i++) taoBaiGiao(lop, phieuTracNghiem, "Bài " + i, "PUBLISHED");

            List<JsonNode> dong = soDiem(lop);

            assertThat(dong).hasSize(480);
            Set<Long> em = new LinkedHashSet<>();
            Set<Long> bai = new LinkedHashSet<>();
            Set<String> o = new LinkedHashSet<>();
            for (JsonNode item : dong) {
                em.add(item.get("student_id").asLong());
                bai.add(item.get("assignment_id").asLong());
                o.add(item.get("student_id").asLong() + ":" + item.get("assignment_id").asLong());
            }
            assertThat(em).hasSize(40);
            assertThat(bai).hasSize(12);
            assertThat(o).hasSize(480);
        }

        /** Các dòng của một em nằm liền nhau: bảng dựng theo dòng, xen kẽ là bảng sai. */
        @Test
        void dongCuaMotEmNamLienNhau() throws Exception {
            long lop = taoLopCoHocSinh(12);
            for (int i = 0; i < 3; i++) taoBaiGiao(lop, phieuTracNghiem, "Bài " + i, "PUBLISHED");

            List<Long> thuTu = new ArrayList<>();
            for (JsonNode item : soDiem(lop)) {
                long em = item.get("student_id").asLong();
                if (thuTu.isEmpty() || thuTu.get(thuTu.size() - 1) != em) thuTu.add(em);
            }

            assertThat(thuTu).doesNotHaveDuplicates().hasSize(12);
        }
    }

    // ==================== Bộ dựng bối cảnh ====================

    private List<JsonNode> soDiem(long lop) throws Exception {
        JsonNode data = duLieu(goi(giaoVien, "TEACHER", HttpMethod.GET, "/api/teacher/gradebook?classId=" + lop, null));
        List<JsonNode> dong = new ArrayList<>();
        data.forEach(dong::add);
        return dong;
    }

    /** Thứ tự học sinh xuất hiện trong sổ, mỗi em một lần. */
    private List<Long> thuTuHocSinh(List<JsonNode> dong) {
        List<Long> thuTu = new ArrayList<>();
        for (JsonNode item : dong) {
            long em = item.get("student_id").asLong();
            if (!thuTu.contains(em)) thuTu.add(em);
        }
        return thuTu;
    }

    private long nopId(long baiGiao, long hocSinh) {
        return jdbc.queryForObject("""
                select id from assignment_progress
                where assignment_id=? and student_id=? and deleted_at is null
                """, Long.class, baiGiao, hocSinh);
    }

    private void nop(long hocSinh, long baiGiao, Map<Long, String> baiLam) throws Exception {
        StringBuilder than = new StringBuilder("{\"answers\":{");
        boolean dau = true;
        for (Map.Entry<Long, String> o : baiLam.entrySet()) {
            if (!dau) than.append(',');
            than.append('"').append(o.getKey()).append("\":\"").append(o.getValue()).append('"');
            dau = false;
        }
        than.append("}}");
        goi(hocSinh, "STUDENT", HttpMethod.POST, "/api/assignment-progress/%d/submit".formatted(baiGiao), than.toString());
    }

    /** Chấm hai câu tự luận; {@code null} nghĩa là để trống câu đó, tức chưa chấm. */
    private void cham(long nop, String diem1, String diem2) throws Exception {
        goi(giaoVien, "TEACHER", HttpMethod.PUT, "/api/teacher/submissions/%d/grade-items".formatted(nop),
                """
                        {"items":[{"problemId":%d,"score":%s,"feedback":null},
                                  {"problemId":%d,"score":%s,"feedback":null}]}
                        """.formatted(tuLuan1, diem1, tuLuan2, diem2));
    }

    private long taoLopCoHocSinh(int soEm) {
        long lop = taoLop();
        for (int i = 0; i < soEm; i++) vaoLop(lop, taoNguoiDung("STUDENT", "hs-sodiem"));
        return lop;
    }

    private void vaoLop(long lop, long hocSinh) {
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())",
                lop, hocSinh);
    }

    private long taoBaiGiao(long lop, long phieu, String ten, String trangThai) throws Exception {
        String than = """
                {"classId":%d,"worksheetId":%d,"title":"%s","status":"%s","requirement":"BAT_BUOC",
                 "maxAttempts":1,"latePolicy":"REJECT","latePenaltyPercent":0}
                """.formatted(lop, phieu, ten + " " + dem.incrementAndGet(), trangThai);
        return duLieu(goi(giaoVien, "TEACHER", HttpMethod.POST, "/api/assignments", than)).get("id").asLong();
    }

    private long taoNguoiDung(String vai, String ten) {
        String duyNhat = ten + "-" + dem.incrementAndGet();
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, duyNhat + "@sodiem.test", ten, duyNhat, vai);
    }

    private long taoLop() {
        String ma = "SODIEM-" + dem.incrementAndGet();
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        long lop = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, ma, ma, khoi);
        jdbc.update("insert into class_teachers (class_id, teacher_id, created_at, updated_at) values (?,?,now(),now())",
                lop, giaoVien);
        return lop;
    }

    private long taoCauHoi(String dapAn) {
        int so = dem.incrementAndGet();
        Long loai = jdbc.queryForObject(
                "select id from problem_types where deleted_at is null order by id limit 1", Long.class);
        return jdbc.queryForObject("""
                insert into problems (problem_type_id, public_code, qr_slug, statement_latex, difficulty, status,
                                      correct_option, created_by, created_at, updated_at)
                values (?, ?, ?, ?, 'NHAN_BIET', 'PUBLISHED', ?, ?, now(), now())
                returning id
                """, Long.class, loai, "SODIEM-" + so, "sodiem" + so,
                dapAn == null ? "Giải phương trình và biện luận" : "Chọn nghiệm đúng", dapAn, giaoVien);
    }

    private long taoPhieu(long... cauHoi) {
        Long phieu = jdbc.queryForObject("""
                insert into worksheets (name, columns_count, show_qr, show_student_fields, created_by, created_at, updated_at)
                values (?, 1, true, true, ?, now(), now())
                returning id
                """, Long.class, "Phiếu sổ điểm " + dem.incrementAndGet(), giaoVien);
        for (int i = 0; i < cauHoi.length; i++) {
            jdbc.update("""
                    insert into worksheet_items (worksheet_id, problem_id, order_index, created_at, updated_at)
                    values (?, ?, ?, now(), now())
                    """, phieu, cauHoi[i], i + 1);
        }
        return phieu;
    }

    private String goi(long nguoi, String vai, HttpMethod phuongThuc, String duongDan, String than) throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(phuongThuc, duongDan)
                .with(authentication(danhTinh(nguoi, vai)));
        if (than != null) yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content(than);
        else if (phuongThuc != HttpMethod.GET && phuongThuc != HttpMethod.DELETE) {
            yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content("{}");
        }
        var phanHoi = mockMvc.perform(yeuCau).andReturn().getResponse();
        String noiDung = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("%s %s → %s", phuongThuc, duongDan, noiDung).isEqualTo(200);
        return noiDung;
    }

    private JsonNode duLieu(String than) throws Exception {
        return json.readTree(than).get("data");
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@sodiem.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
