package com.math10.programs;

import java.text.Normalizer;
import java.util.*;

/**
 * Khớp mờ tiêu đề cột với tên trường chuẩn.
 *
 * <p>Từ điển ánh xạ được nạp từ DATABASE (bảng import_column_aliases) thông qua {@link BookSeriesService}.
 * Không hardcode danh sách cột cố định trong mã nguồn.
 */
public final class ColumnMatcher {

    private ColumnMatcher() {}

    /**
     * Gán cột tự động từ danh sách tiêu đề dựa trên từ điển cấu hình trong DB.
     *
     * @param headers danh sách tên tiêu đề cột từ file/paste
     * @param aliasDictionary từ điển alias nạp từ database
     * @return ánh xạ (vị trí cột → tên trường)
     */
    public static Map<Integer, String> matchHeaders(List<String> headers, Map<String, String> aliasDictionary) {
        Map<Integer, String> result = new LinkedHashMap<>();
        Set<String> usedFields = new HashSet<>();
        Map<String, String> dict = aliasDictionary != null ? aliasDictionary : Collections.emptyMap();

        for (int i = 0; i < headers.size(); i++) {
            String normalized = normalizeHeader(headers.get(i));
            if (normalized.isBlank()) continue;

            String field = dict.get(normalized);
            if (field == null) {
                field = fuzzyMatch(normalized, dict);
            }

            if (field != null && !usedFields.contains(field)) {
                result.put(i, field);
                usedFields.add(field);
            }
        }
        return result;
    }

    /**
     * Gán một tiêu đề đơn lẻ dựa trên từ điển nạp từ DB.
     */
    public static String matchSingle(String header, Map<String, String> aliasDictionary) {
        if (aliasDictionary == null || aliasDictionary.isEmpty()) return null;
        String normalized = normalizeHeader(header);
        String exact = aliasDictionary.get(normalized);
        return exact != null ? exact : fuzzyMatch(normalized, aliasDictionary);
    }

    // ==================== Thuật toán toán học thuần túy ====================

    private static String fuzzyMatch(String normalized, Map<String, String> dict) {
        int bestDist = Integer.MAX_VALUE;
        String bestField = null;
        for (Map.Entry<String, String> e : dict.entrySet()) {
            int d = levenshtein(normalized, e.getKey());
            if (d < bestDist) {
                bestDist = d;
                bestField = e.getValue();
            }
        }
        return bestDist <= 3 ? bestField : null;
    }

    public static String normalizeHeader(String raw) {
        if (raw == null || raw.isBlank()) return "";
        // Unicode NFD không phân rã chữ Đ/đ, phải đổi riêng trước khi bỏ dấu.
        return Normalizer.normalize(raw.trim().replace('Đ', 'D').replace('đ', 'd'), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9\\s]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    public static int levenshtein(String a, String b) {
        int m = a.length(), n = b.length();
        if (Math.abs(m - n) > 4) return 99;
        int[][] dp = new int[m + 1][n + 1];
        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                dp[i][j] = a.charAt(i - 1) == b.charAt(j - 1)
                        ? dp[i - 1][j - 1]
                        : 1 + Math.min(dp[i - 1][j - 1], Math.min(dp[i - 1][j], dp[i][j - 1]));
            }
        }
        return dp[m][n];
    }
}
