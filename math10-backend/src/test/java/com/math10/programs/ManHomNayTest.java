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
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.authentication;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

/**
 * Màn Hôm nay: chỗ lịch tuần của lớp gặp phân phối chương trình.
 *
 * <p>Trước lát này, "tuần này là tuần 12" và "tuần 12 học gì" là hai câu hỏi ở hai màn hình. Phép
 * thử của thiết kế do kế hoạch đặt ra rất cụ thể: <b>một ngày học bình thường, học sinh không cần
 * rời màn hình này</b>. Nên ca đầu tiên không kiểm cấu trúc JSON mà kiểm đúng điều đó — học liệu của
 * bài đang học phải nằm sẵn trong câu trả lời, gom chung một rổ, không phải chờ mở Thư viện.
 *
 * <p>Ba ranh giới đắt nhất nằm ở đây, không phải ở chỗ hiển thị. <b>Đang nghỉ</b> phải nói được nghỉ
 * vì gì, học lại ngày nào và tuần học lại học gì — nghỉ giữa hai tuần mà màn hình im lặng thì học
 * sinh đọc thành "hỏng rồi". <b>Rỗng phải nói được vì sao rỗng</b>: chưa vào lớp, chưa xếp lịch,
 * chưa khai giảng và đã hết năm là bốn lý do khác nhau ra cùng một màn trắng nếu không tách. <b>Tiết
 * chưa có bài</b> phải đếm ra thành một con số — trên dữ liệu thật cả 105 tiết đều chưa gắn bài, và
 * một màn "tuần 12" không có học liệu nào mà không giải thích là dữ liệu sai nhìn không ra.
 *
 * <p>Ba ca cuối canh chỗ màn mới có thể mở thêm cửa: học liệu chỉ-giáo-viên, học liệu của bài còn ẩn,
 * và khóa của người khác. Màn nào cũng phải hỏi lại đúng một luật đọc, nên chúng phải trả lời giống
 * hệt màn khóa học và cổng tệp.
 *
 * <p>Chạy trên PostgreSQL nhúng, không đụng vào dữ liệu thật.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Màn Hôm nay")
class ManHomNayTest {

    /** Thứ Tư của tuần 12. */
    private static final LocalDate TRONG_TUAN_12 = LocalDate.of(2026, 11, 11);
    private static final LocalDate TRONG_KY_NGHI = LocalDate.of(2026, 11, 18);
    private static final LocalDate TUAN_13_BAT_DAU = LocalDate.of(2026, 11, 23);
    private static final LocalDate TRUOC_KHAI_GIANG = LocalDate.of(2026, 10, 1);
    private static final LocalDate TUAN_10_BAT_DAU = LocalDate.of(2026, 10, 26);
    private static final LocalDate TRONG_NGHI_HE = LocalDate.of(2026, 12, 9);

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;

    private long chuongTrinh, khoa, khoaChuaXep, lop, lopChuaXep;
    private long em, emKhac, emNgoaiLop, co;
    private long baiDaiSo, baiHinh, baiAn, baiCu;
    private long tepCuaBaiAn;

    @BeforeAll
    void dungDuLieu() {
        co = nguoiDung("co@homnay.test", "co.hom.nay", "Cô hôm nay", "TEACHER");
        em = nguoiDung("em@homnay.test", "em.hom.nay", "Em hôm nay", "STUDENT");
        emKhac = nguoiDung("emkhac@homnay.test", "em.khac.hom.nay", "Em lớp khác", "STUDENT");
        emNgoaiLop = nguoiDung("ngoai@homnay.test", "em.ngoai.hom.nay", "Em chưa vào lớp", "STUDENT");

        chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-HOMNAY', 'Toan 10 hom nay', 'PUBLISHED', now(), now())
                returning id""", Long.class);

        long chuong0 = chuong("Chương mở đầu - Ôn tập đầu năm", 0, "PUBLISHED");
        long chuong1 = chuong("Chương 1 - Mệnh đề và tập hợp", 1, "PUBLISHED");
        long chuong2 = chuong("Chương 2 - Hàm số bậc hai", 2, "PUBLISHED");
        long baiMoDau = bai(chuong0, "Bài mở đầu - Ôn tập", 1, "PUBLISHED");
        baiCu = bai(chuong1, "Bài 1 - Mệnh đề", 1, "PUBLISHED");
        baiDaiSo = bai(chuong2, "Bài 5 - Đồ thị hàm số bậc hai", 1, "PUBLISHED");
        baiHinh = bai(chuong2, "Bài 6 - Định lí cosin", 2, "PUBLISHED");
        // Xuất bản theo cả chương trình: bài "chưa mở" là bài thuộc chương trình còn nháp,
        // còn trạng thái riêng của bài không còn làm cổng.
        long chuongTrinhNhap = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-HOMNAY-NHAP', 'Toan 10 ban nhap', 'DRAFT', now(), now())
                returning id""", Long.class);
        long chuongNhap = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương của chương trình nháp', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinhNhap);
        baiAn = bai(chuongNhap, "Bài 7 - Bài chưa mở", 3, "PUBLISHED");

        long daiSo = mach("DAI_SO", "Đại số", 1);
        long hinhHoc = mach("HINH_HOC", "Hình học", 2);
        long thongKe = mach("THONG_KE", "Thống kê", 3);
        // Mạch có thật trong chương trình nhưng tuần này không có tiết nào — hoạt động trải nghiệm
        // dồn vào cuối kỳ. Đây là mạch duy nhất kiểm được luật "mỗi mạch một dòng".
        long thucHanh = mach("THUC_HANH", "Thực hành và trải nghiệm", 4);

        tiet(daiSo, 10, 10, baiMoDau, "Ôn tập đầu năm");
        tiet(daiSo, 11, 11, baiCu, "Mệnh đề chứa biến");
        tiet(daiSo, 12, 12, baiDaiSo, "Đồ thị hàm số bậc hai");
        // Bài còn ẩn: tiết vẫn có thật trong phân phối, chỉ là học liệu chưa mở.
        tiet(daiSo, 13, 12, baiAn, "Luyện tập hàm số bậc hai");
        tiet(daiSo, 14, 13, baiDaiSo, "Ôn tập chương 2");
        tiet(daiSo, 15, 14, baiDaiSo, "Kiểm tra giữa kỳ");
        tiet(hinhHoc, 12, 12, baiHinh, "Định lí cosin");
        // Tiết ôn tập trỏ lại đúng bài mà mạch Đại số đang dạy trong cùng tuần.
        tiet(hinhHoc, 13, 12, baiDaiSo, "Ôn lại đồ thị để dựng hình");
        tiet(thongKe, 12, 12, null, "Bảng tần số ghép nhóm");
        tiet(thucHanh, 1, 14, baiDaiSo, "Dự án đo đạc sân trường");

        gan(baiDaiSo, "DOCUMENT", taiLieu("Phiếu tóm tắt hàm số bậc hai", tep("tom-tat.pdf")),
                "Phiếu tóm tắt hàm số bậc hai", 1, "PUBLISHED", "STUDENT_ALLOWED");
        gan(baiDaiSo, "DOCUMENT", taiLieu("Đáp án và barem chương 2", tep("dap-an.pdf")),
                "Đáp án và barem chương 2", 2, "PUBLISHED", "TEACHER_ONLY");
        gan(baiDaiSo, "VIDEO", video("Bài giảng đồ thị hàm số bậc hai", "PUBLISHED"),
                "Bài giảng đồ thị hàm số bậc hai", 3, "PUBLISHED", "STUDENT_ALLOWED");
        gan(baiDaiSo, "DOCUMENT", taiLieu("Bản nháp chưa xuất bản", tep("nhap.pdf")),
                "Bản nháp chưa xuất bản", 4, "DRAFT", "STUDENT_ALLOWED");
        gan(baiHinh, "DOCUMENT", taiLieu("Bảng công thức lượng giác", tep("cong-thuc.pdf")),
                "Bảng công thức lượng giác", 1, "PUBLISHED", "STUDENT_ALLOWED");
        tepCuaBaiAn = tep("bai-an.pdf");
        gan(baiAn, "DOCUMENT", taiLieu("Học liệu của bài còn ẩn", tepCuaBaiAn),
                "Học liệu của bài còn ẩn", 1, "PUBLISHED", "STUDENT_ALLOWED");

        long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu hôm nay', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        khoa = khoaHoc(mau, "Khóa hôm nay", "2026-2027-HN");
        khoaChuaXep = khoaHoc(mau, "Khóa chưa xếp lịch", "2026-2027-HN-CHUAXEP");
        lop = lop("HOMNAY-10A", "Lớp 10A hôm nay", khoa);
        lopChuaXep = lop("HOMNAY-10B", "Lớp 10B chưa xếp", khoaChuaXep);
        vaoLop(lop, em);
        vaoLop(lopChuaXep, em);
        vaoLop(lop(("HOMNAY-10C"), "Lớp 10C của em khác",
                khoaHoc(mau, "Khóa của em khác", "2026-2027-HN-KHAC")), emKhac);

        tuan(10, TUAN_10_BAT_DAU, null);
        tuan(11, LocalDate.of(2026, 11, 2), null);
        tuan(12, LocalDate.of(2026, 11, 9), null);
        tuan(null, LocalDate.of(2026, 11, 16), "Nghỉ giữa kỳ");
        tuan(13, TUAN_13_BAT_DAU, null);
        tuan(14, LocalDate.of(2026, 11, 30), null);
        tuan(null, LocalDate.of(2026, 12, 7), "Nghỉ hè");

        jdbc.update("""
                insert into user_last_position (user_id, route, updated_at)
                values (?, '/hoc/bai/5', now())""", em);
    }

    @Test @Order(1)
    @DisplayName("Ngày học bình thường: tuần, ba mạch và học liệu của tuần nằm sẵn trong một lần gọi")
    void motNgayHocBinhThuong() throws Exception {
        Map<String,Object> man = homNay(em, null, TRONG_TUAN_12);

        assertThat(man.get("trangThai")).isEqualTo("DANG_HOC");
        assertThat(tuan(man).get("soTuan")).isEqualTo(12);
        assertThat(man.get("tuanSeHoc")).as("đang trong tuần thì màn hình nói 'đang học'").isEqualTo(false);

        assertThat(ten(danhSach(man, "mach"), "ten"))
                .as("""
                    mạch không có tiết nào trong tuần vẫn phải là một dòng: rụng đi thì trông y hệt \
                    như chương trình chỉ có ba mạch, và không ai đi tìm thứ mình không biết là thiếu""")
                .containsExactly("Đại số", "Hình học", "Thống kê", "Thực hành và trải nghiệm");
        assertThat(danhSachTrong(danhSach(man, "mach").get(3), "tiet")).isEmpty();

        assertThat(ten(danhSach(man, "hocLieu"), "ten"))
                .as("""
                    đây là cả lát: tài liệu của bài đang học phải nằm sẵn ở đây, gom chung không tách \
                    theo loại tệp. Còn phải mở Thư viện mới lấy được thì lát này chưa xong""")
                .containsExactly("Phiếu tóm tắt hàm số bậc hai",
                        "Bài giảng đồ thị hàm số bậc hai",
                        "Bảng công thức lượng giác");
    }

    @Test @Order(2)
    @DisplayName("Học liệu gắn ở hai tiết trong cùng tuần chỉ hiện một lần")
    void motHocLieuMotDong() throws Exception {
        List<Map<String,Object>> hocLieu = danhSach(homNay(em, null, TRONG_TUAN_12), "hocLieu");

        assertThat(ten(hocLieu, "ten"))
                .as("""
                    tiết ôn tập của Hình học trỏ lại đúng bài Đại số đang dạy, nên cùng học liệu về \
                    hai lần; lọc trùng giữ bản đầu tiên theo mạch rồi tới tiết""")
                .doesNotHaveDuplicates();
        assertThat(hocLieu.stream().filter(h -> "VIDEO".equals(h.get("loai"))).map(h -> h.get("duongDan")))
                .as("nhãn loại là thứ duy nhất phân biệt video với PDF trong rổ chung, nên video phải có đường dẫn thật")
                .allMatch(d -> d != null && !d.toString().isBlank());
    }

    @Test @Order(3)
    @DisplayName("Tiết chưa có bài đọc được thì đếm ra thành con số, không im lặng bỏ qua")
    void tietChuaCoBaiPhaiDemDuoc() throws Exception {
        Map<String,Object> man = homNay(em, null, TRONG_TUAN_12);

        assertThat(man.get("soTietChuaCoBai"))
                .as("""
                    tiết Thống kê chưa gắn bài và tiết Đại số trỏ vào bài còn ẩn — hai lý do khác nhau, \
                    cùng một hậu quả: tuần có tiết mà không có học liệu. Trên dữ liệu thật cả 105 tiết \
                    đều chưa gắn bài, nên màn hình phải nói ra con số chứ không hiện màn trắng""")
                .isEqualTo(2);

        Map<String,Object> thongKe = danhSach(man, "mach").stream()
                .filter(m -> "THONG_KE".equals(m.get("ma"))).findFirst().orElseThrow();
        assertThat(danhSachTrong(thongKe, "tiet")).hasSize(1);
        assertThat(danhSachTrong(thongKe, "tiet").get(0).get("tenBai"))
                .as("tiết vẫn hiện với tên trong phân phối chương trình; chỉ tên bài là rỗng")
                .isNull();
        assertThat(danhSachTrong(thongKe, "tiet").get(0).get("ten")).isEqualTo("Bảng tần số ghép nhóm");
    }

    @Test @Order(4)
    @DisplayName("Đang nghỉ: nói đúng là đang nghỉ, kèm ngày học lại và chương sẽ học")
    void dangNghiThiNoiDungLaDangNghi() throws Exception {
        Map<String,Object> man = homNay(em, null, TRONG_KY_NGHI);

        assertThat(man.get("trangThai")).isEqualTo("DANG_NGHI");
        assertThat(man.get("nhanNghi")).as("nghỉ vì gì là nửa đầu của câu trả lời").isEqualTo("Nghỉ giữa kỳ");
        assertThat(man.get("ngayHocLai")).isEqualTo(TUAN_13_BAT_DAU.toString());
        assertThat(man.get("tuanSeHoc"))
                .as("cùng một khối dữ liệu, hai cách chia động từ; để màn hình tự suy thì mỗi màn suy một kiểu")
                .isEqualTo(true);
        assertThat(tuan(man).get("soTuan"))
                .as("tuần đang hiện là tuần học lại, không phải dòng nghỉ đang phủ lên hôm nay")
                .isEqualTo(13);
        assertThat(ten(danhSach(man, "hocLieu"), "ten"))
                .as("'chương sẽ học' phải là nội dung thật của tuần 13, không phải một dòng chữ suông")
                .containsExactly("Phiếu tóm tắt hàm số bậc hai", "Bài giảng đồ thị hàm số bậc hai");
    }

    @Test @Order(5)
    @DisplayName("Nghỉ mà phía sau không còn tuần học nào thì là đã kết thúc, không phải nghỉ giữa kỳ")
    void nghiCuoiCungLaDaKetThuc() throws Exception {
        assertThat(homNay(em, null, TRONG_NGHI_HE).get("trangThai"))
                .as("""
                    nghỉ hè và nghỉ Tết là cùng một dòng trong bảng; phân biệt nằm ở chỗ phía sau có \
                    tuần học nào không, và nói 'sắp học lại' vào tháng sáu là nói dối""")
                .isEqualTo("DA_KET_THUC");
    }

    @Test @Order(6)
    @DisplayName("Bốn màn rỗng nói được bốn lý do khác nhau")
    void manRongPhaiNoiDuocViSaoRong() throws Exception {
        assertThat(homNay(emNgoaiLop, null, TRONG_TUAN_12).get("trangThai"))
                .as("chưa thuộc lớp nào thì không phải lỗi, và cũng không phải 'chưa khai giảng'")
                .isEqualTo("CHUA_VAO_LOP");
        assertThat(homNay(em, khoaChuaXep, TRONG_TUAN_12).get("trangThai"))
                .as("khóa có học sinh mà chưa ai bấm sinh lịch — lý do nằm ở phía quản trị, không ở học sinh")
                .isEqualTo("CHUA_CO_LICH");
        assertThat(homNay(em, khoa, TRUOC_KHAI_GIANG).get("trangThai")).isEqualTo("CHUA_KHAI_GIANG");
        assertThat(homNay(em, khoa, LocalDate.of(2027, 1, 15)).get("trangThai")).isEqualTo("DA_KET_THUC");

        Map<String,Object> truoc = homNay(em, khoa, TRUOC_KHAI_GIANG);
        assertThat(tuan(truoc).get("soTuan"))
                .as("chưa khai giảng vẫn hiện được tuần đầu, vì câu hỏi lúc ấy là 'bao giờ bắt đầu, học gì'")
                .isEqualTo(10);
        assertThat(truoc.get("ngayHocLai")).isEqualTo(TUAN_10_BAT_DAU.toString());
    }

    @Test @Order(7)
    @DisplayName("Sắp tới hiện đúng hai dòng kế, kể cả khi dòng kế là tuần nghỉ")
    void sapToiGiuNguyenDongNghi() throws Exception {
        List<Map<String,Object>> sapToi = danhSach(homNay(em, null, TRONG_TUAN_12), "sapToi");

        assertThat(sapToi).hasSize(2);
        assertThat(sapToi.get(0).get("nghi"))
                .as("""
                    nhảy qua tuần nghỉ để khoe tuần học phía sau là nói với học sinh rằng tuần sau vẫn đi học""")
                .isEqualTo(true);
        assertThat(sapToi.get(0).get("nhanNghi")).isEqualTo("Nghỉ giữa kỳ");
        assertThat(sapToi.get(1).get("soTuan")).isEqualTo(13);
        assertThat(ten(danhSachTrong(sapToi.get(1), "tenBai"), null))
                .as("thu gọn vẫn phải nói được tuần ấy học gì")
                .containsExactly("Ôn tập chương 2");
    }

    @Test @Order(8)
    @DisplayName("Đã học gom theo chương và xếp ngược, chương gần nhất đứng trước")
    void daHocXepNguoc() throws Exception {
        List<Map<String,Object>> daHoc = danhSach(homNay(em, null, TRONG_TUAN_12), "daHoc");

        assertThat(ten(daHoc, "ten"))
                .as("mở lại phần đã qua gần như luôn là để tìm chương tuần trước, không phải chương đầu năm")
                .containsExactly("Chương 1 - Mệnh đề và tập hợp", "Chương mở đầu - Ôn tập đầu năm");
        assertThat(daHoc.get(0).get("tuanCuoi")).isEqualTo(11);
        assertThat(daHoc.get(0).get("soTiet")).isEqualTo(1);
    }

    @Test @Order(9)
    @DisplayName("Việc cần làm bỏ bài đã nộp và bài còn nháp; điểm chỉ hiện khi đã tới lượt trả")
    void viecVaDiem() throws Exception {
        long dangMo = baiGiao("Phiếu hàm số bậc hai", "PUBLISHED", -1, 3, null);
        long conNhap = baiGiao("Bài giáo viên đang soạn", "DRAFT", -1, 3, null);
        long daNop = baiGiao("Bài đã nộp rồi", "PUBLISHED", -1, 3, null);
        long daTra = baiGiao("Bài đã trả điểm", "PUBLISHED", -9, -2, null);
        long chuaToiGioTra = baiGiao("Bài chấm xong nhưng chưa tới giờ công bố", "PUBLISHED", -9, -2,
                LocalDate.now().plusDays(3));
        tienDo(daNop, "submitted_at=now()");
        tienDo(daTra, "submitted_at=now(), graded_at=now(), returned_at=now(), score=8.5, max_score=10");
        tienDo(chuaToiGioTra, "submitted_at=now(), graded_at=now(), score=9.0, max_score=10");

        Map<String,Object> man = homNay(em, null, TRONG_TUAN_12);
        List<Object> idViec = danhSach(man, "viec").stream().map(v -> so(v.get("id"))).map(Object.class::cast).toList();
        List<Object> idDiem = danhSach(man, "diem").stream().map(d -> so(d.get("id"))).map(Object.class::cast).toList();

        assertThat(idViec).contains(dangMo);
        assertThat(idViec).as("bài đang soạn thì học sinh không được biết là nó tồn tại").doesNotContain(conNhap);
        assertThat(idViec).as("nộp rồi thì không còn là việc phải làm, dù cửa vẫn mở").doesNotContain(daNop);
        assertThat(idDiem).contains(daTra);
        assertThat(idDiem)
                .as("""
                    chấm xong chưa phải là trả: publish_score_at có một nhánh mà câu SQL nào viết lại \
                    cũng quên, và quên thì điểm hiện sớm chứ không báo lỗi""")
                .doesNotContain(chuaToiGioTra);
        assertThat(((Map<?,?>) man.get("hocTiep")).get("duongDan")).isEqualTo("/hoc/bai/5");
    }

    @Test @Order(10)
    @DisplayName("Học liệu chỉ-giáo-viên và học liệu của bài còn ẩn đều không lọt sang màn học sinh")
    void manMoiKhongMoThemCua() throws Exception {
        assertThat(ten(danhSach(homNay(em, null, TRONG_TUAN_12), "hocLieu"), "ten"))
                .as("màn mới đọc lại đúng luật cũ, không viết luật riêng")
                .doesNotContain("Đáp án và barem chương 2", "Học liệu của bài còn ẩn", "Bản nháp chưa xuất bản");

        assertThat(mockMvc.perform(get("/api/files/{id}", tepCuaBaiAn).with(authentication(ai(em, "STUDENT"))))
                        .andReturn().getResponse().getStatus())
                .as("""
                    giấu học liệu khỏi danh sách mà cổng tệp vẫn phát cho ai đoán trúng số hiệu thì \
                    việc giấu chẳng có nghĩa gì""")
                .isEqualTo(403);
    }

    @Test @Order(11)
    @DisplayName("Khóa của người khác thì không tồn tại, và giáo viên không có màn này")
    void khoaCuaNguoiKhac() throws Exception {
        long khoaCuaEmKhac = jdbc.queryForObject("""
                select cc.course_instance_id from class_courses cc
                join class_students cs on cs.class_id=cc.class_id
                where cs.student_id=?""", Long.class, emKhac);

        assertThat(goi(em, khoaCuaEmKhac, TRONG_TUAN_12).getStatus())
                .as("trả 403 là đã xác nhận khóa ấy có thật; không tìm thấy mới là câu trả lời đúng")
                .isEqualTo(404);
        assertThat(mockMvc.perform(get("/api/student/hom-nay").with(authentication(ai(co, "TEACHER"))))
                        .andReturn().getResponse().getStatus())
                .isEqualTo(403);
    }

    // ==================== gọi và đọc ====================

    private Map<String,Object> homNay(long ai, Long khoaId, LocalDate ngay) throws Exception {
        var phanHoi = goi(ai, khoaId, ngay);
        String than = phanHoi.getContentAsString(StandardCharsets.UTF_8);
        assertThat(phanHoi.getStatus()).as("GET /api/student/hom-nay → %s", than).isEqualTo(200);
        //noinspection unchecked
        return (Map<String,Object>) json.readValue(than, Map.class).get("data");
    }

    private org.springframework.mock.web.MockHttpServletResponse goi(long ai, Long khoaId, LocalDate ngay)
            throws Exception {
        var yc = get("/api/student/hom-nay").with(authentication(ai(ai, "STUDENT")));
        if (khoaId != null) yc = yc.param("khoaId", String.valueOf(khoaId));
        if (ngay != null) yc = yc.param("ngay", ngay.toString());
        return mockMvc.perform(yc).andReturn().getResponse();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> danhSach(Map<String,Object> man, String khoa) {
        return (List<Map<String,Object>>) man.get(khoa);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> danhSachTrong(Map<?,?> nut, String khoa) {
        return (List<Map<String,Object>>) nut.get(khoa);
    }

    private Map<?,?> tuan(Map<String,Object> man) { return (Map<?,?>) man.get("tuan"); }

    /** {@code cot} rỗng nghĩa là danh sách vốn đã là chuỗi. */
    private List<String> ten(List<?> dong, String cot) {
        return dong.stream().map(d -> cot == null ? (String) d : (String) ((Map<?,?>) d).get(cot)).toList();
    }

    private long so(Object value) { return ((Number) value).longValue(); }

    // ==================== dựng dữ liệu ====================

    private long chuong(String ten, int thuTu, String trangThai) {
        return jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, ?, ?, ?::varchar, now(), now())
                returning id""", Long.class, chuongTrinh, ten, thuTu, trangThai);
    }

    private long bai(long chuong, String ten, int thuTu, String trangThai) {
        return jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, ?, ?, ?::varchar, now(), now())
                returning id""", Long.class, chuong, ten, thuTu, trangThai);
    }

    private long mach(String ma, String ten, int thuTu) {
        return jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, ?, ?, ?, now(), now())
                returning id""", Long.class, chuongTrinh, ma, ten, thuTu);
    }

    private void tiet(long mach, int soTiet, int soTuan, Long bai, String ten) {
        jdbc.update("""
                insert into program_periods
                    (strand_id, period_no, week_no, term, lesson_id, title, period_kind, created_at, updated_at)
                values (?, ?, ?, 1, ?, ?, 'BAI_MOI', now(), now())""",
                mach, soTiet, soTuan, bai, ten);
    }

    private long tep(String ten) {
        return jdbc.queryForObject("""
                insert into file_assets (file_name, file_url, mime_type, file_size, created_at, updated_at)
                values (?, ?, 'application/pdf', 2048, now(), now())
                returning id""", Long.class, ten, "https://vi-du.test/homnay/" + ten);
    }

    private long taiLieu(String ten, long tep) {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, file_asset_id, status, created_at, updated_at)
                values (?, 'KHBD', 'STUDENT_ALLOWED', '', ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, ten, tep);
    }

    private long video(String ten, String trangThai) {
        return jdbc.queryForObject("""
                insert into videos (title, program_id, video_url, status, created_at, updated_at)
                values (?, ?, 'https://vi-du.test/homnay/bai-giang.mp4', ?::varchar, now(), now())
                returning id""", Long.class, ten, chuongTrinh, trangThai);
    }

    private void gan(long bai, String loai, long nguon, String ten, int thuTu, String trangThai, String doiTuong) {
        jdbc.update("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience, created_at, updated_at)
                values (?, ?::varchar, ?, ?, ?, ?::varchar, ?::varchar, now(), now())""",
                bai, loai, nguon, ten, thuTu, trangThai, doiTuong);
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

    private void tuan(Integer soTuan, LocalDate batDau, String nhanNghi) {
        jdbc.update("""
                insert into course_weeks
                    (course_instance_id, week_no, starts_on, ends_on, is_break, break_label, edited_by_hand,
                     created_at, updated_at)
                values (?, ?, ?, ?, ?, ?, false, now(), now())""",
                khoa, soTuan, java.sql.Date.valueOf(batDau), java.sql.Date.valueOf(batDau.plusDays(6)),
                soTuan == null, nhanNghi);
    }

    private long baiGiao(String ten, String trangThai, int moTruoc, int hanSau, LocalDate congBoDiem) {
        return jdbc.queryForObject("""
                insert into assignments
                    (class_id, lesson_id, title, status, open_at, due_at, publish_score_at, created_by,
                     created_at, updated_at)
                values (?, ?, ?, ?::varchar, now() + (? || ' days')::interval, now() + (? || ' days')::interval,
                        ?, ?, now(), now())
                returning id""", Long.class, lop, baiDaiSo, ten, trangThai,
                String.valueOf(moTruoc), String.valueOf(hanSau),
                congBoDiem == null ? null : java.sql.Timestamp.valueOf(congBoDiem.atStartOfDay()), co);
    }

    private void tienDo(long baiGiao, String dat) {
        jdbc.update("insert into assignment_progress (assignment_id, student_id, created_at, updated_at)"
                + " values (?,?,now(),now())", baiGiao, em);
        jdbc.update("update assignment_progress set " + dat + " where assignment_id=? and student_id=?", baiGiao, em);
    }

    private long nguoiDung(String thu, String tenTaiKhoan, String hoTen, String vai) {
        return jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'khong-dung-toi', ?, ?, ?::varchar, 'ACTIVE', now(), now())
                returning id""", Long.class, thu, hoTen, tenTaiKhoan, vai);
    }

    private Authentication ai(long nguoi, String vai) {
        Math10Principal principal = new Math10Principal(nguoi, "nguoi-" + nguoi + "@homnay.test", vai);
        return new UsernamePasswordAuthenticationToken(
                principal, null, List.of(new SimpleGrantedAuthority("ROLE_" + vai)));
    }
}
