package com.math10.assignments;

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
 * Cả đường tự luận, từ lúc học sinh gõ lời giải tới lúc em ấy nhìn thấy điểm từng câu.
 *
 * <p>Trước lát này hệ thống <b>không có đường tự luận nào</b>: nộp bài chỉ nhận A/B/C/D, chấm chỉ
 * có một ô điểm cho cả bài. Nên phép thử này không kiểm một ô nhập mới — nó kiểm một luồng vừa
 * mở, và luồng đó đi qua bốn chỗ mà mỗi chỗ hỏng theo một kiểu im lặng khác nhau:
 *
 * <ol>
 *   <li><b>Lúc nộp</b> — đề trộn phải dừng ở "chờ chấm" với điểm để trống. Điền 0 vào đó là báo
 *       cho học sinh một con số thấp hơn thật, trước khi giáo viên kịp mở bài ra đọc.</li>
 *   <li><b>Lúc chấm dở</b> — chấm 40 bài không ai làm một mạch. Lưu được phần đã chấm mà chưa
 *       chốt tổng, và bài vẫn phải nằm trong hàng chờ.</li>
 *   <li><b>Lúc chốt</b> — tổng quy về thang 10 theo tỉ lệ. Đề 3 câu làm đúng hết phải ra đúng
 *       10.00; cộng thẳng điểm từng câu thì ra 9.99, một con số không ai đạt tới được.</li>
 *   <li><b>Lúc trả bài</b> — học sinh thấy bài làm, điểm và lời phê của mình, <b>không thấy đáp
 *       án của đề</b>. Bài giao lệch giờ giữa các lớp thì một em xem xong đáp án là cả khối biết.</li>
 * </ol>
 *
 * <p>Chạy trên PostgreSQL nhúng và gọi thẳng endpoint thật, nên nó chứng minh cả dây: guard →
 * luật vòng đời → chia điểm → cất vào bảng → trả ra cho đúng người. Theo quy ước của dự án, mọi
 * lượt gọi thành công đều trả HTTP <b>200</b> — 201/204 nằm trong trường {@code code} của thân
 * phản hồi. Mỗi phép thử dựng bài giao riêng cho mình, để khẳng định về trạng thái một bài nộp
 * không phụ thuộc thứ tự chạy giữa các phép thử.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class EssayGradingFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper json = new ObjectMapper();
    private final AtomicInteger dem = new AtomicInteger();

    private long giaoVien, giaoVienKhac, hocSinh;
    private long lop;
    /** Phiếu trộn: câu 1 trắc nghiệm đáp án A, câu 2 và 3 tự luận. Trần mỗi câu 3.33. */
    private long phieuTron, tracNghiem1, tuLuan1, tuLuan2;
    /** Phiếu toàn trắc nghiệm, để chứng minh đường cũ không đổi. */
    private long phieuTracNghiem, tracNghiemA, tracNghiemB;

    @BeforeAll
    void dungDuLieu() {
        giaoVien = taoNguoiDung("TEACHER", "gv-tuluan");
        giaoVienKhac = taoNguoiDung("TEACHER", "gv-tuluan-khac");
        hocSinh = taoNguoiDung("STUDENT", "hs-tuluan");
        lop = taoLop();
        jdbc.update("insert into class_teachers (class_id, teacher_id, created_at, updated_at) values (?,?,now(),now())",
                lop, giaoVien);
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())",
                lop, hocSinh);

        tracNghiem1 = taoCauHoi("A");
        tuLuan1 = taoCauHoi(null);
        tuLuan2 = taoCauHoi(null);
        phieuTron = taoPhieu(tracNghiem1, tuLuan1, tuLuan2);

        tracNghiemA = taoCauHoi("A");
        tracNghiemB = taoCauHoi("B");
        phieuTracNghiem = taoPhieu(tracNghiemA, tracNghiemB);
    }

    // ==================== 1. Học sinh nộp bài ====================

    @Nested
    @DisplayName("Học sinh nộp phiếu có câu tự luận")
    class NopBai {

        /**
         * Điều quan trọng nhất của bước này: bài <b>không</b> tự lên điểm. Đề trộn mà chốt điểm
         * ngay lúc nộp thì con số ấy chỉ có phần trắc nghiệm, và nó thấp hơn thật.
         */
        @Test
        @DisplayName("nộp xong vẫn là chờ chấm, chưa có điểm")
        void nopXongChuaCoDiem() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Nộp phiếu trộn", null, "REJECT", 0);

            JsonNode ketQua = nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "Ta có delta = 4", tuLuan2, "Suy ra x = 2"));

            assertThat(ketQua.get("gradingStatus").asText()).isEqualTo("SUBMITTED");
            assertThat(ketQua.get("score").isNull()).as("chưa chấm thì chưa có điểm").isTrue();
            Map<String, Object> row = baiNop(bai);
            assertThat(row.get("raw_score")).as("tổng chưa chốt").isNull();
            assertThat(row.get("graded_at")).isNull();
        }

        /**
         * Hai cột này hiện lên màn hình là "1/1 câu đúng". Đếm cả câu tự luận vào mẫu số thì thành
         * "1/3 câu đúng" cho một bài chưa ai chấm — câu tự luận không có đúng hay sai.
         */
        @Test
        @DisplayName("số câu đúng chỉ đếm phần trắc nghiệm")
        void demDungPhanTracNghiem() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Đếm câu đúng", null, "REJECT", 0);

            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));

            Map<String, Object> row = baiNop(bai);
            assertThat(((Number) row.get("correct_count")).intValue()).isEqualTo(1);
            assertThat(((Number) row.get("total_questions")).intValue()).as("chỉ 1 câu trắc nghiệm").isEqualTo(1);
        }

        @Test
        @DisplayName("bỏ trống câu tự luận thì không nộp được")
        void boTrongTuLuanThiKhongNop() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Bỏ trống tự luận", null, "REJECT", 0);

            var phanHoi = goiThoi(hocSinh, "STUDENT", HttpMethod.POST,
                    "/api/assignment-progress/%d/submit".formatted(bai),
                    """
                            {"answers":{"%d":"A","%d":"x = 1","%d":"   "}}
                            """.formatted(tracNghiem1, tuLuan1, tuLuan2));

            assertThat(phanHoi.trangThai).isEqualTo(400);
            assertThat(phanHoi.than).contains("đầy đủ");
        }

        /**
         * Đường cũ phải nguyên vẹn: đề toàn trắc nghiệm vẫn tự lên điểm ngay lúc nộp, không bị
         * đẩy vào hàng chờ chấm tay chỉ vì hệ thống nay biết tới câu tự luận.
         */
        @Test
        @DisplayName("đề toàn trắc nghiệm vẫn chấm xong ngay như trước")
        void deToanTracNghiemVanChamNgay() throws Exception {
            long bai = taoBaiGiao(phieuTracNghiem, "Đề toàn trắc nghiệm", null, "REJECT", 0);

            nop(bai, Map.of(tracNghiemA, "A", tracNghiemB, "B"));

            Map<String, Object> row = baiNop(bai);
            assertThat(row.get("grading_status")).isEqualTo("GRADED");
            assertThat(row.get("graded_at")).isNotNull();
            assertThat(diem(row, "raw_score")).isEqualTo("10.00");
        }
    }

    // ==================== 2. Giáo viên chấm từng câu ====================

    @Nested
    @DisplayName("Giáo viên chấm từng câu")
    class ChamTungCau {

        @Test
        @DisplayName("bảng chấm dựng đủ ba câu, chỉ câu tự luận là chấm tay")
        void bangChamDungDuCau() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Bảng chấm", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            JsonNode bang = duLieu(goi(giaoVien, "TEACHER", HttpMethod.GET,
                    "/api/teacher/submissions/%d/items".formatted(nop), null));

            assertThat(bang.get("items")).hasSize(3);
            assertThat(bang.get("maxScoreMoiCau").decimalValue()).isEqualByComparingTo("3.33");
            assertThat(bang.get("conThieu").asInt()).isEqualTo(2);
            assertThat(bang.get("rawScore").isNull()).isTrue();
            JsonNode cau1 = bang.get("items").get(0), cau2 = bang.get("items").get(1);
            assertThat(cau1.get("essay").asBoolean()).isFalse();
            assertThat(cau1.get("score").decimalValue()).as("máy chấm sẵn câu trắc nghiệm")
                    .isEqualByComparingTo("3.33");
            assertThat(cau2.get("essay").asBoolean()).isTrue();
            assertThat(cau2.get("score").isNull()).as("câu tự luận chưa ai chấm").isTrue();
            assertThat(cau2.get("studentAnswer").asText()).isEqualTo("x = 1");
        }

        /**
         * Chấm dở là chuyện bình thường. Chỗ dễ hỏng: chốt tổng sớm, để học sinh nhìn thấy một
         * con số mới chấm được một nửa.
         */
        @Test
        @DisplayName("chấm dở thì lưu được nhưng chưa chốt tổng, bài vẫn trong hàng chờ")
        void chamDoThiChuaChotTong() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Chấm dở", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            JsonNode bang = duLieu(goi(giaoVien, "TEACHER", HttpMethod.PUT,
                    "/api/teacher/submissions/%d/grade-items".formatted(nop),
                    """
                            {"items":[{"problemId":%d,"score":3.33,"feedback":"Đúng hướng"}]}
                            """.formatted(tuLuan1)));

            assertThat(bang.get("conThieu").asInt()).isEqualTo(1);
            assertThat(bang.get("rawScore").isNull()).as("chưa chốt tổng").isTrue();
            Map<String, Object> row = baiNop(bai);
            assertThat(row.get("grading_status")).as("vẫn trong hàng chờ chấm").isEqualTo("SUBMITTED");
            assertThat(row.get("graded_at")).isNull();
            assertThat(row.get("score")).isNull();
        }

        /**
         * Phép thử chốt của cả lát: đề 3 câu làm đúng hết phải ra đúng <b>10.00</b>. Cộng thẳng
         * điểm từng câu (3.33 × 3) ra 9.99 — sai nhỏ, khó thấy, và nằm trên học bạ.
         */
        @Test
        @DisplayName("chấm đủ thì chốt tổng, đúng hết được tròn 10.00 chứ không phải 9.99")
        void chamDuThiChotTong() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Chấm đủ", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            JsonNode bang = duLieu(chamHaiCau(nop, "3.33", "3.33"));

            assertThat(bang.get("conThieu").asInt()).isZero();
            assertThat(bang.get("rawScore").decimalValue()).isEqualByComparingTo("10.00");
            Map<String, Object> row = baiNop(bai);
            assertThat(row.get("grading_status")).isEqualTo("GRADED");
            assertThat(row.get("graded_at")).isNotNull();
            assertThat(diem(row, "score")).isEqualTo("10.00");
        }

        @Test
        @DisplayName("điểm tự luận lẻ vẫn quy đúng về thang 10")
        void diemLeVanQuyDung() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Điểm lẻ", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            // 3.33 (máy chấm) + 3.33 + 1.00 = 7.66 trên trần 9.99 → 7.67.
            JsonNode bang = duLieu(chamHaiCau(nop, "3.33", "1.00"));

            assertThat(bang.get("rawScore").decimalValue()).isEqualByComparingTo("7.67");
        }

        /**
         * Ô điểm để trống nghĩa là bỏ chấm câu ấy, đưa nó về chưa chấm — không phải cho 0 điểm.
         * Gộp hai nghĩa đó lại thì một cú xoá nhầm sẽ chốt điểm thay vì mở lại bài để chấm tiếp.
         */
        @Test
        @DisplayName("xoá trắng ô điểm là bỏ chấm lại câu đó, không phải cho 0")
        void xoaTrangLaBoCham() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Xoá điểm", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);
            chamHaiCau(nop, "3.33", "3.33");

            JsonNode bang = duLieu(goi(giaoVien, "TEACHER", HttpMethod.PUT,
                    "/api/teacher/submissions/%d/grade-items".formatted(nop),
                    """
                            {"items":[{"problemId":%d,"score":null}]}
                            """.formatted(tuLuan2)));

            assertThat(bang.get("conThieu").asInt()).isEqualTo(1);
            assertThat(bang.get("rawScore").isNull()).as("mất một câu thì tổng mở lại").isTrue();
            assertThat(baiNop(bai).get("grading_status")).isEqualTo("SUBMITTED");
        }

        /**
         * Điểm câu trắc nghiệm chỉ có một chỗ quyết định: đáp án của đề. Cho nhập tay chồng lên
         * thì hai nguồn sự thật nằm cạnh nhau, và bấm "chấm lại cả lớp" sẽ xoá con số nhập tay
         * mà không ai được báo.
         */
        @Test
        @DisplayName("không nhập được điểm tay cho câu trắc nghiệm")
        void khongNhapTayCauTracNghiem() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Nhập tay trắc nghiệm", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            var phanHoi = goiThoi(giaoVien, "TEACHER", HttpMethod.PUT,
                    "/api/teacher/submissions/%d/grade-items".formatted(nop),
                    """
                            {"items":[{"problemId":%d,"score":3.33}]}
                            """.formatted(tracNghiem1));

            assertThat(phanHoi.trangThai).isEqualTo(400);
            assertThat(phanHoi.than).contains("máy chấm theo đáp án");
        }

        @Test
        @DisplayName("điểm vượt trần một câu bị chặn")
        void vuotTranThiChan() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Vượt trần", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            var phanHoi = goiThoi(giaoVien, "TEACHER", HttpMethod.PUT,
                    "/api/teacher/submissions/%d/grade-items".formatted(nop),
                    """
                            {"items":[{"problemId":%d,"score":9.00}]}
                            """.formatted(tuLuan1));

            assertThat(phanHoi.trangThai).isEqualTo(400);
            assertThat(phanHoi.than).contains("0 đến 3.33");
        }

        @Test
        @DisplayName("câu không thuộc phiếu này thì không chấm được")
        void cauLaThiKhongCham() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Câu lạ", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            var phanHoi = goiThoi(giaoVien, "TEACHER", HttpMethod.PUT,
                    "/api/teacher/submissions/%d/grade-items".formatted(nop),
                    """
                            {"items":[{"problemId":%d,"score":1.00}]}
                            """.formatted(tracNghiemB));

            assertThat(phanHoi.trangThai).isEqualTo(400);
            assertThat(phanHoi.than).contains("không thuộc phiếu đề này");
        }

        @Test
        @DisplayName("phiếu toàn trắc nghiệm không có gì để chấm tay")
        void phieuTracNghiemKhongChamTay() throws Exception {
            long bai = taoBaiGiao(phieuTracNghiem, "Chấm tay đề trắc nghiệm", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiemA, "A", tracNghiemB, "B"));
            long nop = idBaiNop(bai);

            var phanHoi = goiThoi(giaoVien, "TEACHER", HttpMethod.PUT,
                    "/api/teacher/submissions/%d/grade-items".formatted(nop),
                    """
                            {"items":[{"problemId":%d,"score":1.00}]}
                            """.formatted(tracNghiemA));

            assertThat(phanHoi.trangThai).isEqualTo(400);
            assertThat(phanHoi.than).contains("không có câu tự luận");
        }

        @Test
        @DisplayName("giáo viên lớp khác không chấm được")
        void giaoVienLopKhacKhongCham() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Giáo viên lạ", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            assertThat(goiThoi(giaoVienKhac, "TEACHER", HttpMethod.GET,
                    "/api/teacher/submissions/%d/items".formatted(nop), null).trangThai).isEqualTo(403);
            assertThat(goiThoi(giaoVienKhac, "TEACHER", HttpMethod.PUT,
                    "/api/teacher/submissions/%d/grade-items".formatted(nop),
                    """
                            {"items":[{"problemId":%d,"score":1.00}]}
                            """.formatted(tuLuan1)).trangThai).isEqualTo(403);
            assertThat(soDongDiemTungCau(nop)).as("không ghi được dòng nào").isZero();
        }

        /**
         * Trừ điểm nộp muộn là chính sách của bài, máy áp dụng — để cả lớp bị trừ như nhau chứ
         * không tuỳ người chấm có nhớ hay không. Đường chấm từng câu là đường mới, nên nó là chỗ
         * dễ quên áp dụng nhất.
         */
        @Test
        @DisplayName("nộp muộn bị trừ đúng phần trăm trên đường chấm từng câu")
        void nopMuonBiTruTrenDuongTungCau() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Nộp muộn", "2020-01-01T00:00:00", "PENALTY", 20);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);

            JsonNode bang = duLieu(chamHaiCau(nop, "3.33", "3.33"));

            assertThat(bang.get("submittedLate").asBoolean()).isTrue();
            assertThat(bang.get("rawScore").decimalValue()).as("điểm gốc giữ nguyên")
                    .isEqualByComparingTo("10.00");
            assertThat(bang.get("score").decimalValue()).as("trừ 20% nộp muộn")
                    .isEqualByComparingTo("8.00");
        }

        /**
         * Nộp lại là làm lại bài khác. Giữ điểm từng câu của lượt trước thì giáo viên mở ra sẽ
         * thấy những câu "đã chấm" ứng với một bài làm không còn tồn tại.
         */
        @Test
        @DisplayName("nộp lại xoá sạch điểm từng câu của lượt trước")
        void nopLaiXoaDiemLuotTruoc() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Nộp lại", null, "REJECT", 2);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);
            chamHaiCau(nop, "3.33", "3.33");
            assertThat(soDongDiemTungCau(nop)).isEqualTo(2);

            nop(bai, Map.of(tracNghiem1, "B", tuLuan1, "làm lại", tuLuan2, "làm lại"));

            assertThat(soDongDiemTungCau(nop)).as("điểm cũ không còn ứng với bài nào").isZero();
            Map<String, Object> row = baiNop(bai);
            assertThat(row.get("grading_status")).isEqualTo("SUBMITTED");
            assertThat(row.get("raw_score")).isNull();
        }
    }

    // ==================== 3. Học sinh xem kết quả ====================

    @Nested
    @DisplayName("Học sinh xem kết quả")
    class XemKetQua {

        @Test
        @DisplayName("chưa trả bài thì chưa thấy điểm và chưa thấy bảng chấm")
        void chuaTraThiChuaThay() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Chưa trả", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            chamHaiCau(idBaiNop(bai), "3.33", "3.33");

            JsonNode ketQua = duLieu(goi(hocSinh, "STUDENT", HttpMethod.GET,
                    "/api/assignment-progress/%d/result".formatted(bai), null));

            assertThat(ketQua.get("score").isNull()).isTrue();
            assertThat(ketQua.get("teacherFeedback").isNull()).isTrue();
            assertThat(ketQua.get("items")).as("bảng chấm cũng chưa được xem").isEmpty();
        }

        @Test
        @DisplayName("trả bài rồi thì thấy điểm và nhận xét từng câu")
        void traRoiThiThay() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Đã trả", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);
            chamHaiCau(nop, "3.33", "1.00");
            goi(giaoVien, "TEACHER", HttpMethod.PATCH, "/api/teacher/submissions/%d/return".formatted(nop), null);

            JsonNode ketQua = duLieu(goi(hocSinh, "STUDENT", HttpMethod.GET,
                    "/api/assignment-progress/%d/result".formatted(bai), null));

            assertThat(ketQua.get("gradingStatus").asText()).isEqualTo("RETURNED");
            assertThat(ketQua.get("score").decimalValue()).isEqualByComparingTo("7.67");
            assertThat(ketQua.get("items")).hasSize(3);
            JsonNode cau2 = ketQua.get("items").get(1);
            assertThat(cau2.get("essay").asBoolean()).isTrue();
            assertThat(cau2.get("score").decimalValue()).isEqualByComparingTo("3.33");
            assertThat(cau2.get("feedback").asText()).isEqualTo("Ổn");
            assertThat(cau2.get("maxScore").decimalValue()).isEqualByComparingTo("3.33");
        }

        /**
         * Đường trả kết quả cho học sinh không được mang theo đáp án đúng. Bài cho nộp nhiều lượt,
         * hoặc giao lệch giờ giữa các lớp, thì một em mở tab mạng của trình duyệt là cả khối có
         * đáp án — mà không có dấu vết nào cho thấy chuyện đó đã xảy ra.
         */
        @Test
        @DisplayName("đáp án của đề không đi theo bảng chấm về phía học sinh")
        void khongLoDapAn() throws Exception {
            long bai = taoBaiGiao(phieuTron, "Không lộ đáp án", null, "REJECT", 0);
            nop(bai, Map.of(tracNghiem1, "A", tuLuan1, "x = 1", tuLuan2, "x = 2"));
            long nop = idBaiNop(bai);
            chamHaiCau(nop, "3.33", "3.33");
            goi(giaoVien, "TEACHER", HttpMethod.PATCH, "/api/teacher/submissions/%d/return".formatted(nop), null);

            String than = goi(hocSinh, "STUDENT", HttpMethod.GET,
                    "/api/assignment-progress/%d/result".formatted(bai), null);
            JsonNode items = duLieu(than).get("items");

            assertThat(items).isNotEmpty();
            for (JsonNode cau : items) {
                assertThat(cau.get("correctOption").isNull())
                        .as("câu %s vẫn kèm đáp án", cau.get("orderNo")).isTrue();
                assertThat(cau.get("statement").isNull()).as("đề bài cũng không cần đi lại đường này").isTrue();
            }
            // Giáo viên thì ngược lại — phải thấy đáp án, nếu không thì không chấm được.
            JsonNode cuaGiaoVien = duLieu(goi(giaoVien, "TEACHER", HttpMethod.GET,
                    "/api/teacher/submissions/%d/items".formatted(nop), null));
            assertThat(cuaGiaoVien.get("items").get(0).get("correctOption").asText()).isEqualTo("A");
        }

        @Test
        @DisplayName("bài của em này không xem được kết quả của em khác")
        void khongXemBaiNguoiKhac() throws Exception {
            long hocSinhKhac = taoNguoiDung("STUDENT", "hs-tuluan-ngoai");
            long bai = taoBaiGiao(phieuTron, "Người ngoài lớp", null, "REJECT", 0);

            assertThat(goiThoi(hocSinhKhac, "STUDENT", HttpMethod.GET,
                    "/api/assignment-progress/%d/result".formatted(bai), null).trangThai).isEqualTo(403);
        }
    }

    // ==================== Hạ tầng ====================

    private record PhanHoi(int trangThai, String than) {}

    /** Lượt gọi phải thành công; trả về thân phản hồi để đọc tiếp. */
    private String goi(long nguoi, String vai, HttpMethod phuongThuc, String duongDan, String than) throws Exception {
        PhanHoi phanHoi = goiThoi(nguoi, vai, phuongThuc, duongDan, than);
        assertThat(phanHoi.trangThai()).as("%s %s → %s", phuongThuc, duongDan, phanHoi.than()).isEqualTo(200);
        return phanHoi.than();
    }

    /** Lượt gọi có thể hỏng; dùng cho những phép thử về chỗ bị chặn. */
    private PhanHoi goiThoi(long nguoi, String vai, HttpMethod phuongThuc, String duongDan, String than)
            throws Exception {
        MockHttpServletRequestBuilder yeuCau = request(phuongThuc, duongDan)
                .with(authentication(danhTinh(nguoi, vai)));
        if (than != null) yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content(than);
        else if (phuongThuc != HttpMethod.GET && phuongThuc != HttpMethod.DELETE) {
            yeuCau = yeuCau.contentType(MediaType.APPLICATION_JSON).content("{}");
        }
        var phanHoi = mockMvc.perform(yeuCau).andReturn().getResponse();
        return new PhanHoi(phanHoi.getStatus(), phanHoi.getContentAsString(StandardCharsets.UTF_8));
    }

    private JsonNode duLieu(String than) throws Exception {
        return json.readTree(than).get("data");
    }

    private Authentication danhTinh(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, nguoi + "@tuluan.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }

    /** Học sinh nộp bài; trả về khối kết quả của lượt nộp. */
    private JsonNode nop(long baiGiao, Map<Long, String> traLoi) throws Exception {
        StringBuilder than = new StringBuilder("{\"answers\":{");
        boolean dau = true;
        for (Map.Entry<Long, String> o : traLoi.entrySet()) {
            if (!dau) than.append(',');
            than.append('"').append(o.getKey()).append("\":\"").append(o.getValue()).append('"');
            dau = false;
        }
        than.append("}}");
        return duLieu(goi(hocSinh, "STUDENT", HttpMethod.POST,
                "/api/assignment-progress/%d/submit".formatted(baiGiao), than.toString()));
    }

    /** Chấm cả hai câu tự luận trong một lượt — bước dựng bối cảnh của nhiều phép thử. */
    private String chamHaiCau(long nop, String diem1, String diem2) throws Exception {
        return goi(giaoVien, "TEACHER", HttpMethod.PUT,
                "/api/teacher/submissions/%d/grade-items".formatted(nop),
                """
                        {"items":[{"problemId":%d,"score":%s,"feedback":"Ổn"},
                                  {"problemId":%d,"score":%s,"feedback":"Thiếu bước biện luận"}],
                         "feedback":"Nhận xét cả bài"}
                        """.formatted(tuLuan1, diem1, tuLuan2, diem2));
    }

    private Map<String, Object> baiNop(long baiGiao) {
        return jdbc.queryForMap("""
                select id, grading_status, score, raw_score, graded_at, correct_count, total_questions
                from assignment_progress where assignment_id=? and student_id=? and deleted_at is null
                """, baiGiao, hocSinh);
    }

    private long idBaiNop(long baiGiao) {
        return ((Number) baiNop(baiGiao).get("id")).longValue();
    }

    /** Điểm đọc từ CSDL về dạng chuỗi, để so sánh không phụ thuộc kiểu số của driver. */
    private String diem(Map<String, Object> row, String cot) {
        return row.get(cot) == null ? null : new java.math.BigDecimal(row.get(cot).toString())
                .setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private int soDongDiemTungCau(long nop) {
        Integer n = jdbc.queryForObject("select count(*) from submission_item_grades where progress_id=?",
                Integer.class, nop);
        return n == null ? 0 : n;
    }

    // ==================== Dựng dữ liệu ====================

    private long taoBaiGiao(long phieu, String ten, String hanNop, String chinhSachMuon, int soLuot)
            throws Exception {
        String than = """
                {"classId":%d,"worksheetId":%d,"title":"%s","status":"PUBLISHED","requirement":"BAT_BUOC",
                 "maxAttempts":%d,"latePolicy":"%s","latePenaltyPercent":20%s}
                """.formatted(lop, phieu, ten + " " + dem.incrementAndGet(), soLuot, chinhSachMuon,
                hanNop == null ? "" : ",\"dueAt\":\"" + hanNop + "\"");
        return duLieu(goi(giaoVien, "TEACHER", HttpMethod.POST, "/api/assignments", than)).get("id").asLong();
    }

    private long taoNguoiDung(String vai, String ten) {
        String duyNhat = ten + "-" + dem.incrementAndGet();
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, duyNhat + "@tuluan.test", ten, duyNhat, vai);
    }

    private long taoLop() {
        String ma = "TULUAN-" + dem.incrementAndGet();
        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        return jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values (?, ?, ?, 'ACTIVE', now(), now())
                returning id
                """, Long.class, ma, ma, khoi);
    }

    /**
     * Câu hỏi. {@code dapAn} null và bốn cột phương án để trống nghĩa là <b>câu tự luận</b> — đúng
     * hình dạng mà {@code McqGrading.laTracNghiem} phân loại, chứ không phải một cột "loại câu"
     * riêng: đề không có cột đó, nên phép thử phải đi qua đúng dữ liệu thật.
     */
    private long taoCauHoi(String dapAn) {
        int so = dem.incrementAndGet();
        Long loai = jdbc.queryForObject(
                "select id from problem_types where deleted_at is null order by id limit 1", Long.class);
        return jdbc.queryForObject("""
                insert into problems (problem_type_id, public_code, qr_slug, statement_latex, difficulty, status,
                                      correct_option, created_by, created_at, updated_at)
                values (?, ?, ?, ?, 'NHAN_BIET', 'PUBLISHED', ?, ?, now(), now())
                returning id
                """, Long.class, loai, "TULUAN-" + so, "tuluan" + so,
                dapAn == null ? "Giải phương trình và biện luận" : "Chọn nghiệm đúng", dapAn, giaoVien);
    }

    private long taoPhieu(long... cauHoi) {
        Long phieu = jdbc.queryForObject("""
                insert into worksheets (name, columns_count, show_qr, show_student_fields, created_by, created_at, updated_at)
                values (?, 1, true, true, ?, now(), now())
                returning id
                """, Long.class, "Phiếu tự luận " + dem.incrementAndGet(), giaoVien);
        for (int i = 0; i < cauHoi.length; i++) {
            jdbc.update("""
                    insert into worksheet_items (worksheet_id, problem_id, order_index, created_at, updated_at)
                    values (?, ?, ?, now(), now())
                    """, phieu, cauHoi[i], i + 1);
        }
        return phieu;
    }
}
