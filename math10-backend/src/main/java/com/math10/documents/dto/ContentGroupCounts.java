package com.math10.documents.dto;

import com.math10.common.entity.ContentGroup;

import java.util.Map;

/**
 * Bộ đếm cho bộ lọc nhóm nội dung.
 *
 * <p>{@code chuaPhanLoai} tách hẳn ra khỏi {@code theoNhom} chứ không nhét thêm một khoá đặc biệt
 * vào cùng bản đồ: khoá đặc biệt nằm chung namespace với tên nhóm thật, đến ngày ai đó thêm nhóm
 * mới trùng tên là bộ đếm im lặng cộng nhầm.
 *
 * <p>Đếm trên đúng danh sách mà {@code listDocuments()} trả về cho chính người đang hỏi — Admin đếm
 * kho chung, giáo viên đếm thư viện của mình. Đếm bằng một câu SQL riêng thì hai con số cùng nói về
 * một thứ mà lấy từ hai nguồn, và sớm muộn bộ đếm sẽ khác cái danh sách ngay bên cạnh nó.
 */
public record ContentGroupCounts(Map<ContentGroup, Long> theoNhom, long chuaPhanLoai) {
}
