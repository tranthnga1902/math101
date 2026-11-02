package com.math10.programs.dto;

import java.util.List;
import java.util.Map;

public final class ProgramCourseImportDtos {
    private ProgramCourseImportDtos() {}

    public record Info(String code, String name, String subject, Integer grade,
                       Integer totalPeriods, Integer totalWeeks, Integer version) {}

    public record Row(int row, String namespace, String strandCode, String strandName, int semester,
                      int periodNo, int weekNo, String chapterNumeral,
                      String chapterName, String lessonName, String kind, String inferredBy) {
        // Constructor tương thích ngược với 10 tham số cũ
        public Row(int row, String strandCode, String strandName, int semester,
                   int periodNo, int weekNo, String chapterNumeral,
                   String chapterName, String lessonName, String kind) {
            this(row, "MAIN", strandCode, strandName, semester, periodNo, weekNo,
                    chapterNumeral, chapterName, lessonName, kind, "DATA");
        }
    }

    public record Issue(int row, String column, String code, String message) {}

    public record Lesson(String name, String normalizedName, String kind, int totalPeriods,
                         int firstWeek, int lastWeek, List<Row> periods, String inferredBy) {
        public Lesson(String name, String normalizedName, String kind, int totalPeriods,
                      int firstWeek, int lastWeek, List<Row> periods) {
            this(name, normalizedName, kind, totalPeriods, firstWeek, lastWeek, periods, "DATA");
        }
    }

    public record Chapter(String numeral, String name, int totalPeriods, List<Lesson> lessons) {}

    public record Strand(String code, String name, int totalPeriods, List<Chapter> chapters) {}

    public record Derived(List<Strand> strands, int chapterCount, int lessonCount, int periodCount) {}

    public record Preview(String previewToken, Info info, Derived derived,
                          List<Issue> errors, List<Issue> warnings) {}

    public record ConfirmRequest(String previewToken) {}

    public record ConfirmResult(long courseId, Map<String, Integer> created) {}

    // I7: Parse and mapping
    public record ColumnSample(int index, String header, List<String> samples, String suggestedField) {}

    public record ParseResult(String parseToken, String format, List<ColumnSample> columns,
                             Map<Integer, String> suggestedMapping, int rowCount) {}

    public record MappingPreviewRequest(String parseToken, Map<Integer, String> mapping,
                                       Map<String, String> strandAssignment, Info info) {}
}
