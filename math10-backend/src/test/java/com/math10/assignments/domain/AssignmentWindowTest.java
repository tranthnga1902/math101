package com.math10.assignments.domain;

import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentProgress;
import com.math10.assignments.entity.AssignmentState;
import com.math10.assignments.entity.LatePolicy;
import com.math10.common.exception.BusinessException;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Luật vòng đời bài giao.
 *
 * <p>Trước lát này {@code due_at} chỉ là chữ hiển thị trên màn hình: không chỗ nào trên server
 * kiểm hạn, nộp lại bao nhiêu lần cũng được, và bài giáo viên đang soạn vẫn nằm trong danh sách
 * của học sinh kèm nguyên đề. Mỗi ca dưới đây khoá lại một trong những điều đó.
 *
 * <p>Thời gian được truyền vào chứ không đọc {@code LocalDateTime.now()}, nên "quá hạn" hay
 * "chưa mở" kiểm được thật, không phải chờ đồng hồ.
 *
 * <p>Hai nhóm cuối ghim hai nhánh mới và cả hai đều là nhánh <em>mở nhầm</em>: bài neo vào buổi mà
 * lớp chưa chốt phải kín, và đáp án chỉ hé đúng mức giáo viên chọn. Sai theo chiều này thì không có
 * lỗi nào bật ra — chỉ là học sinh thấy thứ chưa được thấy.
 */
class AssignmentWindowTest {

    private static final LocalDateTime BAY_GIO = LocalDateTime.of(2026, 8, 27, 10, 0);
    private static final LocalDateTime TRUOC_MOT_GIO = BAY_GIO.minusHours(1);
    private static final LocalDateTime SAU_MOT_GIO = BAY_GIO.plusHours(1);

    // --- Trạng thái ----------------------------------------------------------

    @Test
    void baiDangSoanThiHocSinhKhongThayGiCa() {
        Assignment bai = bai("DRAFT", null, null);

        assertThat(AssignmentWindow.stateOf(bai, BAY_GIO)).isEqualTo(AssignmentState.DRAFT);
        assertThat(AssignmentState.DRAFT.visibleToStudent()).isFalse();
    }

    @Test
    void khongDatGioThiMoNgay() {
        assertThat(AssignmentWindow.stateOf(bai("PUBLISHED", null, null), BAY_GIO))
                .isEqualTo(AssignmentState.OPEN);
    }

    @Test
    void chuaToiGioMoThiThayTenNhungKhongThayDe() {
        Assignment bai = bai("PUBLISHED", SAU_MOT_GIO, SAU_MOT_GIO.plusDays(1));

        AssignmentState trangThai = AssignmentWindow.stateOf(bai, BAY_GIO);

        assertThat(trangThai).isEqualTo(AssignmentState.SCHEDULED);
        assertThat(trangThai.visibleToStudent()).isTrue();
        assertThat(trangThai.contentVisibleToStudent()).isFalse();
    }

    @Test
    void quaHanMaKhongNhanMuonThiDong() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setLatePolicy(LatePolicy.REJECT.name());

        assertThat(AssignmentWindow.stateOf(bai, BAY_GIO)).isEqualTo(AssignmentState.CLOSED);
    }

    @Test
    void quaHanMaChinhSachChoNopMuonThiVanMo() {
        Assignment nhan = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        nhan.setLatePolicy(LatePolicy.ACCEPT.name());
        Assignment truDiem = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        truDiem.setLatePolicy(LatePolicy.PENALTY.name());

        assertThat(AssignmentWindow.stateOf(nhan, BAY_GIO)).isEqualTo(AssignmentState.LATE_OPEN);
        assertThat(AssignmentWindow.stateOf(truDiem, BAY_GIO)).isEqualTo(AssignmentState.LATE_OPEN);
    }

    @Test
    void giaoVienDongBaiThiDongDuVanTrongHan() {
        assertThat(AssignmentWindow.stateOf(bai("COMPLETED", null, SAU_MOT_GIO), BAY_GIO))
                .isEqualTo(AssignmentState.CLOSED);
        // Trạng thái lạ cũng phải coi là đóng — thà chặn nhầm còn hơn mở nhầm.
        assertThat(AssignmentWindow.stateOf(bai("ARCHIVED", null, SAU_MOT_GIO), BAY_GIO))
                .isEqualTo(AssignmentState.CLOSED);
    }

    @Test
    void dungGiayHanNopVanConDuocTinhLaTrongHan() {
        Assignment bai = bai("PUBLISHED", BAY_GIO, BAY_GIO);

        assertThat(AssignmentWindow.stateOf(bai, BAY_GIO)).isEqualTo(AssignmentState.OPEN);
        assertThat(AssignmentWindow.isLate(bai, BAY_GIO)).isFalse();
        assertThat(AssignmentWindow.isLate(bai, BAY_GIO.plusSeconds(1))).isTrue();
    }

    @Test
    void baiDaDongVanXemLaiDuocDe() {
        // Đóng rồi vẫn phải xem lại được bài mình đã làm, nếu không thì chữa bài kiểu gì.
        assertThat(AssignmentState.CLOSED.contentVisibleToStudent()).isTrue();
        assertThat(AssignmentState.CLOSED.acceptsSubmission()).isFalse();
    }

    // --- Cửa nộp bài ---------------------------------------------------------

    @Test
    void chuaToiGioMoThiKhongNopDuoc() {
        Assignment bai = bai("PUBLISHED", SAU_MOT_GIO, SAU_MOT_GIO.plusDays(1));

        assertThatThrownBy(() -> AssignmentWindow.requireSubmittable(bai, moi(), BAY_GIO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("chưa tới giờ mở");
    }

    @Test
    void quaHanThiKhongNopDuocVaBaoDungLyDo() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);

        assertThatThrownBy(() -> AssignmentWindow.requireSubmittable(bai, moi(), BAY_GIO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("quá hạn");
    }

    @Test
    void hetLuotThiKhongNopDuocNua() {
        Assignment bai = bai("PUBLISHED", null, SAU_MOT_GIO);
        bai.setMaxAttempts(2);
        AssignmentProgress daNopHaiLan = moi();
        daNopHaiLan.setAttemptNo(2);

        assertThat(AssignmentWindow.attemptsLeft(bai, daNopHaiLan)).isZero();
        assertThatThrownBy(() -> AssignmentWindow.requireSubmittable(bai, daNopHaiLan, BAY_GIO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("hết 2 lượt");
    }

    @Test
    void conLuotThiVanNopDuoc() {
        Assignment bai = bai("PUBLISHED", null, SAU_MOT_GIO);
        bai.setMaxAttempts(3);
        AssignmentProgress daNopMotLan = moi();
        daNopMotLan.setAttemptNo(1);

        assertThat(AssignmentWindow.attemptsLeft(bai, daNopMotLan)).isEqualTo(2);
        assertThatCode(() -> AssignmentWindow.requireSubmittable(bai, daNopMotLan, BAY_GIO))
                .doesNotThrowAnyException();
    }

    @Test
    void khongGioiHanLuotThiNopBaoNhieuLanCungDuoc() {
        Assignment bai = bai("PUBLISHED", null, SAU_MOT_GIO);
        bai.setMaxAttempts(0);
        AssignmentProgress daNopNhieu = moi();
        daNopNhieu.setAttemptNo(99);

        assertThat(AssignmentWindow.attemptsLeft(bai, daNopNhieu)).isNull();
        assertThatCode(() -> AssignmentWindow.requireSubmittable(bai, daNopNhieu, BAY_GIO))
                .doesNotThrowAnyException();
    }

    @Test
    void traDiemRoiThiKhongNopLaiDuoc() {
        Assignment bai = bai("PUBLISHED", null, SAU_MOT_GIO);
        bai.setMaxAttempts(0);
        AssignmentProgress daTra = moi();
        daTra.setReturnedAt(TRUOC_MOT_GIO);

        assertThatThrownBy(() -> AssignmentWindow.requireSubmittable(bai, daTra, BAY_GIO))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Điểm đã được trả");
    }

    @Test
    void quaHanNhungChinhSachChoNopMuonThiVanNopDuoc() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setLatePolicy(LatePolicy.ACCEPT.name());

        assertThatCode(() -> AssignmentWindow.requireSubmittable(bai, moi(), BAY_GIO))
                .doesNotThrowAnyException();
    }

    // --- Trừ điểm nộp muộn ---------------------------------------------------

    @Test
    void nopDungHanThiKhongBiTru() {
        Assignment bai = bai("PUBLISHED", null, SAU_MOT_GIO);
        bai.setLatePolicy(LatePolicy.PENALTY.name());
        bai.setLatePenaltyPercent(20);

        assertThat(AssignmentWindow.applyLatePenalty(bai, diem("8.00"), false)).isEqualTo(diem("8.00"));
    }

    @Test
    void chinhSachNhanMuonThiKhongTruDiem() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setLatePolicy(LatePolicy.ACCEPT.name());
        bai.setLatePenaltyPercent(20);

        assertThat(AssignmentWindow.applyLatePenalty(bai, diem("8.00"), true)).isEqualTo(diem("8.00"));
    }

    @Test
    void nopMuonVoiChinhSachTruThiTruDungPhanTram() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setLatePolicy(LatePolicy.PENALTY.name());
        bai.setLatePenaltyPercent(20);

        assertThat(AssignmentWindow.applyLatePenalty(bai, diem("8.00"), true)).isEqualTo(diem("6.40"));
    }

    @Test
    void chamLaiNhieuLanKhongTruChongLenNhau() {
        // Đây là lý do raw_score được lưu riêng: trừ luôn tính từ điểm gốc, không tính từ điểm
        // đã trừ lần trước. Nếu không, mỗi lần bấm "chấm lại" là điểm học sinh tụt thêm một nấc.
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setLatePolicy(LatePolicy.PENALTY.name());
        bai.setLatePenaltyPercent(20);
        BigDecimal diemGoc = diem("8.00");

        BigDecimal lanDau = AssignmentWindow.applyLatePenalty(bai, diemGoc, true);
        BigDecimal lanHai = AssignmentWindow.applyLatePenalty(bai, diemGoc, true);

        assertThat(lanHai).isEqualTo(lanDau).isEqualTo(diem("6.40"));
    }

    @Test
    void truTramPhanTramThiVeKhongChuKhongAmVaKhongLoiChia() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setLatePolicy(LatePolicy.PENALTY.name());
        bai.setLatePenaltyPercent(100);

        assertThat(AssignmentWindow.applyLatePenalty(bai, diem("8.00"), true)).isEqualByComparingTo("0");
    }

    @Test
    void chuaChamThiKhongCoGiDeTru() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setLatePolicy(LatePolicy.PENALTY.name());
        bai.setLatePenaltyPercent(20);

        assertThat(AssignmentWindow.applyLatePenalty(bai, null, true)).isNull();
    }

    // --- Công bố điểm --------------------------------------------------------

    @Test
    void chamXongNhungChuaTraThiHocSinhChuaThayDiem() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        AssignmentProgress daCham = moi();
        daCham.setGradedAt(TRUOC_MOT_GIO);

        assertThat(AssignmentWindow.scoreVisible(bai, daCham, BAY_GIO)).isFalse();
    }

    @Test
    void giaoVienTraBaiThiThayDiemNgay() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        AssignmentProgress daTra = moi();
        daTra.setGradedAt(TRUOC_MOT_GIO);
        daTra.setReturnedAt(TRUOC_MOT_GIO);

        assertThat(AssignmentWindow.scoreVisible(bai, daTra, BAY_GIO)).isTrue();
    }

    @Test
    void toiGioCongBoThiDiemTuHienKhongCanBamTraTungBai() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setPublishScoreAt(TRUOC_MOT_GIO);
        AssignmentProgress daCham = moi();
        daCham.setGradedAt(TRUOC_MOT_GIO);

        assertThat(AssignmentWindow.scoreVisible(bai, daCham, BAY_GIO)).isTrue();
    }

    @Test
    void chuaToiGioCongBoThiVanChuaThayDiem() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setPublishScoreAt(SAU_MOT_GIO);
        AssignmentProgress daCham = moi();
        daCham.setGradedAt(TRUOC_MOT_GIO);

        assertThat(AssignmentWindow.scoreVisible(bai, daCham, BAY_GIO)).isFalse();
    }

    @Test
    void toiGioCongBoNhungChuaChamThiChangCoDiemNaoDeHien() {
        Assignment bai = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        bai.setPublishScoreAt(TRUOC_MOT_GIO);

        assertThat(AssignmentWindow.scoreVisible(bai, moi(), BAY_GIO)).isFalse();
    }

    // --- Neo vào buổi --------------------------------------------------------

    @Test
    void baiNeoBuoiMaLopChuaChotThiVanKin() {
        // Ranh giới dễ vỡ nhất của lát này: theo javadoc của Assignment.openAt thì open_at rỗng
        // nghĩa là "mở ngay". Bài neo buổi cũng để open_at rỗng cho tới lúc lớp chốt buổi, nên
        // thiếu nhánh neo là mọi bài neo hở ra ngay khi giáo viên bấm phát hành.
        Assignment bai = bai("PUBLISHED", null, null);
        bai.setAnchorPeriodId(7L);

        assertThat(AssignmentWindow.waitingForAnchor(bai))
                .as("có tiết neo mà chưa có giờ mở nghĩa là đang chờ lớp chốt buổi")
                .isTrue();
        assertThat(AssignmentWindow.stateOf(bai, BAY_GIO)).isEqualTo(AssignmentState.SCHEDULED);
        assertThat(AssignmentState.SCHEDULED.contentVisibleToStudent())
                .as("chờ chốt buổi thì thấy tên bài chứ không thấy đề")
                .isFalse();
    }

    @Test
    void chuaChotBuoiThiKhongNopDuocVaLyDoNoiDungChuyenPhaiCho() {
        Assignment bai = bai("PUBLISHED", null, null);
        bai.setAnchorPeriodId(7L);

        assertThatThrownBy(() -> AssignmentWindow.requireSubmittable(bai, moi(), BAY_GIO))
                .isInstanceOf(BusinessException.class)
                .as("""
                        Chờ buổi khác hẳn chờ đồng hồ: câu "chưa tới giờ mở (null)" vừa vô nghĩa vừa
                        khiến học sinh đi hỏi giáo viên xem mấy giờ, trong khi thứ đang thiếu là buổi học.""")
                .hasMessageContaining("sau khi lớp hoàn thành buổi học");
    }

    @Test
    void chotBuoiXongThiBaiNeoMoNhuMoiBaiKhac() {
        // Chốt buổi vật hóa open_at; từ đó trở đi bài neo không còn gì đặc biệt.
        Assignment bai = bai("PUBLISHED", TRUOC_MOT_GIO, SAU_MOT_GIO);
        bai.setAnchorPeriodId(7L);

        assertThat(AssignmentWindow.waitingForAnchor(bai)).isFalse();
        assertThat(AssignmentWindow.stateOf(bai, BAY_GIO)).isEqualTo(AssignmentState.OPEN);
        assertThatCode(() -> AssignmentWindow.requireSubmittable(bai, moi(), BAY_GIO))
                .doesNotThrowAnyException();
    }

    @Test
    void baiKhongNeoVanGiuNguyenNghiaCuCuaGioMoRong() {
        // Nhánh neo không được lấn sang bài thường: giáo viên giao tay không đặt giờ mở thì vẫn là
        // "mở ngay", đúng như trước lát này.
        Assignment bai = bai("PUBLISHED", null, null);

        assertThat(AssignmentWindow.waitingForAnchor(bai)).isFalse();
        assertThat(AssignmentWindow.stateOf(bai, BAY_GIO)).isEqualTo(AssignmentState.OPEN);
    }

    @Test
    void baiNeoConLaBanNhapThiVanLaBanNhap() {
        // Thứ tự hai nhánh có thật: nháp phải thắng chờ-buổi, nếu không bài đang soạn hiện ra ở
        // danh sách học sinh dưới dạng "sắp mở".
        Assignment bai = bai("DRAFT", null, null);
        bai.setAnchorPeriodId(7L);

        assertThat(AssignmentWindow.stateOf(bai, BAY_GIO)).isEqualTo(AssignmentState.DRAFT);
    }

    // --- Ba mức công bố đáp án -----------------------------------------------

    @Test
    void mucIMMEDIATEThiLamXongThayNgay() {
        Assignment bai = bai("PUBLISHED", null, SAU_MOT_GIO);
        bai.setAnswerReveal("IMMEDIATE");

        assertThat(AssignmentWindow.scoreVisible(bai, moi(), BAY_GIO))
                .as("luyện tự do thì tự chấm ngay là điểm mấu chốt, chờ trả bài thì luyện làm gì")
                .isTrue();
    }

    @Test
    void mucAFTER_SUBMITThiKinTruocKhiNopVaMoNgaySauKhiNop() {
        Assignment bai = bai("PUBLISHED", null, SAU_MOT_GIO);
        bai.setAnswerReveal("AFTER_SUBMIT");
        AssignmentProgress daNop = moi();
        daNop.setSubmittedAt(TRUOC_MOT_GIO);

        assertThat(AssignmentWindow.scoreVisible(bai, moi(), BAY_GIO))
                .as("chưa nộp mà thấy đáp án thì cả lớp chép")
                .isFalse();
        assertThat(AssignmentWindow.scoreVisible(bai, daNop, BAY_GIO))
                .as("nộp rồi là thấy, không phải chờ giáo viên chấm")
                .isTrue();
    }

    @Test
    void mucAFTER_RETURNVanLaLuatCuVaCungLaMacDinh() {
        Assignment ghiRo = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        ghiRo.setAnswerReveal("AFTER_RETURN");
        Assignment boTrong = bai("PUBLISHED", null, TRUOC_MOT_GIO);
        boTrong.setAnswerReveal(null);
        AssignmentProgress daNop = moi();
        daNop.setSubmittedAt(TRUOC_MOT_GIO);
        AssignmentProgress daTra = moi();
        daTra.setSubmittedAt(TRUOC_MOT_GIO);
        daTra.setGradedAt(TRUOC_MOT_GIO);
        daTra.setReturnedAt(TRUOC_MOT_GIO);

        assertThat(AssignmentWindow.scoreVisible(ghiRo, daNop, BAY_GIO)).isFalse();
        assertThat(AssignmentWindow.scoreVisible(ghiRo, daTra, BAY_GIO)).isTrue();
        assertThat(AssignmentWindow.scoreVisible(boTrong, daNop, BAY_GIO))
                .as("""
                        Cột answer_reveal thêm vào sau nên hàng cũ đọc lên có thể rỗng. Rỗng phải rơi
                        về AFTER_RETURN — mặc định nào khác cũng là bật đáp án cho toàn bộ bài đã giao
                        từ trước, không ai bấm gì cả.""")
                .isFalse();
        assertThat(AssignmentWindow.scoreVisible(boTrong, daTra, BAY_GIO)).isTrue();
    }

    @Test
    void chuaLamBaiThiKhongMucNaoHienDiem() {
        // p == null nghĩa là em chưa mở bài lần nào; ba mức đều không có gì để hiện.
        for (String muc : new String[]{"IMMEDIATE", "AFTER_SUBMIT", "AFTER_RETURN"}) {
            Assignment bai = bai("PUBLISHED", null, SAU_MOT_GIO);
            bai.setAnswerReveal(muc);
            assertThat(AssignmentWindow.scoreVisible(bai, null, BAY_GIO)).as("mức %s", muc).isFalse();
        }
    }

    // --- helpers -------------------------------------------------------------

    private Assignment bai(String status, LocalDateTime openAt, LocalDateTime dueAt) {
        Assignment assignment = new Assignment();
        assignment.setId(1L);
        assignment.setTitle("Kiểm tra 15 phút");
        assignment.setStatus(status);
        assignment.setOpenAt(openAt);
        assignment.setDueAt(dueAt);
        return assignment;
    }

    private AssignmentProgress moi() {
        return new AssignmentProgress();
    }

    private BigDecimal diem(String value) {
        return new BigDecimal(value);
    }
}
