package com.math10.documents.service;

import com.math10.documents.dto.TextbookMappingHistoryEntry;
import com.math10.documents.dto.TextbookMappingHistoryResponse;
import com.math10.documents.dto.TextbookMappingProgressRequest;
import com.math10.documents.dto.TextbookMappingProgressResponse;

public interface TextbookMappingProgressService {

    /**
     * Lấy tiến độ khớp trang hiện tại của user cho 1 sách.
     * Trả về exists=false nếu chưa có (để client dùng default).
     */
    TextbookMappingProgressResponse getProgress(Long documentId);

    /**
     * Lưu tiến độ (UPSERT). Tự trim ring buffer nếu vượt ngưỡng.
     */
    TextbookMappingProgressResponse saveProgress(Long documentId, TextbookMappingProgressRequest request);

    /**
     * Lấy toàn bộ stack lịch sử của user cho 1 sách (đã sắp xếp theo thời gian tăng dần).
     */
    TextbookMappingHistoryResponse getHistory(Long documentId);

    /**
     * Ghi 1 entry lịch sử (GOTO/PREV/NEXT) + cắt ring buffer về đúng ngưỡng.
     */
    TextbookMappingHistoryResponse appendHistory(Long documentId, Integer pdfPage,
                                                 Integer pdfAnchor, Integer bookAnchor, String action);

    /**
     * Tiện ích cho client: lấy entry kế tiếp (prev/next) theo thời gian.
     * Trả về null nếu đã ở đầu/cuối stack.
     */
    TextbookMappingHistoryEntry findRelative(Long documentId, String direction, Long currentHistoryId);
}
