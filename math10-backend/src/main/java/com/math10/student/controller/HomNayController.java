package com.math10.student.controller;

import com.math10.assignments.domain.AssignmentRows;
import com.math10.assignments.domain.NguoiNhan;
import com.math10.assignments.domain.AssignmentWindow;
import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentProgress;
import com.math10.assignments.entity.AssignmentState;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.programs.support.LichCuaKhoa;
import com.math10.programs.support.LuongNoiDung;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Màn Hôm nay — chỗ trả lời đúng một câu: <em>giờ mình làm gì</em>.
 *
 * <p>Đây là chỗ hai nửa gặp nhau. Lát trước sinh ra lịch tuần theo lớp, và chương trình thì đã có
 * mạch với tiết theo tuần từ lâu; nhưng "tuần này là tuần 12" với "tuần 12 học gì" vẫn là hai câu
 * hỏi ở hai màn hình khác nhau. Nối lại chính là màn này.
 *
 * <p><b>Một lần gọi cho cả màn.</b> Không phải để nhanh. Là vì trạng thái — đang học, đang nghỉ,
 * chưa khai giảng — phải được quyết ở đúng một chỗ. Chia thành sáu cửa thì màn hình tự ghép lại từ
 * sáu câu trả lời rời, và ghép sai thì ra một màn nói "tuần 12" ở trên trong khi bên dưới là học
 * liệu của tuần 13.
 *
 * <p><b>Rỗng phải nói được vì sao rỗng.</b> Kế hoạch chỉ đòi hai trạng thái đầu; bốn cái còn lại là
 * các bờ thật của dữ liệu. Thiếu chúng thì học sinh chưa vào lớp, học sinh của khóa chưa xếp lịch,
 * và học sinh mở màn giữa hè đều thấy cùng một màn trắng — mà màn trắng không nói gì thì người dùng
 * đoán, và đoán thường là "hỏng rồi".
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/student")
public class HomNayController {

    private final JdbcTemplate jdbc;
    private final CurrentUserService current;
    private final LuongNoiDung luat;
    private final LichCuaKhoa lich;

    /** Vì sao màn hình đang hiện thứ nó đang hiện. */
    public enum TrangThai {
        /** Hôm nay nằm trong một tuần học. */
        DANG_HOC,
        /** Hôm nay nằm trong kỳ nghỉ, hoặc trong quãng chưa xếp lịch giữa hai tuần học. */
        DANG_NGHI,
        /** Trước ngày khai giảng của khóa. */
        CHUA_KHAI_GIANG,
        /** Sau tuần cuối, hoặc đang nghỉ mà phía sau không còn tuần học nào. */
        DA_KET_THUC,
        /** Khóa có học sinh nhưng chưa ai bấm sinh lịch. */
        CHUA_CO_LICH,
        /** Học sinh chưa thuộc lớp nào có khóa. */
        CHUA_VAO_LOP
    }

    public record Tiet(Long id, int so, String ten, String loai,
                       Long baiId, String tenBai, Long chuongId, String tenChuong) {}

    public record Mach(Long id, String ma, String ten, List<Tiet> tiet) {}

    public record HocLieu(Long id, String loai, String ten, String duongDan, Long tepId) {}

    public record Viec(Long id, String ten, LocalDateTime moLuc, LocalDateTime hanNop,
                       String trangThai, Long baiId, Long phieuId, Integer luotConLai) {}

    public record Diem(Long id, String ten, BigDecimal diem, BigDecimal diemToiDa, LocalDateTime traLuc) {}

    public record TuanToi(Integer soTuan, LocalDate batDau, LocalDate ketThuc,
                          boolean nghi, String nhanNghi, List<String> tenBai) {}

    public record ChuongDaHoc(Long id, String ten, int soTiet, int tuanCuoi) {}

    public record HocTiep(String duongDan, LocalDateTime luc) {}

    /**
     * Cả màn hình trong một đối tượng.
     *
     * <p>{@code tuan} là tuần <em>đang hiện</em>, không phải lúc nào cũng là tuần chứa hôm nay: đang
     * nghỉ thì nó là tuần học lại, chưa khai giảng thì nó là tuần đầu. Mọi thứ bên dưới — mạch, học
     * liệu, mốc chia đã học với sắp tới — đều đọc từ đúng biến này, nên không có chỗ nào lệch tuần
     * với chỗ nào.
     *
     * <p>{@code tuanSeHoc} nói cho màn hình biết chia động từ thế nào: "đang học" hay "sẽ học". Để
     * màn hình tự suy từ ngày tháng thì mỗi màn suy một kiểu.
     */
    /** Tiến độ thực tế của lớp học sinh so với kế hoạch. Null khi chưa có dữ liệu. */
    public record TienDoLop(String trangThai, int theoKeHoach, int thucTe, int lech,
                            boolean canhBao) {}

    public record HomNay(TrangThai trangThai, LocalDate ngay,
                         Long khoaId, String tenKhoa, int soKhoa,
                         LichCuaKhoa.Dong tuan, boolean tuanSeHoc,
                         String nhanNghi, LocalDate ngayHocLai,
                         List<Mach> mach, List<HocLieu> hocLieu, int soTietChuaCoBai,
                         List<Viec> viec, List<Diem> diem, HocTiep hocTiep,
                         List<TuanToi> sapToi, List<ChuongDaHoc> daHoc,
                         TienDoLop tienDoLop) {}

    /**
     * Màn hình mặc định của học sinh.
     *
     * <p>{@code khoaId} để đổi khóa: ở trung tâm, học một lúc hai khóa là chuyện thường. Bỏ trống
     * thì lấy khóa đang chạy hôm nay — thứ tự do {@link LichCuaKhoa#khoaCuaHocSinh} quyết, và khóa
     * không phải của mình thì không tồn tại chứ không phải bị từ chối.
     *
     * <p>{@code ngay} để xem một ngày khác. Nó chỉ đổi <em>chỗ đứng</em>, không đổi quyền: điều kiện
     * đọc học liệu là trạng thái, đối tượng và bài đã mở chưa — không cái nào hỏi tới ngày. Nhìn tới
     * tuần sau thấy đúng những gì tuần sau cũng cho thấy, và kế hoạch đã chốt là không khóa nội dung
     * tương lai. Không có tham số này thì ba nhánh nghỉ, chưa khai giảng và đã kết thúc chỉ kiểm
     * được bằng cách ngồi đợi tới ngày.
     */
    @GetMapping("/hom-nay")
    @PreAuthorize("hasRole('STUDENT')")
    public ApiResponse<HomNay> homNay(@RequestParam(required = false) Long khoaId,
                                      @RequestParam(required = false)
                                      @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ngay) {
        Long hocSinhId = current.requireUserId();
        LocalDate moc = ngay == null ? LocalDate.now() : ngay;

        List<Long> khoaCuaEm = lich.khoaCuaHocSinh(hocSinhId, moc);
        if (khoaCuaEm.isEmpty()) {
            return ApiResponse.ok("Hôm nay", trong(TrangThai.CHUA_VAO_LOP, moc, null, null, 0, null, null));
        }
        Long khoa = khoaId == null ? khoaCuaEm.get(0) : khoaId;
        // Khóa của người khác thì không tồn tại. Trả 403 là đã xác nhận nó có thật.
        if (!khoaCuaEm.contains(khoa)) throw new ResourceNotFoundException("Không tìm thấy khóa học");
        String tenKhoa = tenKhoa(khoa);
        int soKhoa = khoaCuaEm.size();

        List<LichCuaKhoa.Dong> caLich = lich.tatCa(khoa);
        if (caLich.isEmpty()) {
            // Chưa xếp lịch không có nghĩa là chưa giao bài: bài giao gắn vào lớp, không vào tuần.
            return ApiResponse.ok("Hôm nay", keoTheoBai(
                    trong(TrangThai.CHUA_CO_LICH, moc, khoa, tenKhoa, soKhoa, null, null), khoa, hocSinhId));
        }

        Optional<LichCuaKhoa.Dong> phu = lich.tai(khoa, moc);
        TrangThai trangThai;
        LichCuaKhoa.Dong tuan;
        String nhanNghi = null;
        if (phu.isPresent() && !phu.get().nghi()) {
            trangThai = TrangThai.DANG_HOC;
            tuan = phu.get();
        } else if (phu.isPresent()) {
            // Đang nghỉ: tuần hiện là tuần học lại, để câu "nghỉ tới bao giờ, rồi học gì" trả lời
            // được ngay trên màn này chứ không phải mở lịch ra dò.
            nhanNghi = phu.get().nhanNghi();
            tuan = lich.tuanHocTuNgay(khoa, phu.get().ketThuc().plusDays(1)).orElse(null);
            // Nghỉ mà phía sau không còn tuần học nào thì đó là nghỉ hè, không phải nghỉ giữa kỳ.
            trangThai = tuan == null ? TrangThai.DA_KET_THUC : TrangThai.DANG_NGHI;
        } else if (moc.isBefore(caLich.get(0).batDau())) {
            trangThai = TrangThai.CHUA_KHAI_GIANG;
            tuan = lich.tuanHocTuNgay(khoa, moc).orElse(null);
        } else if (moc.isAfter(caLich.get(caLich.size() - 1).ketThuc())) {
            trangThai = TrangThai.DA_KET_THUC;
            tuan = null;
        } else {
            // Lọt vào khe giữa hai dòng lịch: không có dòng nghỉ nào phủ lên, nhưng với học sinh thì
            // hôm nay vẫn là một ngày không đi học. Gọi nó là nghỉ, đừng bịa thêm một trạng thái.
            trangThai = TrangThai.DANG_NGHI;
            tuan = lich.tuanHocTuNgay(khoa, moc).orElse(null);
            if (tuan == null) trangThai = TrangThai.DA_KET_THUC;
        }

        return ApiResponse.ok("Hôm nay", dung(trangThai, moc, khoa, tenKhoa, soKhoa, tuan, nhanNghi, caLich, hocSinhId));
    }

    /** Màn hình không có tuần nào để hiện: chỉ còn lý do, và lý do là thứ phải nói ra. */
    private HomNay trong(TrangThai trangThai, LocalDate ngay, Long khoa, String tenKhoa, int soKhoa,
                         LichCuaKhoa.Dong tuan, String nhanNghi) {
        return new HomNay(trangThai, ngay, khoa, tenKhoa, soKhoa, tuan, false, nhanNghi, null,
                List.of(), List.of(), 0, List.of(), List.of(), null, List.of(), List.of(), null);
    }

    private HomNay dung(TrangThai trangThai, LocalDate ngay, Long khoa, String tenKhoa, int soKhoa,
                        LichCuaKhoa.Dong tuan, String nhanNghi, List<LichCuaKhoa.Dong> caLich, Long hocSinhId) {
        if (tuan == null) {
            HomNay rong = trong(trangThai, ngay, khoa, tenKhoa, soKhoa, null, nhanNghi);
            return keoTheoBai(rong, khoa, hocSinhId);
        }
        Long chuongTrinh = chuongTrinh(khoa);
        int soTuan = tuan.soTuan();
        boolean seHoc = trangThai != TrangThai.DANG_HOC;

        List<Mach> mach = mach(chuongTrinh, soTuan);
        int chuaCoBai = (int) mach.stream().flatMap(m -> m.tiet().stream()).filter(t -> t.tenBai() == null).count();

        // Tính tiến độ lớp của học sinh này (chỉ khi DANG_HOC để tránh query thừa)
        TienDoLop tienDo = null;
        if (trangThai == TrangThai.DANG_HOC) {
            tienDo = tinhTienDoLop(khoa, hocSinhId, ngay);
        }

        HomNay khung = new HomNay(trangThai, ngay, khoa, tenKhoa, soKhoa, tuan, seHoc,
                nhanNghi, seHoc ? tuan.batDau() : null,
                mach, hocLieu(chuongTrinh, soTuan, hocSinhId), chuaCoBai,
                List.of(), List.of(), null,
                sapToi(chuongTrinh, caLich, tuan), daHoc(chuongTrinh, soTuan), tienDo);
        return keoTheoBai(khung, khoa, hocSinhId);
    }

    /**
     * Tính tiến độ lớp của học sinh theo khóa học.
     * Đọc class_course_progress của lớp học sinh đang học khóa này.
     */
    private TienDoLop tinhTienDoLop(Long khoaId, Long hocSinhId, LocalDate ngay) {
        try {
            // Tìm class_id của học sinh trong khóa này
            List<Long> classIds = jdbc.queryForList("""
                    select cs.class_id from class_students cs
                    join class_courses cc on cc.class_id = cs.class_id and cc.deleted_at is null
                    where cs.student_id = ? and cc.course_instance_id = ? and cs.deleted_at is null
                    limit 1
                    """, Long.class, hocSinhId, khoaId);
            if (classIds.isEmpty()) return null;
            long classId = classIds.get(0);

            // 1. Ưu tiên tính từ class_schedule (mô hình 3 tầng) nếu lớp đã có lịch thực tế
            Integer csTotal = jdbc.queryForObject("""
                    select count(*) from class_schedule
                     where class_id = ? and deleted_at is null
                    """, Integer.class, classId);

            if (csTotal != null && csTotal > 0) {
                Integer plannedSeq = jdbc.queryForObject("""
                        select max(seq) from class_schedule
                         where class_id = ? and scheduled_date <= ? and deleted_at is null
                        """, Integer.class, classId, java.sql.Date.valueOf(ngay));
                Integer actualSeq = jdbc.queryForObject("""
                        select max(seq) from class_schedule
                         where class_id = ? and status = 'COMPLETED' and deleted_at is null
                        """, Integer.class, classId);

                int keHoach = plannedSeq != null ? plannedSeq : 0;
                int thucTe  = actualSeq  != null ? actualSeq  : 0;
                int lech    = thucTe - keHoach;
                String trangThai = lech > 0 ? "AHEAD" : (lech < 0 ? "BEHIND" : "ON_TRACK");
                return new TienDoLop(trangThai, keHoach, thucTe, Math.abs(lech), lech < 0);
            }

            // 2. Dự phòng: mô hình cũ
            // Số tiết theo kế hoạch đến ngày này
            Integer theoKeHoach = jdbc.queryForObject("""
                    select count(*) from course_sessions
                    where course_instance_id=? and planned_date<=? and deleted_at is null
                    """, Integer.class, khoaId, java.sql.Date.valueOf(ngay));
            int keHoach = theoKeHoach == null ? 0 : theoKeHoach;

            // Số tiết lớp đã chốt
            Integer thucTeRaw = jdbc.queryForObject("""
                    select completed_period_count from class_course_progress
                    where class_id=? and course_instance_id=?
                    """, Integer.class, classId, khoaId);
            int thucTe = thucTeRaw == null ? 0 : thucTeRaw;

            int lech = thucTe - keHoach;
            String trangThai;
            if (lech > 0) trangThai = "AHEAD";
            else if (lech < 0) trangThai = "BEHIND";
            else trangThai = "ON_TRACK";

            return new TienDoLop(trangThai, keHoach, thucTe, Math.abs(lech), Math.abs(lech) > 2);
        } catch (Exception e) {
            // Không để lỗi tiến độ làm hỏng toàn bộ màn hình Hôm nay
            return null;
        }
    }

    /**
     * Ba mảnh còn lại không phụ thuộc tuần: việc phải làm, điểm mới trả, chỗ đang học dở.
     *
     * <p>Tách ra vì chúng vẫn phải hiện cả khi không có tuần nào — nghỉ hè mà còn bài chưa nộp thì
     * đó đúng là thứ học sinh cần thấy nhất, và một màn "đã kết thúc" trắng trơn giấu mất nó.
     */
    private HomNay keoTheoBai(HomNay khung, Long khoa, Long hocSinhId) {
        if (khoa == null) return khung;
        List<Viec> viec = new ArrayList<>();
        List<Diem> diem = new ArrayList<>();
        baiGiao(khoa, hocSinhId, viec, diem);
        return new HomNay(khung.trangThai(), khung.ngay(), khung.khoaId(), khung.tenKhoa(), khung.soKhoa(),
                khung.tuan(), khung.tuanSeHoc(), khung.nhanNghi(), khung.ngayHocLai(),
                khung.mach(), khung.hocLieu(), khung.soTietChuaCoBai(),
                viec, diem, hocTiep(hocSinhId), khung.sapToi(), khung.daHoc(), khung.tienDoLop());
    }

    /**
     * Mạch của tuần, mỗi mạch một dòng — kể cả mạch tuần này không có tiết nào.
     *
     * <p>Nối từ mạch sang tiết chứ không ngược lại, có chủ đích: mạch Hình học không có tiết nào
     * trong tuần 12 vẫn phải hiện thành một dòng trống. Nối ngược thì nó biến mất, và biến mất trông
     * y hệt như chương trình chỉ có hai mạch.
     *
     * <p>Bài chưa mở thì {@code tenBai} rỗng — cùng luật {@link LuongNoiDung#BAI_MO} mà màn khóa học
     * và cổng tệp đang dùng. Tiết vẫn hiện với tên của nó trong phân phối chương trình, vì đó là
     * thông tin thật: tuần này có tiết ấy, chỉ là học liệu chưa mở.
     */
    private List<Mach> mach(Long chuongTrinh, int soTuan) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select s.id sid,s.code,s.name sname,
                       p.id pid,p.period_no,p.title,p.period_kind,p.lesson_id,
                       l.title lesson_title,ch.id chapter_id,ch.title chapter_title
                from program_strands s
                left join program_periods p on p.strand_id=s.id and p.deleted_at is null and p.week_no=?
                left join lessons l on l.id=p.lesson_id and l.deleted_at is null and l.status='PUBLISHED'
                left join chapters ch on ch.id=l.chapter_id and ch.deleted_at is null and ch.status='PUBLISHED'
                where s.program_id=? and s.deleted_at is null
                order by s.order_index,p.period_no
                """, soTuan, chuongTrinh);

        Map<Long, List<Tiet>> theoMach = new LinkedHashMap<>();
        Map<Long, String[]> ten = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Long machId = num(row.get("sid"));
            theoMach.computeIfAbsent(machId, k -> new ArrayList<>());
            ten.putIfAbsent(machId, new String[]{str(row.get("code")), str(row.get("sname"))});
            if (row.get("pid") == null) continue;
            // Bài ẩn và tiết chưa gắn bài đều rơi vào đây: chương rỗng thì bài cũng rỗng, vì chương
            // chỉ nối được qua bài đã mở.
            theoMach.get(machId).add(new Tiet(num(row.get("pid")), integer(row.get("period_no")),
                    str(row.get("title")), str(row.get("period_kind")),
                    num(row.get("lesson_id")), str(row.get("lesson_title")),
                    num(row.get("chapter_id")), str(row.get("chapter_title"))));
        }
        List<Mach> result = new ArrayList<>();
        theoMach.forEach((id, tiet) -> result.add(new Mach(id, ten.get(id)[0], ten.get(id)[1], tiet)));
        return result;
    }

    /**
     * Học liệu của cả tuần, gom chung một rổ.
     *
     * <p>Không tách theo loại tệp, có chủ đích: học sinh đi tìm "tài liệu của bài đang học", không
     * đi tìm "mấy cái PDF". Loại chỉ còn là cái nhãn nhỏ trên từng dòng. Phép thử của lát này là học
     * sinh không phải rời màn hình để lấy tài liệu, nên rổ này phải đủ chứ không phải phải gọn.
     *
     * <p>Một học liệu gắn ở hai tiết trong cùng tuần — ôn tập trỏ lại bài mới chẳng hạn — chỉ hiện
     * một lần. Lọc trùng ở Java chứ không {@code distinct} trong SQL, vì thứ tự mới là thứ quyết
     * định giữ bản nào: bản đầu tiên theo mạch rồi tới tiết là bản nằm đúng chỗ học sinh mong.
     */
    private List<HocLieu> hocLieu(Long chuongTrinh, int soTuan, Long em) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select pr.id,pr.resource_type loai,pr.title,
                """ + LuongNoiDung.DUONG_DAN + """
                 duong_dan,d.file_asset_id
                from program_periods p
                join program_strands s on s.id=p.strand_id and s.deleted_at is null
                join lessons l on l.id=p.lesson_id
                join chapters ch on ch.id=l.chapter_id
                join program_resources pr on ("""
                + LuongNoiDung.toiDuocBai("l.id") + "\n)\n"
                + LuongNoiDung.NOI_NGUON + """
                where s.program_id=? and p.week_no=? and p.deleted_at is null and"""
                + LuongNoiDung.BAI_MO + " and" + luat.docDuocDayDu()
                + " and" + luat.toiDuocLop("STUDENT", em) + """

                order by s.order_index,p.period_no,pr.order_index
                """, chuongTrinh, soTuan);

        Map<Long, HocLieu> mot = new LinkedHashMap<>();
        for (Map<String, Object> row : rows) {
            Long id = num(row.get("id"));
            mot.putIfAbsent(id, new HocLieu(id, str(row.get("loai")), str(row.get("title")),
                    str(row.get("duong_dan")), num(row.get("file_asset_id"))));
        }
        return new ArrayList<>(mot.values());
    }

    /**
     * Hai dòng lịch kế tiếp, thu gọn.
     *
     * <p>Lấy dòng kế tiếp chứ không lọc lấy tuần học: nếu tuần sau là nghỉ Tết thì đó chính là thứ
     * cần hiện. Nhảy qua nó để khoe tuần học phía sau là nói với học sinh rằng tuần sau vẫn đi học.
     */
    private List<TuanToi> sapToi(Long chuongTrinh, List<LichCuaKhoa.Dong> caLich, LichCuaKhoa.Dong tuan) {
        List<LichCuaKhoa.Dong> ke = caLich.stream()
                .filter(d -> d.batDau().isAfter(tuan.batDau()))
                .limit(2).toList();
        if (ke.isEmpty()) return List.of();

        List<Integer> so = ke.stream().map(LichCuaKhoa.Dong::soTuan).filter(java.util.Objects::nonNull).toList();
        Map<Integer, List<String>> ten = new LinkedHashMap<>();
        if (!so.isEmpty()) {
            String cho = String.join(",", java.util.Collections.nCopies(so.size(), "?"));
            List<Object> args = new ArrayList<>();
            args.add(chuongTrinh);
            args.addAll(so);
            jdbc.queryForList("""
                    select p.week_no,p.title
                    from program_periods p
                    join program_strands s on s.id=p.strand_id and s.deleted_at is null
                    where s.program_id=? and p.deleted_at is null and p.week_no in (""" + cho + """
                    ) order by p.week_no,s.order_index,p.period_no
                    """, args.toArray())
                    .forEach(r -> ten.computeIfAbsent(integer(r.get("week_no")), k -> new ArrayList<>())
                            .add(str(r.get("title"))));
        }
        return ke.stream().map(d -> new TuanToi(d.soTuan(), d.batDau(), d.ketThuc(), d.nghi(), d.nhanNghi(),
                ten.getOrDefault(d.soTuan(), List.of()))).toList();
    }

    /**
     * Phần đã qua, gom theo chương và xếp ngược.
     *
     * <p>Ngược vì cùng lý do {@link LuongNoiDung#THU_TU} xếp ngược dải đã học: mở lại phần đã qua
     * gần như luôn là để tìm chương tuần trước, không phải chương đầu năm.
     */
    private List<ChuongDaHoc> daHoc(Long chuongTrinh, int soTuan) {
        return jdbc.query("""
                select ch.id,ch.title,count(distinct p.id) so_tiet,max(p.week_no) tuan_cuoi
                from program_periods p
                join program_strands s on s.id=p.strand_id and s.deleted_at is null
                join lessons l on l.id=p.lesson_id
                join chapters ch on ch.id=l.chapter_id
                where s.program_id=? and p.deleted_at is null and p.week_no<? and"""
                + LuongNoiDung.BAI_MO + """

                group by ch.id,ch.title
                order by max(p.week_no) desc,ch.id
                """, (rs, n) -> new ChuongDaHoc(rs.getLong("id"), rs.getString("title"),
                rs.getInt("so_tiet"), rs.getInt("tuan_cuoi")), chuongTrinh, soTuan);
    }

    /**
     * Việc phải làm và điểm mới trả, cùng một lượt đọc.
     *
     * <p>Trạng thái vòng đời và quyền thấy điểm hỏi {@link AssignmentWindow} trên thực thể dựng lại
     * từ dòng, không viết lại bằng SQL — {@code publish_score_at} có một nhánh mà câu SQL nào cũng
     * quên, và quên thì điểm hiện sớm chứ không báo lỗi.
     *
     * <p>Chỉ lấy bài của lớp gắn với đúng khóa đang hiện. Màn này đứng trong một khóa; trộn bài của
     * khóa khác vào thì nút đổi khóa ở trên không còn nghĩa gì.
     */
    private void baiGiao(Long khoa, Long hocSinhId, List<Viec> viec, List<Diem> diem) {
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select distinct a.id,a.title,a.open_at,a.due_at,a.status,a.lesson_id,a.worksheet_id,
                       a.max_attempts,a.late_policy,a.late_penalty_percent,a.publish_score_at,
                       ap.score,ap.max_score,ap.graded_at,ap.returned_at,ap.submitted_at,
                       coalesce(ap.attempt_no,0) attempt_no,coalesce(ap.submitted_late,false) submitted_late
                from assignments a
                join class_students cs on cs.class_id=a.class_id and cs.deleted_at is null
                join class_courses cc on cc.class_id=a.class_id and cc.deleted_at is null
                                     and cc.course_instance_id=?
                left join assignment_progress ap on ap.assignment_id=a.id and ap.student_id=cs.student_id
                                                and ap.deleted_at is null
                where cs.student_id=? and a.deleted_at is null
                """ + " and " + NguoiNhan.NHAN_DUOC + " order by a.due_at nulls last,a.id", khoa, hocSinhId);

        LocalDateTime bayGio = LocalDateTime.now();
        List<Diem> daTra = new ArrayList<>();
        for (Map<String, Object> row : rows) {
            Assignment bai = AssignmentRows.assignment(row);
            AssignmentState trangThai = AssignmentWindow.stateOf(bai, bayGio);
            if (!trangThai.visibleToStudent()) continue;
            AssignmentProgress tienDo = AssignmentRows.progress(row);

            // Đã nộp thì không còn là việc phải làm, dù cửa vẫn mở.
            if (trangThai.acceptsSubmission() && tienDo.getSubmittedAt() == null) {
                viec.add(new Viec(bai.getId(), str(row.get("title")), bai.getOpenAt(), bai.getDueAt(),
                        trangThai.name(), bai.getLessonId(), bai.getWorksheetId(),
                        AssignmentWindow.attemptsLeft(bai, tienDo)));
            }
            if (AssignmentWindow.scoreVisible(bai, tienDo, bayGio)) {
                LocalDateTime luc = tienDo.getReturnedAt() != null ? tienDo.getReturnedAt() : tienDo.getGradedAt();
                daTra.add(new Diem(bai.getId(), str(row.get("title")),
                        tienDo.getScore(), tienDo.getMaxScore(), luc));
            }
        }
        daTra.sort(Comparator.comparing(Diem::traLuc, Comparator.nullsLast(Comparator.reverseOrder())));
        diem.addAll(daTra.size() > 5 ? daTra.subList(0, 5) : daTra);
    }

    /** Thẻ học tiếp: chỗ lần trước đang dở. */
    private HocTiep hocTiep(Long hocSinhId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select route,updated_at from user_last_position where user_id=?", hocSinhId);
        if (rows.isEmpty()) return null;
        return new HocTiep(str(rows.get(0).get("route")), dateTime(rows.get(0).get("updated_at")));
    }

    private String tenKhoa(Long khoa) {
        return jdbc.queryForObject("select name from course_instances where id=?", String.class, khoa);
    }

    private Long chuongTrinh(Long khoa) {
        return jdbc.queryForObject("""
                select pt.program_id from course_instances ci
                join program_templates pt on pt.id=ci.template_id
                where ci.id=?
                """, Long.class, khoa);
    }

    private static Long num(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private static int integer(Object value) {
        return value == null ? 0 : ((Number) value).intValue();
    }

    private static String str(Object value) {
        return value == null ? null : value.toString();
    }

    private static LocalDateTime dateTime(Object value) {
        return value == null ? null : ((Timestamp) value).toLocalDateTime();
    }
}
