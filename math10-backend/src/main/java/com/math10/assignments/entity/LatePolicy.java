package com.math10.assignments.entity;

/** Quá hạn thì xử lý ra sao. */
public enum LatePolicy {
    /** Hết hạn là đóng, không nhận nữa. */
    REJECT,
    /** Vẫn nhận, chấm bình thường, chỉ đánh dấu là nộp muộn. */
    ACCEPT,
    /** Vẫn nhận nhưng trừ {@code late_penalty_percent} phần trăm điểm. */
    PENALTY;

    public static LatePolicy of(String value) {
        if (value == null || value.isBlank()) return REJECT;
        try {
            return valueOf(value.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            return REJECT;
        }
    }
}
