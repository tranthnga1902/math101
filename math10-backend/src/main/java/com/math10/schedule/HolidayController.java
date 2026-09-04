package com.math10.schedule;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.schedule.ScheduleDtos.HolidayDto;
import com.math10.schedule.ScheduleDtos.HolidayUpsert;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Date;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/admin/holidays")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class HolidayController {

    private final JdbcTemplate jdbc;
    private final ScheduleCalculatorService service;

    @GetMapping
    public ApiResponse<List<HolidayDto>> listHolidays(@RequestParam(required = false) Integer year) {
        int y = year != null ? year : LocalDate.now().getYear();
        return ApiResponse.ok("Danh sách ngày lễ năm " + y, service.loadHolidays(y, y));
    }

    @PutMapping
    @Transactional
    public ApiResponse<List<HolidayDto>> upsertHolidays(@RequestBody List<HolidayUpsert> items) {
        if (items == null || items.isEmpty()) {
            throw new BusinessException("Danh sách ngày lễ không được rỗng");
        }

        for (HolidayUpsert h : items) {
            jdbc.update("""
                insert into holidays(holiday_date, name, is_day_off, year, note)
                values (?, ?, ?, ?, ?)
                on conflict (holiday_date) do update
                set name = excluded.name,
                    is_day_off = excluded.is_day_off,
                    year = excluded.year,
                    note = excluded.note
                """, Date.valueOf(h.holidayDate()), h.name(), h.isDayOff(), h.year(), h.note());
        }

        int year = items.get(0).year();
        return ApiResponse.ok("Đã cập nhật danh sách ngày lễ", service.loadHolidays(year, year));
    }
}
