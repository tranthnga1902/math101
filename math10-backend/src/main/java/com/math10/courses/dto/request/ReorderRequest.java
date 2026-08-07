package com.math10.courses.dto.request;

import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public record ReorderRequest(
        @NotEmpty(message = "Danh sách ID không được rỗng")
        List<Long> ids
) {
}
