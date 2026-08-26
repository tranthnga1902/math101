package com.math10.classes.dto;

import java.util.List;

/**
 * Một dòng trong file danh sách học sinh sau khi đã đối chiếu với dữ liệu hiện có.
 *
 * <p>{@code status} nói cho giáo viên biết điều gì sẽ xảy ra khi bấm xác nhận:
 * {@code TAO_MOI} tạo tài khoản mới rồi thêm vào lớp, {@code CO_SAN} chỉ thêm tài khoản đã có
 * vào lớp, {@code DA_TRONG_LOP} bỏ qua vì em đó đã ở trong lớp, {@code LOI} là dòng không dùng được.
 */
public record RosterImportRow(
        int rowNumber,
        String username,
        String email,
        String fullName,
        String phone,
        String password,
        Long matchedUserId,
        String status,
        List<String> errors
) {
    public boolean valid() {
        return errors.isEmpty();
    }

    /** Bản để trả về cho trình duyệt — không việc gì phải phát mật khẩu ngược lại qua mạng. */
    public RosterImportRow masked() {
        return new RosterImportRow(rowNumber, username, email, fullName, phone, null, matchedUserId, status, errors);
    }
}
