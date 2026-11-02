package com.math10.documents.entity;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Pattern;

/**
 * Loại tài liệu — "ấn phẩm gì". Trước là enum cứng; nay admin thêm được loại mới từ màn Kho tài
 * liệu (danh mục {@code metadata_options} nhóm {@code DOCUMENT_TYPE}), nên đây là một lớp giá trị.
 *
 * <p>Các hằng dưới đây là những loại mà mã nghiệp vụ hỏi thẳng tới. Mỗi mã chỉ có một thể hiện
 * (qua {@link #of(String)}), nên phép so sánh {@code ==} viết từ thời enum vẫn đúng. Việc mã có
 * nằm trong danh mục hay không do tầng dịch vụ kiểm, không phải ở đây.
 */
public final class DocumentType {

    private static final Pattern MA_HOP_LE = Pattern.compile("[A-Z][A-Z0-9_]{0,29}");
    private static final Map<String, DocumentType> THE_HIEN = new ConcurrentHashMap<>();

    public static final DocumentType SGK = of("SGK");
    public static final DocumentType SBT = of("SBT");
    public static final DocumentType KHBD = of("KHBD");
    public static final DocumentType VIDEO = of("VIDEO");
    public static final DocumentType DE_THI = of("DE_THI");
    public static final DocumentType HTML = of("HTML");
    public static final DocumentType HTML_LESSON_CONTENT = of("HTML_LESSON_CONTENT");

    private final String code;

    private DocumentType(String code) {
        this.code = code;
    }

    @JsonCreator
    public static DocumentType of(String code) {
        if (code == null) return null;
        String ma = code.trim().toUpperCase(Locale.ROOT);
        if (!MA_HOP_LE.matcher(ma).matches()) {
            throw new IllegalArgumentException("Mã loại tài liệu không hợp lệ: " + code);
        }
        return THE_HIEN.computeIfAbsent(ma, DocumentType::new);
    }

    /** Cho Spring đổi {@code @RequestParam} kiểu chuỗi sang loại tài liệu. */
    public static DocumentType valueOf(String code) {
        return of(code);
    }

    public static boolean hopLe(String code) {
        return code != null && MA_HOP_LE.matcher(code).matches();
    }

    @JsonValue
    public String name() {
        return code;
    }

    @Override
    public String toString() {
        return code;
    }
}
