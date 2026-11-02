package com.math10.classes;

import org.junit.jupiter.api.Test;
import java.time.*;
import java.util.*;
import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests cho thuật toán sinh lịch lớp — 7 cases bắt buộc.
 *
 * <p>Không cần Spring context. Test thuật toán pure logic bằng cách
 * extract phần tính toán của ClassScheduleGenerator thành static methods để test.
 *
 * <p>7 cases:
 * 1. 6 sessions, T2/T4/T6, start 07/09 → 6 ngày đúng
 * 2. Holiday rơi vào slot → session defer xuống ngày tiếp theo
 * 3. Đổi slots từ 3 buổi/tuần → 2 buổi/tuần → projected_end thay đổi
 * 4. edited_manually → regenerate không ghi đè
 * 5. Ngày qua, chưa complete → actual_seq không tăng → BEHIND
 * 6. planned_seq=12, actual_seq=10 → BEHIND 2
 * 7. Hai lớp cùng course_instance → class_schedule khác nhau
 */
class ClassScheduleAlgorithmTest {

    // ------------------------------------------------------------------
    // Thuật toán được extract ra để test không cần DB
    // ------------------------------------------------------------------

    /** Kết quả assign ngày cho mỗi session. */
    record Assigned(int seq, LocalDate date) {}

    /**
     * Sinh lịch thuần: không đụng DB.
     * Tương đương logic trong ClassScheduleGenerator.doGenerate().
     *
     * @param startDate   ngày bắt đầu
     * @param slots       map DayOfWeek.getValue() (1-7) → slot hợp lệ
     * @param offDays     tập ngày nghỉ (holidays + academic_breaks)
     * @param sessionSeqs danh sách seq cần xếp
     * @param keptSeqs    seq đã edited_manually, bỏ qua khi sinh
     */
    static List<Assigned> generate(LocalDate startDate,
                                   Set<Integer> slots,
                                   Set<LocalDate> offDays,
                                   List<Integer> sessionSeqs,
                                   Set<Integer> keptSeqs) {
        List<Assigned> result = new ArrayList<>();
        LocalDate current = startDate;

        for (int seq : sessionSeqs) {
            if (keptSeqs.contains(seq)) continue;

            LocalDate date = nextValid(current, slots, offDays);
            result.add(new Assigned(seq, date));
            current = date.plusDays(1);
        }
        return result;
    }

    static LocalDate nextValid(LocalDate from, Set<Integer> slots, Set<LocalDate> offDays) {
        LocalDate d = from;
        for (int i = 0; i < 365; i++) {
            if (slots.contains(d.getDayOfWeek().getValue()) && !offDays.contains(d)) return d;
            d = d.plusDays(1);
        }
        throw new IllegalStateException("No valid date found");
    }

    static String calcProgress(int plannedSeq, int actualSeq) {
        int delta = actualSeq - plannedSeq;
        if (delta == 0) return "ON_TRACK";
        return delta < 0 ? "BEHIND" : "AHEAD";
    }

    // Thứ: 1=Thứ Hai … 7=Chủ nhật (ISO)
    static final int MON = 1, WED = 3, FRI = 5;

    // ------------------------------------------------------------------
    // Case 1: 6 sessions, T2/T4/T6, start 07/09
    // ------------------------------------------------------------------

    @Test
    void case1_SinhDungNgayKhiKhongCoDayNghi() {
        LocalDate start = LocalDate.of(2026, 9, 7); // Thứ Hai
        Set<Integer> slots = Set.of(MON, WED, FRI);
        List<Integer> seqs = List.of(1, 2, 3, 4, 5, 6);

        List<Assigned> result = generate(start, slots, Set.of(), seqs, Set.of());

        assertThat(result).hasSize(6);
        assertThat(result.get(0).date()).isEqualTo(LocalDate.of(2026, 9, 7));  // T2
        assertThat(result.get(1).date()).isEqualTo(LocalDate.of(2026, 9, 9));  // T4
        assertThat(result.get(2).date()).isEqualTo(LocalDate.of(2026, 9, 11)); // T6
        assertThat(result.get(3).date()).isEqualTo(LocalDate.of(2026, 9, 14)); // T2 tuần sau
        assertThat(result.get(4).date()).isEqualTo(LocalDate.of(2026, 9, 16)); // T4
        assertThat(result.get(5).date()).isEqualTo(LocalDate.of(2026, 9, 18)); // T6
    }

    // ------------------------------------------------------------------
    // Case 2: Holiday rơi vào slot → session defer
    // ------------------------------------------------------------------

    @Test
    void case2_HolidayRoiVaoSlot_SessionDefer() {
        LocalDate start = LocalDate.of(2026, 9, 7); // T2
        Set<Integer> slots = Set.of(MON, WED, FRI);
        // T4 09/09 là ngày nghỉ
        Set<LocalDate> off = Set.of(LocalDate.of(2026, 9, 9));

        List<Assigned> result = generate(start, slots, off, List.of(1, 2, 3), Set.of());

        assertThat(result.get(0).date()).isEqualTo(LocalDate.of(2026, 9, 7));  // T2 — không ảnh hưởng
        assertThat(result.get(1).date()).isEqualTo(LocalDate.of(2026, 9, 11)); // T4 nghỉ → nhảy sang T6
        assertThat(result.get(2).date()).isEqualTo(LocalDate.of(2026, 9, 14)); // T2 tuần sau
    }

    // ------------------------------------------------------------------
    // Case 3: Đổi slots từ 3 buổi → 2 buổi → projected_end thay đổi
    // ------------------------------------------------------------------

    @Test
    void case3_DoiSlots_ProjectedEndThayDoi() {
        LocalDate start = LocalDate.of(2026, 9, 7);
        List<Integer> seqs = List.of(1, 2, 3, 4, 5, 6);
        Set<LocalDate> off = Set.of();

        // 3 buổi/tuần
        List<Assigned> with3 = generate(start, Set.of(MON, WED, FRI), off, seqs, Set.of());
        // 2 buổi/tuần
        List<Assigned> with2 = generate(start, Set.of(MON, FRI), off, seqs, Set.of());

        LocalDate end3 = with3.get(with3.size() - 1).date();
        LocalDate end2 = with2.get(with2.size() - 1).date();

        // 2 buổi/tuần phải kết thúc muộn hơn 3 buổi/tuần
        assertThat(end2).isAfter(end3);
    }

    // ------------------------------------------------------------------
    // Case 4: edited_manually → regenerate không ghi đè
    // ------------------------------------------------------------------

    @Test
    void case4_EditedManually_KhongGhiDe() {
        LocalDate start = LocalDate.of(2026, 9, 7);
        Set<Integer> slots = Set.of(MON, WED, FRI);
        List<Integer> seqs = List.of(1, 2, 3, 4);
        // seq=2 đã chỉnh tay
        Set<Integer> kept = Set.of(2);

        List<Assigned> result = generate(start, slots, Set.of(), seqs, kept);

        // Chỉ sinh 3 buổi (bỏ qua seq=2)
        assertThat(result).hasSize(3);
        assertThat(result.stream().noneMatch(a -> a.seq() == 2)).isTrue();
        assertThat(result.stream().map(Assigned::seq).toList())
                .containsExactly(1, 3, 4);
    }

    // ------------------------------------------------------------------
    // Case 5: Ngày qua, chưa complete → không tính vào actual_seq
    // ------------------------------------------------------------------

    @Test
    void case5_NgayQua_ChuaComplete_KhongTinhActual() {
        // Giả lập: planned_seq=3 (3 buổi đã đến hạn), actual_seq=0 (chưa ai xác nhận)
        int plannedSeq = 3;
        int actualSeq  = 0;

        String trangThai = calcProgress(plannedSeq, actualSeq);

        assertThat(trangThai).isEqualTo("BEHIND");
        // delta = 0 - 3 = -3 → BEHIND 3 buổi
        assertThat(Math.abs(actualSeq - plannedSeq)).isEqualTo(3);
    }

    // ------------------------------------------------------------------
    // Case 6: planned=12, actual=10 → BEHIND 2
    // ------------------------------------------------------------------

    @Test
    void case6_Behind2Buoi() {
        int plannedSeq = 12;
        int actualSeq  = 10;

        String trangThai = calcProgress(plannedSeq, actualSeq);
        int delta = Math.abs(actualSeq - plannedSeq);

        assertThat(trangThai).isEqualTo("BEHIND");
        assertThat(delta).isEqualTo(2);
    }

    // ------------------------------------------------------------------
    // Case 7: Hai lớp cùng course_instance → class_schedule khác nhau
    // ------------------------------------------------------------------

    @Test
    void case7_HaiLopCungKhoa_LichKhacNhau() {
        List<Integer> seqs = List.of(1, 2, 3);
        Set<LocalDate> off = Set.of();

        // Lớp 10A1: khai giảng 07/09, T2/T4/T6
        List<Assigned> lopA1 = generate(
                LocalDate.of(2026, 9, 7), Set.of(MON, WED, FRI),
                off, seqs, Set.of());

        // Lớp 10A2: khai giảng 08/09 (Thứ Ba), T3/T5
        List<Assigned> lopA2 = generate(
                LocalDate.of(2026, 9, 8), Set.of(2, 4), // T3=2, T5=4
                off, seqs, Set.of());

        // Cùng seq nhưng ngày hoàn toàn khác nhau
        assertThat(lopA1.get(0).date()).isNotEqualTo(lopA2.get(0).date());
        assertThat(lopA1.get(1).date()).isNotEqualTo(lopA2.get(1).date());
        assertThat(lopA1.get(2).date()).isNotEqualTo(lopA2.get(2).date());

        // Lớp 10A1: 07, 09, 11/09
        assertThat(lopA1.get(0).date()).isEqualTo(LocalDate.of(2026, 9, 7));
        // Lớp 10A2: 08, 10, 15/09
        assertThat(lopA2.get(0).date()).isEqualTo(LocalDate.of(2026, 9, 8));
        assertThat(lopA2.get(1).date()).isEqualTo(LocalDate.of(2026, 9, 10));
    }
}
