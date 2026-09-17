package com.math10.classes.dto;

import com.math10.classes.entity.ClassStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ClassroomRequest(
        @NotBlank(message = "Mã lớp là bắt buộc")
        String code,
        @NotBlank(message = "Tên lớp là bắt buộc")
        String name,
        @NotNull(message = "Khối là bắt buộc")
        Long gradeId,
        @NotNull(message = "Trạng thái là bắt buộc")
        ClassStatus status,
        String description,
        java.time.LocalDate startDate
) {
    public ClassroomRequest(String code, String name, Long gradeId, ClassStatus status, String description) {
        this(code, name, gradeId, status, description, null);
    }
}
