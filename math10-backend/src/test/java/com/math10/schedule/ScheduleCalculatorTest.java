package com.math10.schedule;

import com.math10.schedule.ScheduleDtos.*;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ScheduleCalculatorTest — kiểm tra tính toán lịch và ngày kết thúc (G8)")
class ScheduleCalculatorTest {

    private final SlotDto slotTue = new SlotDto(1L, 2, LocalTime.of(19, 30), 90, 2); // Thứ Ba 2 tiết
    private final SlotDto slotFri = new SlotDto(2L, 5, LocalTime.of(19, 30), 90, 2); // Thứ Sáu 2 tiết

    @Nested
    @DisplayName("Tính lịch cơ bản không nghỉ")
    class BasicCalculation {

        @Test
        @DisplayName("105 tiết, 2 slot × 2 tiết/tuần = 4 tiết/tuần, bắt đầu 07/09/2026 → 27 tuần, 53 buổi full + 1 buổi 1 tiết = 54 buổi")
        void tinhLich105TietHaiSlot() {
            LocalDate start = LocalDate.of(2026, 9, 7); // Thứ Hai 07/09/2026
            List<SlotDto> slots = List.of(slotTue, slotFri);

            CalculateResult res = ScheduleCalculatorService.compute(slots, start, 105, List.of(), List.of());

            // 105 / 4 = 26.25 -> 27 tuần
            assertThat(res.weeks()).isEqualTo(27);
            // 26 tuần × 2 buổi = 52 buổi (104 tiết) + 1 buổi tuần 27 (1 tiết) = 53 buổi thật sự diễn ra
            assertThat(res.sessions()).isEqualTo(53);
            assertThat(res.lastSessionPeriods()).isEqualTo(1); // 105 % 4 = 1
            // Buổi cuối rơi vào Thứ Ba của tuần 27
            assertThat(res.endDate()).isAfter(LocalDate.of(2027, 3, 1));
        }

        @Test
        @DisplayName("105 tiết, 3 slot × 2 tiết/tuần = 6 tiết/tuần → 18 tuần")
        void tinhLichBaSlot() {
            LocalDate start = LocalDate.of(2026, 9, 7);
            SlotDto slotSun = new SlotDto(3L, 7, LocalTime.of(8, 0), 90, 2); // Chủ nhật
            List<SlotDto> slots = List.of(slotTue, slotFri, slotSun);

            CalculateResult res = ScheduleCalculatorService.compute(slots, start, 105, List.of(), List.of());

            assertThat(res.weeks()).isEqualTo(18); // ceil(105/6) = 18
        }
    }

    @Nested
    @DisplayName("Kỳ nghỉ và ngày lễ")
    class BreaksAndHolidays {

        @Test
        @DisplayName("Chèn kỳ nghỉ Tết 2 tuần thì ngày kết thúc dời đúng 2 tuần")
        void chenKyNghiTet() {
            LocalDate start = LocalDate.of(2026, 9, 7);
            List<SlotDto> slots = List.of(slotTue, slotFri);

            // Không nghỉ
            CalculateResult noBreak = ScheduleCalculatorService.compute(slots, start, 105, List.of(), List.of());

            // Nghỉ 2 tuần Tết (từ 25/01/2027 đến 07/02/2027)
            List<BreakPeriod> breaks = List.of(
                    new BreakPeriod(LocalDate.of(2027, 1, 25), LocalDate.of(2027, 2, 7), "Nghỉ Tết")
            );
            CalculateResult withBreak = ScheduleCalculatorService.compute(slots, start, 105, breaks, List.of());

            // Ngày kết thúc phải lùi đúng 14 ngày (2 tuần)
            assertThat(withBreak.endDate()).isEqualTo(noBreak.endDate().plusWeeks(2));
        }

        @Test
        @DisplayName("Buổi học rơi vào ngày lễ được ghi nhận vào danh sách holidayHits")
        void phatHienNgayLe() {
            LocalDate start = LocalDate.of(2026, 9, 7);
            // Slot vào Thứ Năm
            SlotDto slotThu = new SlotDto(1L, 4, LocalTime.of(18, 0), 90, 2);

            // Ngày 30/04/2027 rơi vào Thứ Sáu, ngày 01/01/2027 rơi vào Thứ Sáu
            // Đặt ngày lễ vào đúng một ngày học (Thứ Năm 15/10/2026)
            LocalDate specialHoliday = LocalDate.of(2026, 10, 15);
            List<HolidayDto> holidays = List.of(
                    new HolidayDto(1L, specialHoliday, "Lễ kỷ niệm", true, 2026, "")
            );

            CalculateResult res = ScheduleCalculatorService.compute(List.of(slotThu), start, 20, List.of(), holidays);
            assertThat(res.holidayHits()).hasSize(1);
            assertThat(res.holidayHits().get(0).name()).isEqualTo("Lễ kỷ niệm");
        }
    }

    @Nested
    @DisplayName("Tính ngược (calculateReverse)")
    class ReverseCalculation {

        @Test
        @DisplayName("Từ 07/09/2026 đến 14/03/2027 (27 tuần), 105 tiết → yêu cầu xấp xỉ 2 buổi 2 tiết/tuần")
        void tinhNguocSoBuoi() {
            var service = new ScheduleCalculatorService(null);
            ReverseRequest req = new ReverseRequest(
                    LocalDate.of(2026, 9, 7),
                    LocalDate.of(2027, 3, 14),
                    105
            );
            ReverseResult res = service.calculateReverse(req);
            assertThat(res.requiredSessionsPerWeek()).isBetween(1.8, 2.1);
        }
    }
}
