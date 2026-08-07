package com.math10.users.dto;

import java.util.List;

public record UserImportPreviewResponse(
        String objectKey,
        int totalRows,
        int validRows,
        int invalidRows,
        List<UserImportRow> rows
) {
}
