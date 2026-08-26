package com.math10.classes.dto;

import java.util.List;

/**
 * @param created  số tài khoản học sinh mới được tạo
 * @param enrolled số học sinh được thêm vào lớp (tính cả tài khoản vừa tạo)
 * @param skipped  số dòng bỏ qua vì lỗi hoặc vì em đó đã ở trong lớp
 */
public record RosterImportResult(int created, int enrolled, int skipped, List<String> errors) {
}
