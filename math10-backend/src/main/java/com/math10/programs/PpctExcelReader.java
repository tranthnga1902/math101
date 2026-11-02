package com.math10.programs;

import com.math10.common.exception.BusinessException;
import com.math10.programs.dto.PpctDtos.Dong;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.WorkbookFactory;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Đọc PPCT dạng bảng phẳng Excel về cùng {@code List<Dong>} như đường PDF.
 *
 * <p>Cùng bộ cột với tệp mẫu của {@code ProgramCourseImportService}:
 * MẠCH · TÊN MẠCH · HỌC KỲ · TIẾT · TUẦN · CHƯƠNG · TÊN CHƯƠNG · BÀI HỌC · LOẠI.
 * PP-7 chỉ ghi {@code program_periods} nên hai cột CHƯƠNG/TÊN CHƯƠNG bị bỏ qua ở đây — dựng
 * cây Chương là việc của đường nhập bootstrap ({@code ProgramCourseImportController}), tách hẳn.
 *
 * <p><b>Bảng người soạn tay thì soi chặt.</b> Khác đường PDF (máy đoán, nhiều mức tin cậy),
 * tệp Excel là bảng có cấu trúc: số không đọc được hoặc học kỳ ngoài {1,2} là lỗi dừng, không
 * đoán bừa. {@code doTinCay} mặc định {@code CAO}; chỉ hạ xuống {@code VUA} kèm cảnh báo khi cột
 * LOẠI ghi giá trị lạ.
 *
 * <p>Thuần, không DB — giống {@link PpctExtractor}/{@link PpctSuyMach}.
 */
public final class PpctExcelReader {

    private static final int TOI_DA_DONG = 5000;

    private PpctExcelReader() {}

    public static List<Dong> doc(byte[] bytes) {
        try (var wb = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
            Sheet sheet = Optional.ofNullable(wb.getSheet("Dữ liệu")).orElse(wb.getSheetAt(0));
            if (sheet == null) throw new BusinessException("Tệp Excel không có trang tính nào");
            DataFormatter f = new DataFormatter();

            Map<String, Integer> cot = cot(sheet.getRow(0), f);
            for (String x : new String[]{"MẠCH", "HỌC KỲ", "TIẾT", "TUẦN", "BÀI HỌC", "LOẠI"}) {
                if (!cot.containsKey(x)) throw new BusinessException("Tệp Excel thiếu cột \"" + x + "\"");
            }
            int cMaMach = cot.get("MẠCH");
            int cTenMach = cot.getOrDefault("TÊN MẠCH", cMaMach);
            int cHocKy = cot.get("HỌC KỲ");
            int cTiet = cot.get("TIẾT");
            int cTuan = cot.get("TUẦN");
            int cBaiHoc = cot.get("BÀI HỌC");
            int cLoai = cot.get("LOẠI");

            List<Dong> ra = new ArrayList<>();
            for (int i = 1; i <= sheet.getLastRowNum() && ra.size() < TOI_DA_DONG; i++) {
                Row r = sheet.getRow(i);
                if (r == null) continue;
                String maMach = text(r, cMaMach, f);
                if (maMach.isBlank()) continue;

                int soTiet, tuan, hocKy;
                try {
                    soTiet = so(text(r, cTiet, f));
                    tuan = so(text(r, cTuan, f));
                    hocKy = so(text(r, cHocKy, f));
                } catch (NumberFormatException e) {
                    throw new BusinessException("Dòng " + (i + 1)
                            + " có giá trị số không hợp lệ (TIẾT/TUẦN/HỌC KỲ)");
                }
                if (hocKy < 1 || hocKy > 2)
                    throw new BusinessException("Dòng " + (i + 1) + " có HỌC KỲ ngoài {1, 2}");
                if (soTiet < 1 || tuan < 1)
                    throw new BusinessException("Dòng " + (i + 1) + " có TIẾT/TUẦN nhỏ hơn 1");

                String tenMach = text(r, cTenMach, f);
                if (tenMach.isBlank()) tenMach = maMach;
                String tieuDe = text(r, cBaiHoc, f);
                if (tieuDe.isBlank()) tieuDe = tenMach + " · tiết " + soTiet;

                List<String> canhBao = new ArrayList<>();
                String phanLoai = phanLoai(text(r, cLoai, f), canhBao);
                String tin = canhBao.isEmpty() ? PpctSuyMach.CAO : PpctSuyMach.VUA;

                ra.add(new Dong(ra.size(), maMach.toUpperCase(Locale.ROOT), tenMach, soTiet, tuan,
                        hocKy, phanLoai, tieuDe, null, null, tin, canhBao));
            }
            if (ra.isEmpty())
                throw new BusinessException("Tệp Excel không có dòng dữ liệu nào ở trang \"Dữ liệu\"");
            return ra;
        } catch (BusinessException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("Không đọc được tệp Excel PPCT: " + e.getMessage());
        }
    }

    /** LOẠI: nhận cả từ mẫu mới (LESSON/REVIEW/EXAM/PRACTICE) lẫn mã cũ, quy về tập của CHECK. */
    private static String phanLoai(String raw, List<String> canhBao) {
        return switch (raw.trim().toUpperCase(Locale.ROOT)) {
            case "EXAM", "KIEM_TRA", "KT" -> "KIEM_TRA";
            case "REVIEW", "ON_TAP", "ÔN TẬP" -> "ON_TAP";
            case "PRACTICE", "THUC_HANH", "HĐTH&TN" -> "THUC_HANH";
            case "LESSON", "BAI_MOI", "" -> "BAI_MOI";
            default -> {
                canhBao.add("Loại tiết \"" + raw.trim() + "\" không nhận ra — tạm xếp Bài mới");
                yield "BAI_MOI";
            }
        };
    }

    private static Map<String, Integer> cot(Row r, DataFormatter f) {
        Map<String, Integer> m = new HashMap<>();
        if (r != null) for (Cell c : r) m.put(f.formatCellValue(c).trim().toUpperCase(Locale.ROOT), c.getColumnIndex());
        return m;
    }

    private static String text(Row r, int c, DataFormatter f) {
        return f.formatCellValue(r.getCell(c)).trim();
    }

    private static int so(String x) {
        return Integer.parseInt(x.replace(".0", "").trim());
    }
}
