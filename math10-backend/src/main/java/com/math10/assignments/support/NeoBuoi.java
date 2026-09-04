package com.math10.assignments.support;

import com.math10.assignments.domain.AssignmentWindow;
import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentState;
import com.math10.assignments.entity.ClassPeriodProgress;
import com.math10.assignments.repository.AssignmentRepository;
import com.math10.assignments.repository.ClassPeriodProgressRepository;
import com.math10.programs.support.LichCuaKhoa;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Neo bài giao vào buổi: đổi "nộp trước buổi sau" thành hai mốc giờ thật.
 *
 * <p>Giáo viên nói bằng buổi, cơ sở dữ liệu lưu bằng giờ. {@code anchor_period_id} giữ lại
 * <em>luật</em>, còn {@code open_at}/{@code due_at} vẫn là câu trả lời đã vật hóa — nhờ vậy
 * {@link AssignmentWindow} không phải biết gì về buổi, và mọi màn hình đang đọc hai cột ấy không
 * phải sửa. Lớp này là người duy nhất sinh ra hai cột đó từ neo.
 *
 * <p>Hai câu trả lời, hai nguồn khác nhau:
 * <ul>
 *   <li><b>Mở</b> = lúc lớp chốt tiết ấy ({@code class_period_progress.closed_at}). Chưa chốt thì
 *       chưa mở, và bài nằm ở SCHEDULED chứ không hở ra.</li>
 *   <li><b>Hạn</b> = đầu tuần học kế tiếp của khóa, trừ đệm. Đọc qua {@link LichCuaKhoa} vì đó là
 *       chỗ duy nhất được đọc {@code course_weeks}, và vì nó đã biết nhảy qua tuần nghỉ — nghỉ Tết
 *       chín ngày thì hạn không rơi vào mùng ba.</li>
 * </ul>
 *
 * <p><b>Mọi cột giờ ở đây đi qua JPA, không qua {@code JdbcTemplate}.</b> Cấu hình
 * {@code hibernate.jdbc.time_zone: UTC} khiến Hibernate quy đổi {@code LocalDateTime} hai chiều,
 * còn JDBC thô thì không. Trộn hai đường vào cùng một cột thì giờ lệch đúng bằng độ lệch múi giờ
 * — bảy tiếng ở đây — và không có gì báo: hạn nộp vẫn là một ngày giờ hợp lệ, chỉ là sai. Câu SQL
 * còn lại chỉ lấy {@code id}, vì id không có múi giờ.
 *
 * <p>Lịch chỉ có độ mịn <em>tuần</em>, nên hạn suy ra là đầu tuần học kế tiếp chứ không phải giờ
 * của buổi kế tiếp: một tuần có ba tiết thì hạn muộn hơn buổi liền sau. Muộn hơn thì học sinh vẫn
 * kịp; đoán sớm hơn thì có em mất bài. Suy không ra thì trả rỗng kèm lý do và màn hình nói
 * "chưa có hạn" — không bao giờ hiện một ngày sai.
 */
@Component
@RequiredArgsConstructor
public class NeoBuoi {

    private final JdbcTemplate jdbc;
    private final LichCuaKhoa lich;
    private final ClassPeriodProgressRepository chotBuoi;
    private final AssignmentRepository baiGiao;

    /** {@code lyDoTrong} chỉ có khi hạn rỗng, và là câu để hiện thẳng lên màn hình. */
    public record Han(LocalDateTime moLuc, LocalDateTime hanNop, String lyDoTrong) {}

    public static final int DEM_MAC_DINH = 120;

    /**
     * Hai mốc giờ của một bài neo vào tiết này, ở lớp này.
     *
     * <p>Dùng cả cho lúc ghi (vật hóa vào bảng) lẫn lúc xem trước trong biểu mẫu — cùng một hàm,
     * nên cái giáo viên thấy trước khi bấm lưu đúng bằng cái được lưu.
     */
    public Han tinh(Long lopId, Long tietId, Integer demPhut) {
        int dem = demPhut == null ? DEM_MAC_DINH : Math.max(0, demPhut);
        LocalDateTime moLuc = chotBuoi.findByClassIdAndPeriodIdAndDeletedAtIsNull(lopId, tietId)
                .map(ClassPeriodProgress::getClosedAt).orElse(null);

        List<Map<String, Object>> tiet = jdbc.queryForList(
                "select week_no from program_periods where id=? and deleted_at is null", tietId);
        if (tiet.isEmpty()) return new Han(moLuc, null, "tiết không còn trong chương trình");

        Optional<Long> khoa = khoaCuaLop(lopId, tietId);
        if (khoa.isEmpty()) return new Han(moLuc, null, "lớp chưa gắn khóa của chương trình này");

        Integer soTuan = tiet.get(0).get("week_no") == null ? null : ((Number) tiet.get(0).get("week_no")).intValue();
        Optional<LichCuaKhoa.Dong> tuanCuaTiet = lich.tuan(khoa.get(), soTuan);
        if (tuanCuaTiet.isEmpty()) return new Han(moLuc, null, "khóa chưa xếp lịch tới tuần " + soTuan);

        Optional<LichCuaKhoa.Dong> tuanSau = lich.tuanHocTuNgay(khoa.get(), tuanCuaTiet.get().ketThuc().plusDays(1));
        if (tuanSau.isEmpty()) return new Han(moLuc, null, "sau tuần " + soTuan + " khóa không còn tuần học nào");

        return new Han(moLuc, tuanSau.get().batDau().atStartOfDay().minusMinutes(dem), null);
    }

    /**
     * Vật hóa lại {@code open_at}/{@code due_at} cho mọi bài neo vào tiết này ở lớp này.
     * Trả về số bài đã dịch.
     */
    public int dongBoTheoTiet(Long lopId, Long tietId) {
        return dongBo(jdbc.queryForList("""
                select a.id from assignments a
                where a.deleted_at is null and a.class_id=? and a.anchor_period_id=?""",
                Long.class, lopId, tietId));
    }

    /**
     * Vật hóa lại cho mọi bài neo của mọi lớp đang chạy khóa này — dùng khi lịch tuần đổi.
     *
     * <p>Đây là lý do neo tồn tại: dời một tuần thì hạn của bài chưa mở tự dịch theo, thay vì phải
     * sửa tay từng bài và sót một bài mà không có gì báo.
     */
    public int dongBoTheoKhoa(Long khoaId) {
        return dongBo(jdbc.queryForList("""
                select a.id from assignments a
                join class_courses cc on cc.class_id=a.class_id and cc.deleted_at is null
                where a.deleted_at is null and a.anchor_period_id is not null and cc.course_instance_id=?""",
                Long.class, khoaId));
    }

    /**
     * Bài <em>đã mở</em> thì không đụng tới — hỏi {@link AssignmentWindow} chứ không tự đoán.
     *
     * <p>Dời buổi 7 sang tuần sau là chuyện của buổi 7 chưa dạy. Bài đã mở là bài học sinh đang
     * làm dở: dịch hạn của nó, dù dịch ra xa hơn, cũng là đổi luật chơi giữa chừng — và dịch gần
     * lại thì có em vừa mất bài. Đây là ranh giới dễ vỡ nhất của cả lát này.
     */
    private int dongBo(List<Long> baiIds) {
        LocalDateTime bayGio = LocalDateTime.now();
        int daDich = 0;
        for (Assignment bai : baiGiao.findAllById(baiIds)) {
            AssignmentState trangThai = AssignmentWindow.stateOf(bai, bayGio);
            if (trangThai == AssignmentState.OPEN || trangThai == AssignmentState.LATE_OPEN) continue;

            Han han = tinh(bai.getClassId(), bai.getAnchorPeriodId(), bai.getDueBufferMinutes());
            bai.setOpenAt(han.moLuc());
            bai.setDueAt(han.hanNop());
            baiGiao.save(bai);
            daDich++;
        }
        return daDich;
    }

    /**
     * Khóa mà lớp đang chạy chương trình chứa tiết này.
     *
     * <p>Một lớp học hai khóa cùng lúc là chuyện thường ở trung tâm, nên không lấy khóa bất kỳ của
     * lớp: đi ngược từ tiết đến mạch, chương trình, khuôn, rồi mới cắt với khóa của lớp.
     */
    private Optional<Long> khoaCuaLop(Long lopId, Long tietId) {
        return dau(jdbc.queryForList("""
                select ci.id from course_instances ci
                join program_templates pt on pt.id=ci.template_id and pt.deleted_at is null
                join class_courses cc on cc.course_instance_id=ci.id and cc.deleted_at is null
                join program_strands ps on ps.program_id=pt.program_id and ps.deleted_at is null
                join program_periods pp on pp.strand_id=ps.id and pp.deleted_at is null
                where cc.class_id=? and pp.id=? and ci.deleted_at is null
                order by ci.starts_on desc, ci.id limit 1""", Long.class, lopId, tietId));
    }

    private static <T> Optional<T> dau(List<T> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.ofNullable(rows.get(0));
    }
}
