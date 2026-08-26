package com.math10.classes.dto;

import java.util.List;

public record RosterImportPreviewResponse(
        String objectKey,
        int total,
        int newAccounts,
        int existingAccounts,
        int alreadyInClass,
        int invalid,
        List<RosterImportRow> rows
) {
}
