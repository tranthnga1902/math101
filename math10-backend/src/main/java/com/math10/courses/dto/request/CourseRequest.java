package com.math10.courses.dto.request;

import com.math10.courses.entity.CourseStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CourseRequest(
        @NotBlank(message = "Mã khóa học là bắt buộc")
        @Size(max = 50, message = "Mã khóa học không vượt quá 50 ký tự")
        String code,

        @NotBlank(message = "Tên khóa học là bắt buộc")
        @Size(max = 255, message = "Tên khóa học không vượt quá 255 ký tự")
        String name,

        String description,

        @NotNull(message = "Trạng thái là bắt buộc")
        CourseStatus status
) {
}
