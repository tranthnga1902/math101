package com.math10.programs;

import com.math10.common.exception.BusinessException;
import com.math10.programs.support.PhanPhoiChuan;
import com.math10.programs.support.PhanPhoiChuan.CauHinhChuan;
import com.math10.programs.support.PhanPhoiChuan.Mach;
import com.math10.programs.support.PhanPhoiChuan.TuanDacBiet;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Tải cấu hình phân phối của một chương trình từ DB.
 *
 * <p>Đây là điểm duy nhất được phép đọc 4 bảng cấu hình — {@code program_ppct_config},
 * {@code program_mach_config}, {@code program_tuan_dac_biet}, {@code program_mach_tu_khoa}.
 * Mọi chỗ cần cấu hình đều gọi vào đây; không có chỗ nào đọc trực tiếp các bảng đó nữa.
 *
 * <p><b>Chương trình chưa cấu hình thì báo lỗi, không tự lấp.</b> Fallback về CTST có vẻ
 * tiện nhưng thực ra nguy hiểm: một chương trình khối 11 chưa cấu hình mà seed vẫn chạy
 * sẽ sinh ra 105 tiết theo cấu trúc Toán 10 — đúng số, sai hoàn toàn. Lỗi rõ buộc người
 * ta cấu hình; tự lấp thì không ai biết có gì sai cho tới khi dạy sai.
 *
 * <p>Từ khóa nhận dạng mạch ({@link #tuKhoa}) trả về riêng vì {@link PpctSuyMach} cần
 * chúng nhưng không cần phần còn lại của cấu hình.
 */
@Component
@RequiredArgsConstructor
public class PpctConfigLoader {

    private static final Logger log = LoggerFactory.getLogger(PpctConfigLoader.class);

    private final JdbcTemplate jdbc;

    /**
     * Tải cấu hình đầy đủ từ DB. Ném {@link BusinessException} nếu chưa có config.
     */
    public CauHinhChuan tai(long programId) {
        List<Map<String, Object>> cfgRows = jdbc.queryForList(
                "select so_tuan, tuan_ky_1, tiet_mot_tuan from program_ppct_config where program_id=?",
                programId);
        if (cfgRows.isEmpty()) {
            throw new BusinessException(
                    "Chương trình chưa có cấu hình phân phối. " +
                    "Vào Admin → Nội dung học → Cấu hình PPCT để thiết lập.");
        }
        Map<String, Object> c = cfgRows.get(0);
        int soTuan      = ((Number) c.get("so_tuan")).intValue();
        int tuanKy1     = ((Number) c.get("tuan_ky_1")).intValue();
        int tietMotTuan = ((Number) c.get("tiet_mot_tuan")).intValue();

        List<Mach> mach = jdbc.queryForList(
                "select ma_mach, ten_mach, thu_tu, coalesce(bat_dau_tuan,0) bat_dau_tuan, " +
                "coalesce(ket_thuc_tuan,0) ket_thuc_tuan, so_tiet_mot_tuan from program_mach_config " +
                "where program_id=? and deleted_at is null order by thu_tu", programId)
                .stream()
                .map(r -> new Mach(
                        (String) r.get("ma_mach"),
                        (String) r.get("ten_mach"),
                        ((Number) r.get("thu_tu")).intValue(),
                        ((Number) r.get("bat_dau_tuan")).intValue(),
                        ((Number) r.get("ket_thuc_tuan")).intValue(),
                        ((Number) r.get("so_tiet_mot_tuan")).intValue()))
                .toList();

        List<TuanDacBiet> tuanDacBiet = jdbc.queryForList(
                "select tuan_so, loai, ma_mach, nhan from program_tuan_dac_biet " +
                "where program_id=? and deleted_at is null order by tuan_so", programId)
                .stream()
                .map(r -> new TuanDacBiet(
                        ((Number) r.get("tuan_so")).intValue(),
                        (String) r.get("loai"),
                        (String) r.get("ma_mach"),
                        (String) r.get("nhan")))
                .toList();

        return new CauHinhChuan(soTuan, tuanKy1, tietMotTuan, mach, tuanDacBiet);
    }

    /**
     * Một từ khóa nhận dạng mạch: cặp (mã mạch, cụm từ).
     * {@link PpctSuyMach} dùng danh sách này để build Pattern trong memory.
     */
    public record TuKhoa(String maMach, String tuKhoa) {}

    /**
     * Tải danh sách từ khóa nhận dạng mạch từ DB.
     * Nếu chương trình chưa có từ khóa nào thì trả danh sách rỗng — {@link PpctSuyMach}
     * sẽ chuyển sang chế độ "chỉ đoán theo số tiết liên mạch" (mức tin cậy THAP nhiều hơn).
     */
    public List<TuKhoa> tuKhoa(long programId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "select ma_mach, tu_khoa from program_mach_tu_khoa " +
                "where program_id=? and deleted_at is null order by ma_mach, id", programId);
        if (rows.isEmpty()) {
            log.warn("Chương trình {} chưa có từ khóa nhận dạng mạch — PpctSuyMach sẽ đoán theo số tiết.", programId);
        }
        List<TuKhoa> result = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            result.add(new TuKhoa((String) r.get("ma_mach"), (String) r.get("tu_khoa")));
        }
        return result;
    }
}
