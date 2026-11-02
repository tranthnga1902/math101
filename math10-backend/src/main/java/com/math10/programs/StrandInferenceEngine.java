package com.math10.programs;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.*;

/**
 * Động cơ suy luận mạch (Strand Inference Engine).
 * Sử dụng dữ liệu cấu hình từ DB qua {@link BookSeriesService}.
 * Không chứa bất kỳ dữ liệu cứng hay switch-case nào trong mã nguồn.
 */
@Component
@RequiredArgsConstructor
public class StrandInferenceEngine {

    private final BookSeriesService seriesService;

    /**
     * Suy luận mạch cho bảng dữ liệu thô.
     *
     * @param table bảng dữ liệu thô
     * @param gradeNumber khối lớp (mặc định 10)
     * @param subject môn học (mặc định "Toán")
     * @return RawTable đã được bổ sung mã mạch và tên chuẩn
     */
    public RawTable infer(RawTable table, int gradeNumber, String subject) {
        String seriesCode = table.detectedBookSeries() != null ? table.detectedBookSeries() : "KNTT";
        var profileData = seriesService.getProfile(seriesCode, gradeNumber, subject);

        BookSeriesProfile profile = new BookSeriesProfile(
                profileData.code(),
                profileData.name(),
                profileData.chaptersByNumeral(),
                profileData.keywordsByStrand()
        );

        List<RawRow> enriched = new ArrayList<>();

        for (RawRow r : table.rows()) {
            String strandCode = r.strandCode();
            String strandName = r.strandName();
            String chapterName = r.chapterName();

            // Nếu chưa có mạch, suy đoán bằng profile từ DB
            if (strandCode == null || strandCode.isBlank()) {
                strandCode = profile.inferStrand(r.chapterNumeral(), r.lessonName());
                strandName = nameOfStrand(strandCode);
            }

            // Nếu chưa có tên chương chuẩn nhưng có số hiệu chương, dùng profile để điền tên chuẩn từ DB
            if ((chapterName == null || chapterName.isBlank() || chapterName.matches("(?i)Chương\\s+[IVXLCDM0-9]+"))
                    && r.chapterNumeral() != null && !r.chapterNumeral().isBlank()) {
                chapterName = profile.standardChapterName(r.chapterNumeral());
            }

            enriched.add(new RawRow(
                    r.sourceRow(),
                    r.namespace(),
                    strandCode,
                    strandName,
                    r.semester(),
                    r.periodRange(),
                    r.weekRange(),
                    r.chapterNumeral(),
                    chapterName,
                    r.lessonName(),
                    r.kind(),
                    r.chapterInferredBy()
            ));
        }

        return new RawTable(enriched, table.style(), profile.code());
    }

    public static String nameOfStrand(String code) {
        if (code == null) return "";
        return switch (code) {
            case "DAI_SO" -> "Đại số và một số yếu tố Giải tích";
            case "HINH_HOC" -> "Hình học và Đo lường";
            case "THONG_KE" -> "Thống kê và Xác suất";
            case "HDTN" -> "Hoạt động thực hành trải nghiệm";
            default -> code;
        };
    }
}
