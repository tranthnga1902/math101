package com.math10.documents.entity;

/**
 * Định dạng file của tài liệu — "mở bằng gì". Khác {@link DocumentType} vốn trả lời "ấn phẩm gì".
 * Danh sách khớp ràng buộc CHECK {@code documents_file_format_check}.
 */
public enum FileFormat {
    WORD,
    EXCEL,
    POWERPOINT,
    PDF,
    VIDEO,
    SCORM,
    XAPI
}
