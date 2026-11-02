package com.math10.programs;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service nạp toàn bộ dữ liệu cấu hình bộ sách, ánh xạ chương - mạch và tên cột từ DATABASE.
 * Không hardcode bất kỳ chương, mạch hay từ khóa nào trong mã nguồn.
 */
@Service
@RequiredArgsConstructor
public class BookSeriesService {

    private final JdbcTemplate jdbc;

    public record ChapterInfo(String numeral, String title, String strandCode, int orderIndex) {}
    public record SeriesProfileData(String code, String name, Map<String, ChapterInfo> chaptersByNumeral, Map<String, List<String>> keywordsByStrand) {}

    // Cache trong bộ nhớ, tự động vô hiệu khi có cập nhật
    private final Map<String, SeriesProfileData> profileCache = new ConcurrentHashMap<>();
    private final Map<String, String> aliasCache = new ConcurrentHashMap<>();

    /**
     * Nạp hồ sơ bộ sách theo mã và khối từ DB.
     */
    public SeriesProfileData getProfile(String seriesCode, int gradeNumber, String subject) {
        String cacheKey = seriesCode + "#" + gradeNumber + "#" + subject;
        return profileCache.computeIfAbsent(cacheKey, k -> loadProfileFromDb(seriesCode, gradeNumber, subject));
    }

    private SeriesProfileData loadProfileFromDb(String seriesCode, int gradeNumber, String subject) {
        List<Map<String, Object>> seriesList = jdbc.queryForList(
                "select code, name from book_series where code = ? and deleted_at is null", seriesCode);
        String name = seriesList.isEmpty() ? seriesCode : (String) seriesList.get(0).get("name");

        // Đọc danh sách chương từ DB
        List<Map<String, Object>> chapterRows = jdbc.queryForList("""
            select chapter_numeral, chapter_title, strand_code, order_index
            from book_series_chapters
            where book_series_code = ? and grade_number = ? and subject = ? and deleted_at is null
            order by order_index
            """, seriesCode, gradeNumber, subject);

        Map<String, ChapterInfo> chapters = new LinkedHashMap<>();
        for (Map<String, Object> r : chapterRows) {
            String num = ((String) r.get("chapter_numeral")).trim().toUpperCase(Locale.ROOT);
            chapters.put(num, new ChapterInfo(
                    (String) r.get("chapter_numeral"),
                    (String) r.get("chapter_title"),
                    (String) r.get("strand_code"),
                    ((Number) r.get("order_index")).intValue()
            ));
        }

        // Đọc từ khóa nhận diện theo bộ sách từ DB
        List<Map<String, Object>> kwRows = jdbc.queryForList("""
            select strand_code, keyword
            from book_series_keywords
            where book_series_code = ? and deleted_at is null
            """, seriesCode);

        Map<String, List<String>> kwMap = new LinkedHashMap<>();
        for (Map<String, Object> r : kwRows) {
            String strand = (String) r.get("strand_code");
            String kw = (String) r.get("keyword");
            kwMap.computeIfAbsent(strand, x -> new ArrayList<>()).add(kw.toLowerCase(Locale.ROOT));
        }

        return new SeriesProfileData(seriesCode, name, chapters, kwMap);
    }

    /**
     * Nạp từ điển gán cột từ bảng import_column_aliases trong DB.
     */
    public Map<String, String> getColumnAliases() {
        if (aliasCache.isEmpty()) {
            refreshAliases();
        }
        return Collections.unmodifiableMap(aliasCache);
    }

    public synchronized void refreshAliases() {
        aliasCache.clear();
        List<Map<String, Object>> rows = jdbc.queryForList("select alias_normalized, standard_field from import_column_aliases");
        for (Map<String, Object> r : rows) {
            aliasCache.put((String) r.get("alias_normalized"), (String) r.get("standard_field"));
        }
    }

    public void invalidateProfile(String seriesCode) {
        profileCache.keySet().removeIf(k -> k.startsWith(seriesCode + "#"));
    }
}
