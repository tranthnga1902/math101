package com.math10.programs.controller;

import com.math10.assignments.support.NeoBuoi;
import com.math10.audit.service.AuditService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.programs.AcademicBreaks;
import com.math10.programs.support.LichCuaKhoa;
import com.math10.programs.support.LichTuan;

import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Lịch tuần của một khóa: tuần chương trình rơi vào ngày nào.
 *
 * <p><b>Xem trước tách khỏi ghi thật.</b> Admin chọn ngày khai giảng, thấy cả 35 tuần trải ra, rồi
 * mới cam kết. Hai cửa ấy gọi chung {@link #tinh} và chung {@link LichTuan#sinh} — nếu để chúng tự
 * tính riêng thì màn xem trước sẽ có ngày dối, và không ai phát hiện cho tới lúc lệch lịch thật.
 *
 * <p><b>Cửa đọc mở cho mọi người đã đăng nhập.</b> Lịch tuần của khóa không phải bí mật: học sinh
 * cần biết tuần này là tuần mấy và bao giờ học lại sau Tết. Thứ có quyền đọc riêng là học liệu gắn
 * vào tuần, và nó không đi qua đây.
 */
@RestController
@RequiredArgsConstructor
public class CourseWeekController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final AcademicBreaks kyNghi;
    private final LichCuaKhoa lich;
    private final NeoBuoi neoBuoi;

    public record YeuCauSinh(LocalDate ngayBatDau, Integer tuTuan, Integer tietMoiTuan) {}

    public record SuaTuan(LocalDate ngayBatDau, LocalDate ngayKetThuc, String nhanNghi) {}

    /** Lịch đã lưu. */
    @GetMapping("/api/course-instances/{khoaId}/weeks")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<LichCuaKhoa.Dong>> xem(@PathVariable Long khoaId) {
        return ApiResponse.ok("Lịch tuần của khóa", daLuu(khoaId));
    }

    /**
     * Xem trước, không ghi gì.
     *
     * <p>Trả về cả phần giữ nguyên lẫn phần sinh mới trong một danh sách, vì thứ admin cần nhìn là
     * cả năm chứ không phải phần thay đổi. Dòng chưa lưu có {@code id} rỗng — đó là cách phân biệt
     * duy nhất, và cũng là thứ màn hình dùng để tô khác màu.
     *
     * <p>{@code tietMoiTuan} là nhịp dạy admin thử: có nó thì số tuần tính từ tổng tiết chương trình
     * ({@code ceil(tổng tiết / nhịp)}) thay vì theo SGK, và phản hồi kèm {@code ngayHoanThanhDuKien}
     * cùng {@code canhBao} khi ngày ấy lệch nhiều so với ngày kết thúc khóa. Xem trước không ghi gì —
     * nhịp chỉ được lưu ở cửa sinh thật.
     */
    @GetMapping("/api/admin/course-instances/{khoaId}/weeks/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Map<String, Object>> xemTruoc(
            @PathVariable Long khoaId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate ngayBatDau,
            @RequestParam(required = false) Integer tuTuan,
            @RequestParam(required = false) Integer tietMoiTuan) {
        return ApiResponse.ok("Xem trước lịch tuần",
                tinh(khoaId, ngayBatDau, tuTuan, kiemNhip(tietMoiTuan)).thanhBan());
    }

    /**
     * Ghi lịch.
     *
     * <p>Chỉ đụng từ {@code tuTuan} trở đi. Những tuần trước đó giữ nguyên cả ngày lẫn {@code id} —
     * "quá khứ không đụng" không phải là sinh ra ngày y hệt, mà là không viết lại dòng nào cả.
     *
     * <p>Đổi lịch xong thì dịch luôn hạn nộp của bài neo buổi ({@link NeoBuoi#dongBoTheoKhoa}).
     * Không gọi ở đây thì lùi lịch một tuần là mọi bài neo giữ nguyên hạn cũ — không lỗi, không báo,
     * chỉ là hạn nộp rơi vào tuần lớp chưa học tới. {@code dongBoTheoKhoa} tự bỏ qua bài đã mở.
     *
     * <p><b>Nhịp dạy đi kèm thì lưu và tự dời ngày kết thúc khóa.</b> {@code yc.tietMoiTuan()} có giá
     * trị thì ghi vào {@code course_instances.tiet_moi_tuan} trước khi tính, rồi sau khi sinh xong lấy
     * ngày cuối của lịch làm {@code ends_on} mới — admin chọn nhịp một lần, ngày kết thúc theo đó mà
     * ra. Không kèm nhịp thì hai cột ấy giữ nguyên.
     */
    @PostMapping("/api/admin/course-instances/{khoaId}/weeks")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Map<String, Object>> sinh(@PathVariable Long khoaId, @RequestBody(required = false) YeuCauSinh yc) {
        Integer nhip = kiemNhip(yc == null ? null : yc.tietMoiTuan());
        if (nhip != null) {
            jdbc.update("update course_instances set tiet_moi_tuan=?,updated_at=now() where id=? and deleted_at is null",
                    nhip, khoaId);
        }
        Ban ban = tinh(khoaId, yc == null ? null : yc.ngayBatDau(), yc == null ? null : yc.tuTuan(), nhip);

        if (!ban.xoaDi.isEmpty()) {
            jdbc.update("update course_weeks set deleted_at=now(),updated_at=now() where id in ("
                    + choTrong(ban.xoaDi.size()) + ")", ban.xoaDi.toArray());
        }
        jdbc.batchUpdate("""
                insert into course_weeks(course_instance_id,week_no,starts_on,ends_on,is_break,break_label,
                                         edited_by_hand,created_at,updated_at)
                values(?,?,?,?,?,?,?,now(),now())""",
                ban.sinhMoi.stream().map(t -> new Object[]{khoaId, t.soTuan(),
                        java.sql.Date.valueOf(t.batDau()), java.sql.Date.valueOf(t.ketThuc()),
                        t.nghi(), t.nhanNghi(), t.suaTay()}).toList());

        Map<String, Object> ra = ban.thanhBan();
        if (nhip != null && ra.get("ngayCuoi") instanceof LocalDate lc) {
            jdbc.update("update course_instances set ends_on=?,updated_at=now() where id=? and deleted_at is null",
                    java.sql.Date.valueOf(lc), khoaId);
            ra.put("ngayKetThucKhoaDaCapNhat", lc);
        }
        ra.put("baiGiaoDaDoi", neoBuoi.dongBoTheoKhoa(khoaId));
        audit.record("GENERATE", "COURSE_WEEKS", khoaId, null,
                "tuan=" + ra.get("soTuan") + " nghi=" + ra.get("soTuanNghi") + " boQua=" + ra.get("soTuanBoQua")
                        + " nhip=" + nhip + " baiGiao=" + ra.get("baiGiaoDaDoi"));
        return ApiResponse.ok("Đã sinh lịch tuần", ra);
    }

    /** Nhịp dạy hợp lệ là 1..20 hoặc bỏ trống. Trả lại chính nó để chỗ gọi dùng tiếp. */
    private static Integer kiemNhip(Integer nhip) {
        if (nhip != null && (nhip < 1 || nhip > 20)) {
            throw new BusinessException("Số tiết mỗi tuần phải trong khoảng 1..20");
        }
        return nhip;
    }

    /**
     * Sửa ngày của một tuần và đóng dấu đã sửa tay.
     *
     * <p>Cửa này <b>không</b> cho đổi một tuần thành tuần nghỉ. Tuần nghỉ sinh ra từ bảng kỳ nghỉ
     * của khóa — thêm kỳ nghỉ rồi sinh lại là đường duy nhất. Mở thêm đường thứ hai ở đây thì câu
     * "tuần này có nghỉ không" có hai nguồn trả lời, và chúng sẽ lệch nhau.
     *
     * <p>Dời một tuần cũng dịch hạn nộp của bài neo buổi, cùng lý do như ở cửa sinh lịch.
     */
    @PutMapping("/api/admin/course-weeks/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<LichCuaKhoa.Dong> sua(@PathVariable Long id, @RequestBody SuaTuan yc) {
        List<Map<String, Object>> cu = jdbc.queryForList(
                "select id,course_instance_id,starts_on,ends_on from course_weeks where id=? and deleted_at is null", id);
        if (cu.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy tuần");
        if (yc.ngayBatDau() == null || yc.ngayKetThuc() == null) throw new BusinessException("Thiếu ngày bắt đầu hoặc ngày kết thúc");
        if (yc.ngayKetThuc().isBefore(yc.ngayBatDau())) throw new BusinessException("Ngày kết thúc trước ngày bắt đầu");

        Long khoaId = ((Number) cu.get(0).get("course_instance_id")).longValue();
        Integer chong = jdbc.queryForObject("""
                select count(*) from course_weeks where course_instance_id=? and id<>? and deleted_at is null
                  and starts_on <= ? and ends_on >= ?""", Integer.class,
                khoaId, id, java.sql.Date.valueOf(yc.ngayKetThuc()), java.sql.Date.valueOf(yc.ngayBatDau()));
        if (chong != null && chong > 0) throw new BusinessException("Khoảng ngày này chồng lên tuần khác");

        jdbc.update("""
                update course_weeks set starts_on=?, ends_on=?, break_label=?, edited_by_hand=true, updated_at=now()
                where id=?""",
                java.sql.Date.valueOf(yc.ngayBatDau()), java.sql.Date.valueOf(yc.ngayKetThuc()), yc.nhanNghi(), id);
        int baiGiaoDaDoi = neoBuoi.dongBoTheoKhoa(khoaId);
        audit.record("UPDATE", "COURSE_WEEK", id, cu.get(0).toString(),
                yc.ngayBatDau() + ".." + yc.ngayKetThuc() + " baiGiao=" + baiGiaoDaDoi);
        return ApiResponse.ok("Đã sửa tuần", daLuu(khoaId).stream()
                .filter(d -> id.equals(d.id())).findFirst().orElseThrow());
    }

    // ---- phần dùng chung của xem trước và ghi thật ----

    /**
     * Kết quả tính: giữ lại gì, xóa gì, sinh ra gì. Ghi thật chỉ là thi hành đúng ba danh sách này.
     *
     * <p>{@code ketThucKhoa} là {@code ends_on} admin đặt lúc mở khóa; {@code nhip} là nhịp dạy đang
     * áp (từ payload hoặc từ cột đã lưu). Hai thứ ấy chỉ để {@link #thanhBan} tính {@code ngayHoanThanhDuKien}
     * và {@code canhBao} — không quyết định số tuần, việc đó đã nằm ở {@link #soTuanCua}.
     */
    private record Ban(List<LichCuaKhoa.Dong> giuLai, List<Long> xoaDi, List<LichTuan.Tuan> sinhMoi,
                       LocalDate ketThucKhoa, Integer nhip) {
        Map<String, Object> thanhBan() {
            List<LichCuaKhoa.Dong> tatCa = new ArrayList<>(giuLai);
            sinhMoi.forEach(t -> tatCa.add(new LichCuaKhoa.Dong(null, t.soTuan(), t.batDau(), t.ketThuc(),
                    t.nghi(), t.nhanNghi(), t.suaTay())));
            LocalDate ngayDau = tatCa.isEmpty() ? null : tatCa.get(0).batDau();
            LocalDate ngayCuoi = tatCa.isEmpty() ? null : tatCa.get(tatCa.size() - 1).ketThuc();

            Map<String, Object> ra = new LinkedHashMap<>();
            ra.put("tuan", tatCa);
            ra.put("soTuan", tatCa.stream().filter(d -> !d.nghi()).count());
            ra.put("soTuanNghi", tatCa.stream().filter(LichCuaKhoa.Dong::nghi).count());
            ra.put("soTuanBoQua", sinhMoi.stream().filter(LichTuan.Tuan::suaTay).count());
            ra.put("ngayDau", ngayDau);
            ra.put("ngayCuoi", ngayCuoi);

            ra.put("nhipMoiTuan", nhip);
            ra.put("soTuanCanThiet", tatCa.stream().filter(d -> !d.nghi()).count());
            ra.put("soTuanKhaDung", ngayDau == null || ketThucKhoa == null ? null
                    : Math.max(0, ChronoUnit.WEEKS.between(ngayDau, ketThucKhoa) + 1));
            ra.put("ngayHoanThanhDuKien", ngayCuoi);
            ra.put("canhBao", canhBao(ngayCuoi));
            return ra;
        }

        /** Cảnh báo thuần số học: dự kiến học xong lệch nhiều so với ngày kết thúc khóa thì nói ra. */
        private String canhBao(LocalDate ngayCuoi) {
            if (ketThucKhoa == null || ngayCuoi == null) return null;
            long ngayLech = ChronoUnit.DAYS.between(ketThucKhoa, ngayCuoi);
            if (ngayLech > 3) {
                long tuanLech = ngayLech / 7;
                return "Dự kiến học xong " + ngayCuoi + ", muộn hơn ngày kết thúc khóa (" + ketThucKhoa + ")"
                        + (tuanLech >= 1 ? " khoảng " + tuanLech + " tuần" : "") + ".";
            }
            if (ngayLech < -7) {
                long tuanLech = -ngayLech / 7;
                return "Dự kiến học xong " + ngayCuoi + ", sớm hơn ngày kết thúc khóa (" + ketThucKhoa + ")"
                        + (tuanLech >= 1 ? " khoảng " + tuanLech + " tuần" : "") + ".";
            }
            return null;
        }
    }

    private Ban tinh(Long khoaId, LocalDate ngayBatDau, Integer tuTuan, Integer nhipGhiDe) {
        List<Map<String, Object>> khoa = jdbc.queryForList(
                "select starts_on, ends_on, tiet_moi_tuan from course_instances where id=? and deleted_at is null", khoaId);
        if (khoa.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy khóa");
        Map<String, Object> k = khoa.get(0);
        LocalDate khaiGiang = ((java.sql.Date) k.get("starts_on")).toLocalDate();
        LocalDate ketThucKhoa = ((java.sql.Date) k.get("ends_on")).toLocalDate();
        Integer nhipLuu = k.get("tiet_moi_tuan") == null ? null : ((Number) k.get("tiet_moi_tuan")).intValue();
        Integer nhip = nhipGhiDe != null ? nhipGhiDe : nhipLuu;

        int soTuan = soTuanCua(khoaId, nhip);
        int tu = tuTuan == null ? 1 : tuTuan;
        if (tu < 1 || tu > soTuan) throw new BusinessException("Tuần bắt đầu ngoài khoảng 1.." + soTuan);

        List<LichCuaKhoa.Dong> daCo = daLuu(khoaId);
        // Giữ phần đầu: mọi dòng cho tới tuần thay đổi. Dòng nghỉ nằm xen giữa đi theo phần đầu vì
        // nó thuộc về quãng thời gian ấy, không thuộc về số tuần nào.
        List<LichCuaKhoa.Dong> giuLai = new ArrayList<>();
        List<LichCuaKhoa.Dong> phanSau = new ArrayList<>();
        boolean daSang = false;
        for (LichCuaKhoa.Dong d : daCo) {
            if (!daSang && d.soTuan() != null && d.soTuan() >= tu) daSang = true;
            (daSang ? phanSau : giuLai).add(d);
        }

        LocalDate moc;
        if (!giuLai.isEmpty()) {
            moc = giuLai.get(giuLai.size() - 1).ketThuc().plusDays(1)
                    .with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
        } else {
            // Không truyền ngày thì lấy ngày khai giảng của khóa; cột ấy NOT NULL nên luôn có.
            moc = LichTuan.thuHaiCua(ngayBatDau != null ? ngayBatDau : khaiGiang);
        }

        // Tuần đã sửa tay trong phần sắp bị sinh lại: giữ nguyên ngày của chúng.
        Map<Integer, LichTuan.Tuan> suaTay = new HashMap<>();
        for (LichCuaKhoa.Dong d : phanSau)
            if (d.suaTay() && d.soTuan() != null)
                suaTay.put(d.soTuan(), new LichTuan.Tuan(d.soTuan(), d.batDau(), d.ketThuc(), false, null, true));

        List<LichTuan.KyNghi> nghi = kyNghi.all(khoaId).stream()
                .map(b -> new LichTuan.KyNghi(b.startsOn(), b.endsOn(), b.reason())).toList();

        return new Ban(giuLai, phanSau.stream().map(LichCuaKhoa.Dong::id).toList(),
                LichTuan.sinh(moc, tu, soTuan, nghi, suaTay), ketThucKhoa, nhip);
    }

    /**
     * Số tuần khóa này cần chạy.
     *
     * <p><b>Có nhịp dạy thì tính từ tổng tiết:</b> {@code ceil(tổng tiết chương trình / nhịp)} — admin
     * chọn dạy bao nhiêu tiết mỗi tuần, số tuần theo đó mà ra. Không nhịp thì theo SGK:
     * {@code max(week_no)} trong {@code program_periods} đi qua {@code program_templates}. Chưa nhập
     * PPCT (không dòng nào, không nhịp) thì lùi về 35 — đúng số mà {@link PhanPhoiChuan#SO_TUAN} vẫn
     * giả định, nên khóa cũ không đổi hành vi.
     */
    private int soTuanCua(long khoaId, Integer nhip) {
        Map<String, Object> m = jdbc.queryForMap("""
                select coalesce(max(p.week_no), 0) as tuan_sgk, count(*) as tong_tiet
                from program_periods p
                  join program_strands s on s.id = p.strand_id and s.deleted_at is null
                where p.deleted_at is null and s.program_id = (
                    select pt.program_id from course_instances ci
                      join program_templates pt on pt.id = ci.template_id
                    where ci.id = ?)""", khoaId);
        int tuanSgk = ((Number) m.get("tuan_sgk")).intValue();
        long tongTiet = ((Number) m.get("tong_tiet")).longValue();
        if (nhip != null && nhip > 0 && tongTiet > 0) {
            return (int) Math.ceil((double) tongTiet / nhip);
        }
        return tuanSgk > 0 ? tuanSgk : 35;
    }

    // Đọc qua LichCuaKhoa chứ không viết lại câu select ở đây: màn Hôm nay đọc cùng bảng này, và
    // hai câu truy vấn cùng trả lời "lịch của khóa" thì sớm muộn một câu quên deleted_at.
    private List<LichCuaKhoa.Dong> daLuu(Long khoaId) {
        return lich.tatCa(khoaId);
    }

    private String choTrong(int n) { return String.join(",", java.util.Collections.nCopies(n, "?")); }
}
