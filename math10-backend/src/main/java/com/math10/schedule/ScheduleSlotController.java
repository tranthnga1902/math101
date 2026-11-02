package com.math10.schedule;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.schedule.ScheduleDtos.SlotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.sql.Time;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@RestController
@RequestMapping("/api/admin/classes/{classId}/schedule-slots")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ScheduleSlotController {

    private final JdbcTemplate jdbc;
    private final ScheduleCalculatorService service;

    @GetMapping
    public ApiResponse<List<SlotDto>> getSlots(@PathVariable long classId) {
        return ApiResponse.ok("Mẫu lịch tuần của lớp", service.loadSlots(classId));
    }

    @PutMapping
    @Transactional
    public ApiResponse<List<SlotDto>> updateSlots(@PathVariable long classId, @RequestBody List<SlotDto> slots) {
        if (slots == null || slots.isEmpty()) {
            throw new BusinessException("Danh sách slot không được rỗng");
        }
        if (slots.size() > 14) {
            throw new BusinessException("Mỗi lớp tối đa 14 slot/tuần (trung bình 2 buổi/ngày)");
        }

        Set<String> seen = new HashSet<>();
        for (SlotDto s : slots) {
            if (s.dayOfWeek() < 1 || s.dayOfWeek() > 7) {
                throw new BusinessException("Thứ trong tuần phải từ 1 (Thứ Hai) đến 7 (Chủ nhật)");
            }
            if (s.durationMin() <= 0) {
                throw new BusinessException("Thời lượng mỗi buổi phải > 0 phút");
            }
            if (s.periods() <= 0) {
                throw new BusinessException("Số tiết mỗi buổi phải > 0");
            }
            String key = s.dayOfWeek() + "#" + s.startTime();
            if (!seen.add(key)) {
                throw new BusinessException("Trùng lịch: Thứ " + s.dayOfWeek() + " lúc " + s.startTime() + " bị khai báo 2 lần");
            }
        }

        // Xóa slot cũ và ghi mới
        jdbc.update("delete from class_schedule_slots where class_id = ?", classId);

        for (SlotDto s : slots) {
            jdbc.update("""
                insert into class_schedule_slots(class_id, day_of_week, start_time, duration_min, periods, created_at, updated_at)
                values (?, ?, ?, ?, ?, now(), now())
                """, classId, s.dayOfWeek(), Time.valueOf(s.startTime()), s.durationMin(), s.periods());
        }

        return ApiResponse.ok("Đã cập nhật mẫu lịch tuần", service.loadSlots(classId));
    }
}
