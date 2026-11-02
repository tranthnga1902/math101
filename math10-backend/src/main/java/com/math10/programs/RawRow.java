package com.math10.programs;

import java.util.List;

/**
 * Dòng trung gian — mọi adapter (XLSX, DOCX, paste, PDF) đổ về kiểu này.
 * Mọi trường là chuỗi thô; validator chịu trách nhiệm parse và kiểm tra.
 */
public record RawRow(
        int sourceRow,
        String namespace,
        String strandCode,
        String strandName,
        String semester,
        String periodRange,
        String weekRange,
        String chapterNumeral,
        String chapterName,
        String lessonName,
        String kind,
        InferredBy chapterInferredBy
) {
    public enum InferredBy { DATA, INHERITED, MISSING }

    public static RawRow of(int sourceRow, String namespace,
                            String strandCode, String strandName,
                            String semester, String periodRange, String weekRange,
                            String chapterNumeral, String chapterName,
                            String lessonName, String kind) {
        return new RawRow(sourceRow, namespace, strandCode, strandName,
                semester, periodRange, weekRange, chapterNumeral, chapterName,
                lessonName, kind, InferredBy.DATA);
    }

    public String normalizedLessonName() {
        if (lessonName == null) return "";
        return java.text.Normalizer
                .normalize(lessonName.trim(), java.text.Normalizer.Form.NFC)
                .replaceAll("\\s*\\.\\s*", ".")
                .replaceAll("\\s+", " ");
    }
}
