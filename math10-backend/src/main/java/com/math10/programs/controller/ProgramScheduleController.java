package com.math10.programs.controller;

import com.math10.chapters.entity.Chapter;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.courses.entity.Course;
import com.math10.courses.repository.CourseRepository;
import com.math10.programs.dto.ProgramScheduleDtos;
import com.math10.programs.entity.ProgramSchedule;
import com.math10.programs.repository.ProgramScheduleRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/program-schedules")
public class ProgramScheduleController {
    private final ProgramScheduleRepository schedules;
    private final CourseRepository courses;
    private final ChapterRepository chapters;

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<ProgramScheduleDtos.Response>> list(@RequestParam Long courseId) {
        return ApiResponse.ok("Lịch chương trình", schedules.findByCourseIdOrderByStartsOnAsc(courseId)
                .stream().map(row -> response(row, LocalDate.now())).toList());
    }

    @GetMapping("/current")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ProgramScheduleDtos.Response> current(@RequestParam Long courseId,
                                                             @RequestParam(required = false) LocalDate at) {
        LocalDate date = at == null ? LocalDate.now() : at;
        return ApiResponse.ok("Chương hiện hành", schedules.current(courseId, date)
                .map(row -> response(row, date)).orElse(null));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<ProgramScheduleDtos.Response> create(@Valid @RequestBody ProgramScheduleDtos.Request request) {
        ProgramSchedule row = new ProgramSchedule();
        apply(row, request);
        return ApiResponse.created("Đã thêm lịch chương trình", response(schedules.save(row), LocalDate.now()));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<ProgramScheduleDtos.Response> update(@PathVariable Long id,
                                                             @Valid @RequestBody ProgramScheduleDtos.Request request) {
        ProgramSchedule row = schedule(id);
        apply(row, request);
        return ApiResponse.ok("Đã cập nhật lịch chương trình", response(row, LocalDate.now()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    @Transactional
    public ApiResponse<Void> archive(@PathVariable Long id) {
        schedule(id).markDeleted();
        return ApiResponse.noContent("Đã lưu trữ lịch chương trình");
    }

    private void apply(ProgramSchedule row, ProgramScheduleDtos.Request request) {
        if (request.startsOn().isAfter(request.endsOn())) throw new BusinessException("Ngày bắt đầu phải trước ngày kết thúc");
        Course course = courses.findById(request.courseId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương trình"));
        Chapter chapter = chapters.findById(request.chapterId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương"));
        if (!chapter.getCourseId().equals(course.getId())) throw new BusinessException("Chương không thuộc chương trình đã chọn");
        String status = request.status() == null ? "ACTIVE" : request.status();
        if (!List.of("ACTIVE", "INACTIVE").contains(status)) throw new BusinessException("Trạng thái lịch không hợp lệ");
        long overlaps = "ACTIVE".equals(status)
                ? schedules.countOverlapping(course.getId(), request.startsOn(), request.endsOn(), row.getId() == null ? -1L : row.getId())
                : 0;
        if (overlaps > 0) throw new BusinessException("Khoảng thời gian bị trùng với một chương khác");
        row.setCourseId(course.getId());
        row.setChapterId(chapter.getId());
        row.setStartsOn(request.startsOn());
        row.setEndsOn(request.endsOn());
        row.setStatus(status);
    }

    private ProgramSchedule schedule(Long id) {
        return schedules.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lịch chương trình"));
    }

    private ProgramScheduleDtos.Response response(ProgramSchedule row, LocalDate at) {
        Course course = courses.findById(row.getCourseId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương trình"));
        Chapter chapter = chapters.findById(row.getChapterId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương"));
        boolean current = "ACTIVE".equals(row.getStatus()) && !at.isBefore(row.getStartsOn()) && !at.isAfter(row.getEndsOn());
        return new ProgramScheduleDtos.Response(row.getId(), course.getId(), course.getCode(), course.getName(),
                chapter.getId(), chapter.getTitle(), chapter.getOrderIndex(), row.getStartsOn(), row.getEndsOn(), row.getStatus(), current);
    }
}
