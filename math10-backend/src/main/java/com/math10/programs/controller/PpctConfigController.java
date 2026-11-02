package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * CRUD cấu hình phân phối cho một chương trình: tham số thời gian, mạch, tuần đặc biệt,
 * từ khóa nhận dạng mạch.
 *
 * <p>Toàn bộ dữ liệu từ đây thay thế những gì trước đây nằm cứng trong {@code PhanPhoiChuan}
 * và {@code PpctSuyMach}. Không có endpoint nào ở đây sinh tiết hay ghi vào
 * {@code program_periods} — đó là việc của {@code ProgramStrandController.seed()} và
 * {@code PpctGhiService.phanPhoi()}.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/programs/{programId}")
@PreAuthorize("hasRole('ADMIN')")
public class PpctConfigController {

    private final JdbcTemplate jdbc;

    // ==================== Tham số thời gian ====================

    @GetMapping("/ppct-config")
    public ApiResponse<Map<String, Object>> layConfig(@PathVariable Long programId) {
        kiemTra(programId);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select so_tuan, tuan_ky_1, tiet_mot_tuan from program_ppct_config where program_id=?", programId);
        if (rows.isEmpty()) return ApiResponse.ok("Chưa có cấu hình", null);
        return ApiResponse.ok("Cấu hình thời gian", rows.get(0));
    }

    @PutMapping("/ppct-config")
    @Transactional
    public ApiResponse<Map<String, Object>> luuConfig(@PathVariable Long programId,
            @RequestBody ThamSoInput x) {
        kiemTra(programId);
        if (x.so_tuan() < 1) throw new BusinessException("Số tuần phải >= 1");
        if (x.tuan_ky_1() < 1 || x.tuan_ky_1() >= x.so_tuan())
            throw new BusinessException("Tuần kết thúc HK1 phải >= 1 và < số tuần");
        if (x.tiet_mot_tuan() < 1) throw new BusinessException("Số tiết mỗi tuần phải >= 1");
        int rows = jdbc.update(
                "update program_ppct_config set so_tuan=?,tuan_ky_1=?,tiet_mot_tuan=?,updated_at=now() where program_id=?",
                x.so_tuan(), x.tuan_ky_1(), x.tiet_mot_tuan(), programId);
        if (rows == 0) {
            jdbc.update("insert into program_ppct_config(program_id,so_tuan,tuan_ky_1,tiet_mot_tuan,created_at,updated_at) values(?,?,?,?,now(),now())",
                    programId, x.so_tuan(), x.tuan_ky_1(), x.tiet_mot_tuan());
        }
        return ApiResponse.ok("Đã lưu cấu hình", jdbc.queryForMap(
                "select so_tuan,tuan_ky_1,tiet_mot_tuan from program_ppct_config where program_id=?", programId));
    }

    // ==================== Mạch ====================

    @GetMapping("/mach-config")
    public ApiResponse<List<Map<String, Object>>> layMach(@PathVariable Long programId) {
        kiemTra(programId);
        return ApiResponse.ok("Mạch của chương trình", jdbc.queryForList(
                "select id,ma_mach,ten_mach,thu_tu,bat_dau_tuan,ket_thuc_tuan,so_tiet_mot_tuan from program_mach_config " +
                "where program_id=? and deleted_at is null order by thu_tu", programId));
    }

    /** Replace toàn bộ danh sách mạch. */
    @PutMapping("/mach-config")
    @Transactional
    public ApiResponse<List<Map<String, Object>>> luuMach(@PathVariable Long programId,
            @RequestBody List<MachInput> ds) {
        kiemTra(programId);
        if (ds == null || ds.isEmpty()) throw new BusinessException("Phải có ít nhất một mạch");
        for (int i = 0; i < ds.size(); i++) {
            MachInput m = ds.get(i);
            if (m.maMach() == null || m.maMach().isBlank()) throw new BusinessException("Mã mạch không được rỗng");
            if (m.tenMach() == null || m.tenMach().isBlank()) throw new BusinessException("Tên mạch không được rỗng");
        }
        jdbc.update("update program_mach_config set deleted_at=now(),updated_at=now() where program_id=? and deleted_at is null", programId);
        for (int i = 0; i < ds.size(); i++) {
            MachInput m = ds.get(i);
            jdbc.update("insert into program_mach_config(program_id,ma_mach,ten_mach,thu_tu,bat_dau_tuan,ket_thuc_tuan,so_tiet_mot_tuan,created_at,updated_at) values(?,?,?,?,?,?,?,now(),now())",
                    programId, m.maMach(), m.tenMach(), i + 1, m.batDauTuan(), m.ketThucTuan(), m.soTietMotTuan());
        }
        return ApiResponse.ok("Đã lưu cấu hình mạch", jdbc.queryForList(
                "select id,ma_mach,ten_mach,thu_tu,bat_dau_tuan,ket_thuc_tuan,so_tiet_mot_tuan from program_mach_config where program_id=? and deleted_at is null order by thu_tu", programId));
    }

    // ==================== Tuần đặc biệt ====================

    @GetMapping("/tuan-dac-biet")
    public ApiResponse<List<Map<String, Object>>> layTuanDacBiet(@PathVariable Long programId) {
        kiemTra(programId);
        return ApiResponse.ok("Tuần đặc biệt", jdbc.queryForList(
                "select id,tuan_so,loai,ma_mach,nhan from program_tuan_dac_biet " +
                "where program_id=? and deleted_at is null order by tuan_so,loai", programId));
    }

    /** Replace toàn bộ danh sách tuần đặc biệt. */
    @PutMapping("/tuan-dac-biet")
    @Transactional
    public ApiResponse<List<Map<String, Object>>> luuTuanDacBiet(@PathVariable Long programId,
            @RequestBody List<TuanDacBietInput> ds) {
        kiemTra(programId);
        jdbc.update("update program_tuan_dac_biet set deleted_at=now(),updated_at=now() where program_id=? and deleted_at is null", programId);
        if (ds != null) {
            for (TuanDacBietInput d : ds) {
                if (!List.of("HDTN", "ON_TAP", "KIEM_TRA").contains(d.loai()))
                    throw new BusinessException("Loại tuần đặc biệt không hợp lệ: " + d.loai());
                jdbc.update("insert into program_tuan_dac_biet(program_id,tuan_so,loai,ma_mach,nhan,created_at,updated_at) values(?,?,?,?,?,now(),now())",
                        programId, d.tuanSo(), d.loai(), d.maMach(), d.nhan());
            }
        }
        return ApiResponse.ok("Đã lưu tuần đặc biệt", jdbc.queryForList(
                "select id,tuan_so,loai,ma_mach,nhan from program_tuan_dac_biet where program_id=? and deleted_at is null order by tuan_so,loai", programId));
    }

    // ==================== Từ khóa nhận dạng mạch ====================

    @GetMapping("/tu-khoa")
    public ApiResponse<List<Map<String, Object>>> layTuKhoa(@PathVariable Long programId) {
        kiemTra(programId);
        return ApiResponse.ok("Từ khóa nhận dạng mạch", jdbc.queryForList(
                "select id,ma_mach,tu_khoa from program_mach_tu_khoa " +
                "where program_id=? and deleted_at is null order by ma_mach,id", programId));
    }

    /** Replace toàn bộ từ khóa của một mạch. */
    @PutMapping("/tu-khoa/{maMach}")
    @Transactional
    public ApiResponse<List<Map<String, Object>>> luuTuKhoa(@PathVariable Long programId,
            @PathVariable String maMach, @RequestBody List<String> tuKhoa) {
        kiemTra(programId);
        jdbc.update("update program_mach_tu_khoa set deleted_at=now(),updated_at=now() where program_id=? and ma_mach=? and deleted_at is null",
                programId, maMach);
        if (tuKhoa != null) {
            for (String tk : tuKhoa) {
                String s = tk == null ? "" : tk.trim();
                if (s.isEmpty()) continue;
                jdbc.update("insert into program_mach_tu_khoa(program_id,ma_mach,tu_khoa,created_at,updated_at) values(?,?,?,now(),now())",
                        programId, maMach, s);
            }
        }
        return ApiResponse.ok("Đã lưu từ khóa mạch " + maMach, jdbc.queryForList(
                "select id,ma_mach,tu_khoa from program_mach_tu_khoa where program_id=? and ma_mach=? and deleted_at is null order by id",
                programId, maMach));
    }

    // ==================== Helpers ====================

    private void kiemTra(Long programId) {
        Integer n = jdbc.queryForObject("select count(*) from courses where id=? and deleted_at is null", Integer.class, programId);
        if (n == null || n == 0) throw new ResourceNotFoundException("Không tìm thấy chương trình");
    }

    private String choTrong(int n) { return String.join(",", Collections.nCopies(n, "?")); }

    // ==================== Input records ====================

    public record ThamSoInput(int so_tuan, int tuan_ky_1, int tiet_mot_tuan) {}
    public record MachInput(String maMach, String tenMach, int batDauTuan, int ketThucTuan, int soTietMotTuan) {}
    public record TuanDacBietInput(int tuanSo, String loai, String maMach, String nhan) {}
}
