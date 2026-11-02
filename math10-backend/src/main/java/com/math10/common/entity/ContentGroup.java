package com.math10.common.entity;

/**
 * Tài liệu (hay video) này dùng vào lúc nào trong quá trình học.
 *
 * <p>Khác với {@code doc_type} (SGK/SBT/KHBD/VIDEO/DE_THI) vốn trả lời "đây là loại ấn phẩm gì":
 * một quyển SBT đóng vai {@link #PRACTICE}, một đề thi năm ngoái phát cho học sinh luyện cũng đóng
 * vai {@link #PRACTICE} chứ không phải {@link #ASSESSMENT}. Hai cột chỉ được đứng cạnh nhau chừng
 * nào chúng còn trả lời hai câu hỏi khác nhau.
 *
 * <p>Để trong {@code common} vì cả module documents lẫn module programs (bảng videos) đều dùng, và
 * danh sách này phải là một — trùng với danh sách trong ràng buộc CHECK của CSDL.
 */
public enum ContentGroup {
    /** Lý thuyết: đọc trước khi làm. */
    THEORY,
    /** Luyện tập: làm để quen tay. */
    PRACTICE,
    /** Kiểm tra, đánh giá: làm để lấy điểm. */
    ASSESSMENT,
    /** Tham khảo: đọc thêm, không bắt buộc. */
    REFERENCE
}
