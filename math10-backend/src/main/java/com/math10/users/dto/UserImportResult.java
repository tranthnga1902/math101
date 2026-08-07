package com.math10.users.dto;

import java.util.List;

public record UserImportResult(int created, int skipped, List<String> errors) {
}
