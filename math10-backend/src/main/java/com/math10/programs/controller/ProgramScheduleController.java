package com.math10.programs.controller;

import com.math10.chapters.entity.Chapter;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.courses.entity.Course;
import com.math10.courses.repository.CourseRepository;
import com.math10.programs.AcademicBreaks;
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
import java.util.Optional;

/**
 * @deprecated API lịch phân phối chương theo ngày (program_schedules).
 *
 * <p>Endpoint {@code GET /api/program-schedules/current} vẫn đang được dùng bởi
 * màn hình học sinh "Hôm nay" (TodayPage) để hiển thị "Chương trình hiện tại".
 * KHÔNG xóa controller này cho đến khi student flow được chuyển sang dùng
 * class_schedule hoặc một API mới.
 *
 * <p>Endpoint CRUD (POST, PUT, DELETE) chỉ nên dùng qua admin nếu cần maintain
 * dữ liệu legacy. Khi thiết kế tính năng mới, dùng course_delivery_sessions +
 * class_schedule thay vì program_schedules.
 *
 * <p>Admin UI không còn màn hình nào nhập trực tiếp vào program_schedules.
 */
@SuppressWarnings("DeprecatedIsStillUsed")
@Deprecated(since = "2026-09", forRemoval = false)
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/program-schedules")
public class ProgramScheduleController {
    private final ProgramScheduleRepository schedules;
    private final CourseRepository courses;
    private final ChapterRepository chapters;
    private final AcademicBreaks breaks;
    private final CurrentUserService currentUser;

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
        Optional<AcademicBreaks.Break> nghi = breaks.forUser(currentUser.requireUserId(), courseId, date);
        // Lịch vẫn chỉ vào chương đang dở, nhưng ngày nghỉ thì không ai học nó. Vẫn trả chương lại
        // để màn hình nói được "nghỉ tới ngày X rồi học tiếp Chương 5"; cờ current mới là chỗ nói
        // hôm nay có học hay không.
        ProgramScheduleDtos.Response body = schedules.current(courseId, date)
                .map(row -> response(row, date, nghi))
                .orElseGet(() -> nghi.map(x -> ProgramScheduleDtos.Response.onBreak(x.reason(), x.endsOn())).orElse(null));
        return ApiResponse.ok(nghi.isPresent() ? "Đang trong kỳ nghỉ" : "Chương hiện hành", body);
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

    /**
     * Dùng cho danh sách lịch và cho lúc vừa lưu: đó là lịch <em>đã đặt</em>, không phải lịch đang
     * trải qua, nên không hỏi kỳ nghỉ. Chỉ endpoint {@code /current} mới trả lời "hôm nay học gì".
     */
    private ProgramScheduleDtos.Response response(ProgramSchedule row, LocalDate at) {
        return response(row, at, Optional.empty());
    }

    private ProgramScheduleDtos.Response response(ProgramSchedule row, LocalDate at, Optional<AcademicBreaks.Break> nghi) {
        Course course = courses.findById(row.getCourseId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương trình"));
        Chapter chapter = chapters.findById(row.getChapterId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương"));
        boolean current = nghi.isEmpty() && "ACTIVE".equals(row.getStatus())
                && !at.isBefore(row.getStartsOn()) && !at.isAfter(row.getEndsOn());
        return new ProgramScheduleDtos.Response(row.getId(), course.getId(), course.getCode(), course.getName(),
                chapter.getId(), chapter.getTitle(), chapter.getOrderIndex(), row.getStartsOn(), row.getEndsOn(), row.getStatus(),
                current, nghi.isPresent(), nghi.map(AcademicBreaks.Break::reason).orElse(null),
                nghi.map(AcademicBreaks.Break::endsOn).orElse(null));
    }
}
