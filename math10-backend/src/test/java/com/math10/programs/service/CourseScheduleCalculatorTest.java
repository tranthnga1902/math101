package com.math10.programs.service;

import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests cho {@link CourseScheduleCalculator}.
 *
 * <p>Tất cả test chạy mà không cần Spring context (không có DB, không có @SpringBootTest).
 * CourseScheduleCalculator.generate() là pure function (ngoài tinhTienDo dùng JdbcTemplate).
 *
 * <p><b>10 test cases bắt buộc:</b>
 * <ol>
 *   <li>Sinh đúng số session khi không có ngày nghỉ.
 *   <li>Bỏ qua ngày rơi vào kỳ nghỉ.
 *   <li>Session có edited_manually=true không bị ghi đè.
 *   <li>Khi không có slot nào, trả về feasible=false và session rỗng.
 *   <li>Khi không có plan_items nào, trả về feasible=false và session rỗng.
 *   <li>Ngày nghỉ phủ nhiều ngày liên tiếp — các tiết được đẩy đúng sang ngày sau kỳ nghỉ.
 *   <li>Tổng số tiết khả dụng ít hơn tổng tiết cần — warning và feasible=false.
 *   <li>projectedEndDate = ngày của session cuối cùng (không phải ends_on của khóa).
 *   <li>Nhiều tiết trong một ngày (periodCount > 1) — orderOnDate tăng đúng.
 *   <li>Session tự động + session chỉnh tay cùng tồn tại — orderOnDate không chồng chéo.
 * </ol>
 */
class CourseScheduleCalculatorTest {

    // Calculator không cần DB khi gọi generate() — truyền null JdbcTemplate là an toàn.
    private final CourseScheduleCalculator calc = new CourseScheduleCalculator(null);

    /** Tạo plan item đơn giản (id, weekNumber, orderInWeek, programPeriodId). */
    private static CourseScheduleCalculator.TeachingPlanItem item(long id, int week, int order, long periodId) {
        return new CourseScheduleCalculator.TeachingPlanItem(id, week, order, periodId);
    }

    private static CourseScheduleCalculator.LichTuanSlot slot(DayOfWeek day, int count) {
        return new CourseScheduleCalculator.LichTuanSlot(day, count);
    }

    private static CourseScheduleCalculator.NgayNghi holiday(String from, String to) {
        return new CourseScheduleCalculator.NgayNghi(LocalDate.parse(from), LocalDate.parse(to));
    }

    // -----------------------------------------------------------------------
    // Test 1: Sinh đúng số session khi không có ngày nghỉ
    // -----------------------------------------------------------------------
    @Test
    void test1_sinhDungSoSession() {
        // 3 tiết/tuần, dạy Thứ 2, Thứ 4, Thứ 6; kế hoạch có 6 tiết → cần 2 tuần
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(
                slot(DayOfWeek.MONDAY, 1), slot(DayOfWeek.WEDNESDAY, 1), slot(DayOfWeek.FRIDAY, 1));
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(
                item(1, 1, 1, 101), item(2, 1, 2, 102), item(3, 1, 3, 103),
                item(4, 2, 1, 104), item(5, 2, 2, 105), item(6, 2, 3, 106));

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-07"), null, slots, List.of(), items, List.of());

        assertThat(kq.sessions()).hasSize(6);
        assertThat(kq.totalRequired()).isEqualTo(6);
        assertThat(kq.feasible()).isTrue();
        assertThat(kq.warning()).isNull();
    }

    // -----------------------------------------------------------------------
    // Test 2: Bỏ qua ngày rơi vào kỳ nghỉ
    // -----------------------------------------------------------------------
    @Test
    void test2_boQuaNgayNghi() {
        // Dạy Thứ 2 và Thứ 4; Thứ 2 đầu tiên (2026-09-07) là ngày nghỉ
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(
                slot(DayOfWeek.MONDAY, 1), slot(DayOfWeek.WEDNESDAY, 1));
        List<CourseScheduleCalculator.NgayNghi> holidays = List.of(
                holiday("2026-09-07", "2026-09-07")); // nghỉ đúng ngày Thứ 2 đầu tiên
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(item(1, 1, 1, 101));

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-07"), null, slots, holidays, items, List.of());

        assertThat(kq.sessions()).hasSize(1);
        // Tiết phải dời sang Thứ 4 (2026-09-09), không phải Thứ 2
        assertThat(kq.sessions().get(0).plannedDate())
                .isEqualTo(LocalDate.parse("2026-09-09"));
    }

    // -----------------------------------------------------------------------
    // Test 3: Session edited_manually không bị ghi đè
    // -----------------------------------------------------------------------
    @Test
    void test3_giu_lai_session_chinh_tay() {
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(slot(DayOfWeek.MONDAY, 1));
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(item(1, 1, 1, 101));

        // Có session chỉnh tay: period 101, đặt vào ngày Chủ nhật (ngày bất thường)
        LocalDate customDate = LocalDate.parse("2026-09-13"); // Chủ nhật
        List<CourseScheduleCalculator.ExistingSession> existing = List.of(
                new CourseScheduleCalculator.ExistingSession(999L, 101L, customDate, 1, true));

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-07"), null, slots, List.of(), items, existing);

        assertThat(kq.sessions()).hasSize(1);
        CourseScheduleCalculator.GeneratedSession s = kq.sessions().get(0);
        assertThat(s.editedManually()).isTrue();
        assertThat(s.plannedDate()).isEqualTo(customDate);    // giữ nguyên Chủ nhật
        assertThat(s.existingId()).isEqualTo(999L);
    }

    // -----------------------------------------------------------------------
    // Test 4: Không có slot → feasible=false, sessions rỗng
    // -----------------------------------------------------------------------
    @Test
    void test4_khongCoSlot_traFeasibleFalse() {
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(item(1, 1, 1, 101));

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-07"), null, List.of(), List.of(), items, List.of());

        assertThat(kq.sessions()).isEmpty();
        assertThat(kq.feasible()).isFalse();
        assertThat(kq.warning()).isNotBlank();
    }

    // -----------------------------------------------------------------------
    // Test 5: Không có plan items → sessions rỗng
    // -----------------------------------------------------------------------
    @Test
    void test5_khongCoPlanItems_traRong() {
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(slot(DayOfWeek.MONDAY, 1));

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-07"), null, slots, List.of(), List.of(), List.of());

        assertThat(kq.sessions()).isEmpty();
        assertThat(kq.feasible()).isFalse();
    }

    // -----------------------------------------------------------------------
    // Test 6: Kỳ nghỉ phủ nhiều ngày liên tiếp
    // -----------------------------------------------------------------------
    @Test
    void test6_kyNghiDaiNgay() {
        // Dạy Thứ 2 và Thứ 4; tuần đầu nghỉ cả tuần → tất cả tiết dồn sang tuần sau
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(
                slot(DayOfWeek.MONDAY, 1), slot(DayOfWeek.WEDNESDAY, 1));
        List<CourseScheduleCalculator.NgayNghi> holidays = List.of(
                holiday("2026-09-07", "2026-09-13")); // nghỉ cả tuần đầu
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(
                item(1, 1, 1, 101), item(2, 1, 2, 102));

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-07"), null, slots, holidays, items, List.of());

        assertThat(kq.sessions()).hasSize(2);
        // Tiết đầu phải vào Thứ 2 tuần tiếp theo (2026-09-14)
        assertThat(kq.sessions().get(0).plannedDate())
                .isEqualTo(LocalDate.parse("2026-09-14"));
        // Tiết thứ hai vào Thứ 4 tuần tiếp (2026-09-16)
        assertThat(kq.sessions().get(1).plannedDate())
                .isEqualTo(LocalDate.parse("2026-09-16"));
    }

    // -----------------------------------------------------------------------
    // Test 7: Số tiết khả dụng ít hơn yêu cầu → warning và feasible=false
    // -----------------------------------------------------------------------
    @Test
    void test7_soTietKhaDungItHonYeuCau() {
        // Chỉ dạy 2 ngày trong target, nhưng kế hoạch có 5 tiết
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(slot(DayOfWeek.MONDAY, 1));
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(
                item(1, 1, 1, 101), item(2, 1, 2, 102), item(3, 1, 3, 103),
                item(4, 2, 1, 104), item(5, 2, 2, 105));

        // targetEndsOn = chỉ có 1 thứ Hai trong khoảng (2026-09-07 → 2026-09-08)
        LocalDate start = LocalDate.parse("2026-09-07");       // Thứ Hai
        LocalDate target = LocalDate.parse("2026-09-08");      // Thứ Ba → chỉ 1 slot

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, start, target, slots, List.of(), items, List.of());

        // Chỉ 1 tiết khả dụng trong target nhưng cần 5 → feasible=false
        assertThat(kq.feasible()).isFalse();
        // Warning phải có (ASCII-safe substring tránh encoding issue)
        assertThat(kq.warning()).isNotNull().isNotEmpty();
    }

    // -----------------------------------------------------------------------
    // Test 8: projectedEndDate = ngày của session cuối cùng
    // -----------------------------------------------------------------------
    @Test
    void test8_projectedEndDate() {
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(
                slot(DayOfWeek.MONDAY, 1), slot(DayOfWeek.FRIDAY, 1));
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(
                item(1, 1, 1, 101), item(2, 1, 2, 102), item(3, 2, 1, 103));
        // Thứ 2: 2026-09-07, Thứ 6: 2026-09-11, Thứ 2: 2026-09-14
        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-07"), null, slots, List.of(), items, List.of());

        assertThat(kq.projectedEndDate()).isEqualTo(LocalDate.parse("2026-09-14"));
    }

    // -----------------------------------------------------------------------
    // Test 9: Nhiều tiết/ngày (periodCount > 1)
    // -----------------------------------------------------------------------
    @Test
    void test9_nhietTietTrongNgay() {
        // Thứ 2 dạy 3 tiết/buổi; kế hoạch 3 tiết → tất cả trong 1 ngày
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(slot(DayOfWeek.MONDAY, 3));
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(
                item(1, 1, 1, 101), item(2, 1, 2, 102), item(3, 1, 3, 103));

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-07"), null, slots, List.of(), items, List.of());

        assertThat(kq.sessions()).hasSize(3);
        // Tất cả cùng ngày
        assertThat(kq.sessions()).allMatch(s -> s.plannedDate().equals(LocalDate.parse("2026-09-07")));
        // Thứ tự trong ngày: 1, 2, 3
        assertThat(kq.sessions().get(0).plannedOrderOnDate()).isEqualTo(1);
        assertThat(kq.sessions().get(1).plannedOrderOnDate()).isEqualTo(2);
        assertThat(kq.sessions().get(2).plannedOrderOnDate()).isEqualTo(3);
    }

    // -----------------------------------------------------------------------
    // Test 10: Kết hợp session tự động và session chỉnh tay — orderOnDate không chồng chéo
    // -----------------------------------------------------------------------
    @Test
    void test10_ketHopTuDongVaChinhTay() {
        // Thứ 4 dạy 2 tiết; kế hoạch 4 tiết
        List<CourseScheduleCalculator.LichTuanSlot> slots = List.of(slot(DayOfWeek.WEDNESDAY, 2));
        List<CourseScheduleCalculator.TeachingPlanItem> items = List.of(
                item(1, 1, 1, 101), item(2, 1, 2, 102),
                item(3, 2, 1, 103), item(4, 2, 2, 104));

        // Period 102 đã chỉnh tay sang Thứ 6 (2026-09-11)
        List<CourseScheduleCalculator.ExistingSession> existing = List.of(
                new CourseScheduleCalculator.ExistingSession(888L, 102L, LocalDate.parse("2026-09-11"), 1, true));

        CourseScheduleCalculator.KetQua kq = calc.generate(
                1L, LocalDate.parse("2026-09-09"), null, slots, List.of(), items, existing);

        assertThat(kq.sessions()).hasSize(4);

        // Session chỉnh tay phải ở ngày Thứ 6
        CourseScheduleCalculator.GeneratedSession manual = kq.sessions().stream()
                .filter(s -> s.programPeriodId() == 102L)
                .findFirst().orElseThrow();
        assertThat(manual.editedManually()).isTrue();
        assertThat(manual.plannedDate()).isEqualTo(LocalDate.parse("2026-09-11"));

        // Session tự động 101 phải ở Thứ 4 2026-09-09, orderOnDate = 1
        CourseScheduleCalculator.GeneratedSession auto101 = kq.sessions().stream()
                .filter(s -> s.programPeriodId() == 101L)
                .findFirst().orElseThrow();
        assertThat(auto101.plannedDate()).isEqualTo(LocalDate.parse("2026-09-09"));
        assertThat(auto101.plannedOrderOnDate()).isEqualTo(1);

        // Tổng session feasible (có thể true hoặc false tùy số slot) — quan trọng là sessions.size() = 4
        assertThat(kq.totalRequired()).isEqualTo(4);
    }
}
