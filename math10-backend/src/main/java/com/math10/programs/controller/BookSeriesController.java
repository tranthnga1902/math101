package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.programs.entity.BookSeries;
import com.math10.programs.entity.BookSeriesStatus;
import com.math10.programs.repository.BookSeriesRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Bộ SGK. Ghi là việc của Admin; giáo viên và học sinh chỉ đọc danh sách đang dùng để lọc.
 */
@RestController @RequiredArgsConstructor
public class BookSeriesController {
    private final BookSeriesRepository bookSeries;
    private final JdbcTemplate jdbc;

    @GetMapping("/api/book-series") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<BookSeriesView>> active() {
        return ApiResponse.ok("Bộ SGK đang dùng", bookSeries.findByStatusOrderByOrderNoAscNameAsc(BookSeriesStatus.ACTIVE).stream().map(x->BookSeriesView.of(x,0)).toList());
    }

    @GetMapping("/api/admin/book-series") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<BookSeriesView>> all() {
        return ApiResponse.ok("Tất cả bộ SGK", bookSeries.findAllByOrderByOrderNoAscNameAsc().stream().map(x->BookSeriesView.of(x,programCount(x.getId()))).toList());
    }

    @PostMapping("/api/admin/book-series") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<BookSeriesView> create(@Valid @RequestBody BookSeriesRequest request) {
        requireFreeCode(request.code(), null);
        BookSeries row = new BookSeries(); apply(row, request);
        return ApiResponse.created("Đã tạo bộ SGK", BookSeriesView.of(bookSeries.save(row), 0));
    }

    @PutMapping("/api/admin/book-series/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<BookSeriesView> update(@PathVariable Long id, @Valid @RequestBody BookSeriesRequest request) {
        BookSeries row = row(id); requireFreeCode(request.code(), id); apply(row, request);
        return ApiResponse.ok("Đã cập nhật bộ SGK", BookSeriesView.of(row, programCount(id)));
    }

    /**
     * Xoá bộ SGK còn chương trình trỏ tới sẽ để lại chương trình mồ côi — cột trỏ tới một dòng
     * không còn đọc được. Chặn ở đây và nói ra số chương trình đang vướng, thay vì để người dùng
     * nhận một lỗi khoá ngoại không đọc được hoặc, tệ hơn, xoá mềm thành công rồi mới phát hiện.
     */
    @DeleteMapping("/api/admin/book-series/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> delete(@PathVariable Long id) {
        BookSeries row = row(id); int used = programCount(id);
        if (used > 0) throw new BusinessException("Còn " + used + " chương trình đang dùng bộ SGK này. Hãy chuyển chúng sang bộ khác trước khi xoá, hoặc chuyển bộ SGK sang trạng thái Ngừng dùng.");
        row.markDeleted();
        return ApiResponse.ok("Đã xoá bộ SGK", null);
    }

    private BookSeries row(Long id) { return bookSeries.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bộ SGK")); }

    private int programCount(Long id) {
        Integer n = jdbc.queryForObject("select count(*) from courses where book_series_id=? and deleted_at is null", Integer.class, id);
        return n == null ? 0 : n;
    }

    /** Mã trùng bị chỉ mục duy nhất chặn, nhưng lỗi CSDL không nói được mã nào trùng. */
    private void requireFreeCode(String code, Long selfId) {
        bookSeries.findByCode(code).filter(x -> !x.getId().equals(selfId))
                .ifPresent(x -> { throw new BusinessException("Mã bộ SGK \"" + code + "\" đã được dùng cho \"" + x.getName() + "\""); });
    }

    private void apply(BookSeries row, BookSeriesRequest x) {
        row.setCode(x.code()); row.setName(x.name()); row.setPublisher(x.publisher());
        row.setStatus(x.status() == null ? BookSeriesStatus.ACTIVE : x.status());
        row.setOrderNo(x.orderNo() == null ? 0 : x.orderNo());
    }

    public record BookSeriesRequest(@NotBlank String code, @NotBlank String name, String publisher, BookSeriesStatus status, Integer orderNo) {}
    public record BookSeriesView(Long id, String code, String name, String publisher, BookSeriesStatus status, Integer orderNo, Integer programCount) {
        static BookSeriesView of(BookSeries x, int programCount) { return new BookSeriesView(x.getId(), x.getCode(), x.getName(), x.getPublisher(), x.getStatus(), x.getOrderNo(), programCount); }
    }
}
