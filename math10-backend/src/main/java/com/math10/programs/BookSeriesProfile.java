package com.math10.programs;

import java.util.*;

/**
 * Hồ sơ bộ sách giáo khoa: suy luận dựa trên dữ liệu cấu hình thực tế được nạp từ DATABASE.
 * Không hardcode bất kỳ chương, mạch hay từ khóa nào trong mã nguồn.
 */
public record BookSeriesProfile(
        String code,
        String name,
        Map<String, BookSeriesService.ChapterInfo> chaptersByNumeral,
        Map<String, List<String>> keywordsByStrand
) {
    /**
     * Suy mạch từ số hiệu chương hoặc từ khóa bài học, dựa 100% vào dữ liệu DB đã nạp.
     */
    public String inferStrand(String chapterNumeral, String lessonTitle) {
        String num = chapterNumeral == null ? "" : chapterNumeral.trim().toUpperCase(Locale.ROOT);
        String title = lessonTitle == null ? "" : lessonTitle.toLowerCase(Locale.ROOT);

        // 1. Đối chiếu theo số hiệu chương từ cấu hình DB
        if (!num.isBlank() && chaptersByNumeral.containsKey(num)) {
            return chaptersByNumeral.get(num).strandCode();
        }

        // 2. Đối chiếu theo từ khóa chuyên môn đã cấu hình trong DB
        for (Map.Entry<String, List<String>> e : keywordsByStrand.entrySet()) {
            for (String kw : e.getValue()) {
                if (title.contains(kw)) {
                    return e.getKey();
                }
            }
        }

        return "";
    }

    /**
     * Tên hiển thị chuẩn của chương được định nghĩa trong DB.
     */
    public String standardChapterName(String chapterNumeral) {
        if (chapterNumeral == null || chapterNumeral.isBlank()) return "";
        String num = chapterNumeral.trim().toUpperCase(Locale.ROOT);
        if (chaptersByNumeral.containsKey(num)) {
            return chaptersByNumeral.get(num).title();
        }
        return "Chương " + chapterNumeral;
    }
}
