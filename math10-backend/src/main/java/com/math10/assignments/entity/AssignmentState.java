package com.math10.assignments.entity;

/**
 * Trạng thái bài giao <b>tại một thời điểm</b> — suy ra từ {@code status} + {@code open_at} +
 * {@code due_at} + chính sách nộp muộn, không lưu trong bảng. Lưu thành cột thì phải có việc
 * chạy nền đi đổi trạng thái lúc tới hạn, và chỉ cần việc đó chết là dữ liệu nói dối.
 */
public enum AssignmentState {
    /** Giáo viên đang soạn. Học sinh không thấy gì cả. */
    DRAFT,
    /** Đã giao nhưng chưa tới giờ mở. Học sinh thấy tên bài, không thấy đề. */
    SCHEDULED,
    /** Đang trong hạn. */
    OPEN,
    /** Quá hạn nhưng chính sách vẫn cho nộp. */
    LATE_OPEN,
    /** Không nộp được nữa: quá hạn mà không nhận muộn, hoặc giáo viên đã đóng. */
    CLOSED;

    /** Có hiện trong danh sách của học sinh không. */
    public boolean visibleToStudent() {
        return this != DRAFT;
    }

    /** Có được xem nội dung đề không. Chưa tới giờ mở mà lộ đề thì đặt giờ mở làm gì. */
    public boolean contentVisibleToStudent() {
        return this == OPEN || this == LATE_OPEN || this == CLOSED;
    }

    public boolean acceptsSubmission() {
        return this == OPEN || this == LATE_OPEN;
    }
}
