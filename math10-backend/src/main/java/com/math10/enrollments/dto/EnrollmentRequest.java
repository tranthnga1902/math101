package com.math10.enrollments.dto;

import jakarta.validation.constraints.NotNull;

public record EnrollmentRequest(
        @NotNull(message = "Lớp là bắt buộc")
        Long classId,
        Long userId,
        // Khóa, không phải chương trình. Đổi hẳn tên trường thay vì giữ "courseId" mang nghĩa mới:
        // client cũ gửi sai sẽ nhận lỗi nói rõ, thay vì gán lớp vào một khóa tình cờ trùng id.
        Long courseInstanceId
) {
}
