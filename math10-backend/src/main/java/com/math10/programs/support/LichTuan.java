package com.math10.programs.support;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Trải 35 tuần chương trình lên lịch thật của một khóa.
 *
 * <p>Lớp này không đụng CSDL, và đó là điểm chính: <b>xem trước và ghi thật phải đi qua đúng hàm
 * này</b>. Nếu màn xem trước tự tính một kiểu còn lượt ghi tính một kiểu khác thì cái admin nhìn
 * thấy trước khi bấm không còn là cái sẽ được lưu — mà toàn bộ lý do có màn xem trước là để không ai
 * bất ngờ.
 *
 * <p><b>Ba điểm dễ sai, cả ba đều nằm trong {@link #sinh}.</b>
 *
 * <ol>
 *   <li><b>Neo về thứ Hai.</b> Admin chọn ngày khai giảng 05/09 nhằm thứ Bảy thì tuần 1 vẫn bắt đầu
 *       từ thứ Hai 31/08. Tuần học là đơn vị của thời khóa biểu, không phải bảy ngày kể từ hôm khai
 *       giảng.
 *   <li><b>Tuần nghỉ không tiêu số tuần.</b> Một tuần bị kỳ nghỉ phủ kín vẫn có dòng trong lịch —
 *       để màn hình nói được "đang nghỉ Tết, học lại ngày nào" — nhưng không mang số tuần. Bộ đếm
 *       chương trình đứng yên và tiếp tục ở tuần dương lịch kế tiếp.
 *   <li><b>Tuần đã sửa tay giữ nguyên ngày.</b> Lượt sinh gặp số tuần đã bị chỉnh thì dùng lại ngày
 *       của nó rồi đi tiếp từ đó, chứ không tính lại. Đây là chỗ để nghỉ bão và dạy bù đi vào lịch
 *       mà không cần bộ sinh hiểu vì sao.
 * </ol>
 *
 * <p><b>Phủ kín mới là nghỉ.</b> Kỳ nghỉ hai ngày giữa tuần không làm tuần ấy biến mất — vẫn dạy,
 * chỉ mất hai buổi. Chỉ khi cả bảy ngày đều nằm trong kỳ nghỉ thì tuần đó mới không tiêu số tuần.
 * Xét theo hợp của các kỳ nghỉ chứ không theo từng kỳ riêng lẻ, vì nghỉ Tết chín ngày cộng một ngày
 * nghỉ bù nằm chồng lên nhau là dữ liệu người ta thật sự nhập.
 */
public final class LichTuan {
    private LichTuan() {}

    /** Chặn trên số vòng lặp. Kỳ nghỉ dài bất thường không được biến lượt sinh thành vòng vô tận. */
    private static final int TRAN_VONG = 400;

    public record KyNghi(LocalDate tu, LocalDate den, String lyDo) {}

    /**
     * Một dòng lịch. {@code soTuan} rỗng nghĩa là tuần nghỉ — hai thứ đó luôn đi cùng nhau, và CSDL
     * cũng canh bằng ràng buộc {@code ck_course_week_break}.
     */
    public record Tuan(Integer soTuan, LocalDate batDau, LocalDate ketThuc,
                       boolean nghi, String nhanNghi, boolean suaTay) {}

    /** Thứ Hai của tuần chứa ngày này. Thứ Bảy 05/09/2026 trả về 31/08/2026. */
    public static LocalDate thuHaiCua(LocalDate ngay) {
        return ngay.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    }

    /**
     * @param moc        thứ Hai đầu tiên được phép cấp phát; hàm tự neo lại cho chắc
     * @param soBatDau   số tuần chương trình đầu tiên cần sinh (1 nếu làm lại từ đầu)
     * @param soTuanHet  số tuần cuối cùng của chương trình, thường là 35
     * @param nghi       các kỳ nghỉ của khóa, lấy qua {@code AcademicBreaks}
     * @param suaTay     tuần đã chỉnh tay, tra theo số tuần; ngày của chúng được giữ nguyên
     */
    public static List<Tuan> sinh(LocalDate moc, int soBatDau, int soTuanHet,
                                  List<KyNghi> nghi, Map<Integer, Tuan> suaTay) {
        List<Tuan> ra = new ArrayList<>();
        LocalDate con = thuHaiCua(moc);
        int so = soBatDau;
        for (int vong = 0; so <= soTuanHet && vong < TRAN_VONG; vong++) {
            Tuan tay = suaTay.get(so);
            if (tay != null) {
                ra.add(new Tuan(so, tay.batDau(), tay.ketThuc(), false, null, true));
                // Neo lại về thứ Hai sau khi đi qua một tuần đã sửa tay. Dạy bù kéo dài sang thứ Ba
                // thì tuần kế tiếp vẫn phải bắt đầu vào thứ Hai — cộng thẳng một ngày sẽ làm cả phần
                // lịch còn lại trôi lệch khỏi thứ Hai và không bao giờ về lại.
                con = tay.ketThuc().plusDays(1).with(TemporalAdjusters.nextOrSame(DayOfWeek.MONDAY));
                so++;
                continue;
            }
            LocalDate cuoi = con.plusDays(6);
            String nhan = nhanNghiPhuKin(con, cuoi, nghi);
            if (nhan != null) {
                ra.add(new Tuan(null, con, cuoi, true, nhan, false));
            } else {
                ra.add(new Tuan(so, con, cuoi, false, null, false));
                so++;
            }
            con = cuoi.plusDays(1);
        }
        return ra;
    }

    /**
     * Nhãn kỳ nghỉ nếu cả bảy ngày đều bị phủ, ngược lại {@code null}.
     *
     * <p>Nhãn lấy từ kỳ nghỉ bắt đầu sớm nhất trong số các kỳ chạm vào tuần này: khi Tết và một ngày
     * nghỉ bù chồng lên nhau, thứ người ta muốn đọc trên lịch là "Tết".
     */
    private static String nhanNghiPhuKin(LocalDate dau, LocalDate cuoi, List<KyNghi> nghi) {
        for (LocalDate d = dau; !d.isAfter(cuoi); d = d.plusDays(1)) {
            boolean coAiPhu = false;
            for (KyNghi k : nghi) if (!d.isBefore(k.tu()) && !d.isAfter(k.den())) { coAiPhu = true; break; }
            if (!coAiPhu) return null;
        }
        return nghi.stream()
                .filter(k -> !k.tu().isAfter(cuoi) && !k.den().isBefore(dau))
                .min(java.util.Comparator.comparing(KyNghi::tu))
                .map(KyNghi::lyDo).orElse(null);
    }
}
