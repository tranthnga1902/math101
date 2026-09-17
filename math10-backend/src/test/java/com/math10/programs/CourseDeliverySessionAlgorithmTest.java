package com.math10.programs;

import org.junit.jupiter.api.Test;

import java.util.*;

import static org.assertj.core.api.Assertions.*;

/**
 * Unit tests cho thuật toán gom tiết thành buổi (Course tier) — 12 cases bắt buộc.
 *
 * <p>Không cần Spring context. Test thuật toán pure logic bằng cách tái tạo lại đúng
 * logic gom buổi / phân loại buổi / đặt tên buổi trong
 * {@code CourseDeliverySessionGenerator} dưới dạng static methods, không đụng DB.
 *
 * <p>12 cases:
 * 1. tiet_moi_tuan=2, không có KIEM_TRA → gom đúng 2 tiết/buổi
 * 2. tiet_moi_tuan=null → mỗi tiết một buổi riêng (mặc định 1), có warning
 * 3. KIEM_TRA luôn tách buổi riêng, không gộp chung tiết khác
 * 4. Không cắt ngang lesson: tiết cuối buổi cùng lesson_id với tiết kế tiếp → overflow thêm vào buổi hiện tại
 * 5. tiet_moi_tuan=1 → mỗi tiết đúng một buổi (không gộp gì)
 * 6. Danh sách tiết rỗng → 0 buổi, có warning, không lỗi
 * 7. resolveSessionType: buổi 1 tiết ON_TAP → REVIEW; nhiều tiết → luôn TEACHING
 * 8. resolveSessionType: buổi 1 tiết THUC_HANH → ACTIVITY; buổi 1 tiết KIEM_TRA → EXAM
 * 9. buildTitle: buổi 1 tiết lấy title của tiết; buổi nhiều tiết → "Buổi N"
 * 10. Nhiều buổi liên tiếp với overflow xen kẽ → tổng số tiết được bảo toàn (không mất/lặp tiết)
 * 11. Không phụ thuộc lịch phân phối chương: {@code Period} không mang bất kỳ trường ngày/chương
 *     nào, và việc gom buổi cho các tiết thuộc nhiều "chương" (lesson_id) khác nhau vẫn đúng dù
 *     không có ngày phân phối nào được gán trước — chứng minh thuật toán không đọc, không cần
 *     {@code chapter_start_date}/{@code chapter_end_date}/lịch phân phối từng chương.
 * 12. Sinh lại với nhịp tiết/buổi khác nhau trên cùng một danh sách tiết → kết quả gom thay đổi
 *     theo đúng nhịp mới, và tổng số tiết vẫn được bảo toàn ở cả hai lần sinh.
 */
class CourseDeliverySessionAlgorithmTest {

    // ------------------------------------------------------------------
    // Thuật toán tái tạo lại từ CourseDeliverySessionGenerator (pure, không DB)
    // ------------------------------------------------------------------

    /**
     * Một tiết chuẩn tối giản để test — tương đương một dòng trong program_periods (kèm lesson_title).
     *
     * <p>{@code strandId}: mạch (Đại số / Hình học / Chuyên đề...) — các mạch chạy song song theo
     * tuần (xem V202609020900__mach_va_tiet_cua_chuong_trinh.sql), nên một buổi không bao giờ được
     * gộp tiết từ hai mạch khác nhau dù chúng đứng cạnh nhau trong danh sách đã sắp theo week_no.
     */
    record Period(long id, int periodNo, int weekNo, Long lessonId, String periodKind, String title, String lessonTitle, long strandId) {}

    /** Overload mặc định KEEP_LESSON/SEPARATE — hành vi cũ, dùng bởi các case 1-14. */
    static List<List<Period>> groupPeriods(List<Period> periods, int unitsPerSession) {
        return groupPeriods(periods, unitsPerSession, "KEEP_LESSON", "SEPARATE");
    }

    static List<List<Period>> groupPeriods(
            List<Period> periods, int unitsPerSession, String splitPolicy, String assessmentPolicy) {
        List<List<Period>> sessions = new ArrayList<>();
        List<Period> current = new ArrayList<>();

        for (int idx = 0; idx < periods.size(); idx++) {
            Period period = periods.get(idx);
            String kind = period.periodKind();

            // Đổi mạch → luôn cắt buổi mới ngay, bất kể đã đủ nhịp unitsPerSession hay chưa.
            // Mạch chạy song song theo tuần (Đại số/Hình học/Chuyên đề); một buổi dạy thực tế chỉ
            // thuộc đúng một mạch, không bao giờ trộn lẫn.
            if (!current.isEmpty() && current.get(current.size() - 1).strandId() != period.strandId()) {
                sessions.add(current);
                current = new ArrayList<>();
            }

            boolean tachRieng = "KIEM_TRA".equals(kind) && !"MERGE".equals(assessmentPolicy);
            if (tachRieng) {
                if (!current.isEmpty()) {
                    sessions.add(current);
                    current = new ArrayList<>();
                }
                sessions.add(new ArrayList<>(List.of(period)));
                continue;
            }

            if (current.size() >= unitsPerSession) {
                boolean choOverflow = switch (splitPolicy) {
                    case "FIXED_CAPACITY" -> false;
                    case "BALANCED" -> coTheOverflowCanBang(current, period, periods, idx);
                    default -> cungLesson(current, period); // KEEP_LESSON
                };

                if (!choOverflow) {
                    sessions.add(current);
                    current = new ArrayList<>();
                }
                // cho overflow → thêm vào buổi hiện tại dù đã đủ nhịp
            }

            current.add(period);
        }

        if (!current.isEmpty()) {
            sessions.add(current);
        }

        return sessions;
    }

    static boolean cungLesson(List<Period> current, Period next) {
        Long lastLesson = current.get(current.size() - 1).lessonId();
        return lastLesson != null && lastLesson.equals(next.lessonId());
    }

    static boolean coTheOverflowCanBang(List<Period> current, Period next, List<Period> allPeriods, int nextIdx) {
        if (!cungLesson(current, next)) return false;
        boolean laTietCuoiCuaLesson = nextIdx + 1 >= allPeriods.size()
                || !Objects.equals(allPeriods.get(nextIdx + 1).lessonId(), next.lessonId());
        return laTietCuoiCuaLesson;
    }

    static List<Boolean> computeContinuationFlags(List<List<Period>> sessions) {
        List<Boolean> flags = new ArrayList<>();
        for (int i = 0; i < sessions.size(); i++) {
            if (i == 0) {
                flags.add(false);
                continue;
            }
            List<Period> prev = sessions.get(i - 1);
            List<Period> cur = sessions.get(i);
            Long prevLastLesson = prev.get(prev.size() - 1).lessonId();
            Long curFirstLesson = cur.get(0).lessonId();
            flags.add(prevLastLesson != null && prevLastLesson.equals(curFirstLesson));
        }
        return flags;
    }

    static String resolveSessionType(List<Period> units) {
        boolean coKiemTra = units.stream().anyMatch(u -> "KIEM_TRA".equals(u.periodKind()));
        if (coKiemTra) return "EXAM";

        if (units.size() == 1) {
            String kind = units.get(0).periodKind();
            return switch (kind == null ? "" : kind) {
                case "ON_TAP"    -> "REVIEW";
                case "THUC_HANH" -> "ACTIVITY";
                default          -> "TEACHING";
            };
        }
        return "TEACHING";
    }

    static String buildTitle(List<Period> units, int seq) {
        if (units.isEmpty()) return "Buổi " + seq;

        if (units.size() == 1) {
            String lessonTitle = units.get(0).lessonTitle();
            if (lessonTitle != null) return lessonTitle;
            String title = units.get(0).title();
            return title != null ? title : "Buổi " + seq;
        }

        LinkedHashSet<String> lessonTitles = new LinkedHashSet<>();
        for (Period unit : units) {
            if (unit.lessonTitle() != null) lessonTitles.add(unit.lessonTitle());
        }

        if (lessonTitles.isEmpty()) return "Buổi " + seq;
        if (lessonTitles.size() == 1) return lessonTitles.iterator().next();

        Iterator<String> it = lessonTitles.iterator();
        String first = it.next();
        String second = it.next();
        if (lessonTitles.size() == 2) return first + " · " + second;
        return first + " · " + second + " + " + (lessonTitles.size() - 2) + " nội dung";
    }

    /**
     * Mô phỏng logic đọc units_per_session từ CourseDeliverySessionGenerator:
     * 1. Dùng unitsPerSession nếu có (đúng semantic mới)
     * 2. Fallback về tietMoiTuan nếu có (tương thích ngược dữ liệu cũ)
     * 3. Fallback về 1 nếu cả hai đều null
     */
    static int resolveUnitsPerSession(Integer unitsPerSession, Integer tietMoiTuan, List<String> warnings) {
        if (unitsPerSession != null) {
            return unitsPerSession;
        }
        if (tietMoiTuan != null) {
            warnings.add("Khóa chưa đặt units_per_session riêng — đang dùng tiet_moi_tuan ("
                    + tietMoiTuan + " tiết/buổi) làm giá trị tạm.");
            return tietMoiTuan;
        }
        warnings.add("Khóa chưa đặt số tiết/buổi (units_per_session) — dùng mặc định 1 tiết/buổi (không gộp).");
        return 1;
    }

    /** Overload tương thích ngược cho tests dùng cú pháp cũ (tiet_moi_tuan only). */
    static int resolveUnitsPerSession(Integer tietMoiTuan, List<String> warnings) {
        return resolveUnitsPerSession(null, tietMoiTuan, warnings);
    }

    private static Period bai(long id, int periodNo, int weekNo, Long lessonId, String kind, String title) {
        return new Period(id, periodNo, weekNo, lessonId, kind, title, null, 1L);
    }

    /** Như {@link #bai}, nhưng kèm lesson_title riêng — dùng cho test buildTitle/split_policy. */
    private static Period baiL(long id, int periodNo, int weekNo, Long lessonId, String kind, String title, String lessonTitle) {
        return new Period(id, periodNo, weekNo, lessonId, kind, title, lessonTitle, 1L);
    }

    /** Như {@link #bai}, nhưng kèm strandId riêng — dùng cho test gộp buổi theo mạch. */
    private static Period baiS(long id, int periodNo, int weekNo, Long lessonId, String kind, String title, long strandId) {
        return new Period(id, periodNo, weekNo, lessonId, kind, title, null, strandId);
    }

    // ------------------------------------------------------------------
    // Case 1: units_per_session=2 (hoặc tiet_moi_tuan=2), không KIEM_TRA → gom đúng 2 tiết/buổi
    // ------------------------------------------------------------------

    @Test
    void case1_GomDung2TietMoiBuoi() {
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 100L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 101L, "BAI_MOI", "Tiết 3"),
                bai(4, 4, 1, 101L, "BAI_MOI", "Tiết 4")
        );

        List<List<Period>> sessions = groupPeriods(periods, 2);

        assertThat(sessions).hasSize(2);
        assertThat(sessions.get(0)).hasSize(2);
        assertThat(sessions.get(1)).hasSize(2);
    }

    // ------------------------------------------------------------------
    // Case 2: tiet_moi_tuan=null và units_per_session=null → mặc định 1 tiết/buổi, có warning
    // ------------------------------------------------------------------

    @Test
    void case2_TietMoiTuanNull_MacDinh1_CoWarning() {
        List<String> warnings = new ArrayList<>();
        int unitsPerSession = resolveUnitsPerSession(null, warnings);

        assertThat(unitsPerSession).isEqualTo(1);
        assertThat(warnings).hasSize(1);
        // Warning phải đề cập đến units_per_session hoặc nhịp dạy
        assertThat(warnings.get(0)).containsAnyOf("units_per_session", "nhịp dạy");

        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 101L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 102L, "BAI_MOI", "Tiết 3")
        );
        List<List<Period>> sessions = groupPeriods(periods, unitsPerSession);

        assertThat(sessions).hasSize(3);
        assertThat(sessions).allMatch(s -> s.size() == 1);
    }

    // ------------------------------------------------------------------
    // Case 3: KIEM_TRA luôn tách buổi riêng
    // ------------------------------------------------------------------

    @Test
    void case3_KiemTraTachBuoiRieng() {
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 100L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, null, "KIEM_TRA", "Kiểm tra 15 phút"),
                bai(4, 4, 1, 101L, "BAI_MOI", "Tiết 4")
        );

        List<List<Period>> sessions = groupPeriods(periods, 3);

        assertThat(sessions).hasSize(3);
        assertThat(sessions.get(0)).hasSize(2); // tiết 1,2 gom chung (chưa đủ nhịp 3 nhưng KIEM_TRA cắt ngang)
        assertThat(sessions.get(1)).hasSize(1);
        assertThat(sessions.get(1).get(0).periodKind()).isEqualTo("KIEM_TRA");
        assertThat(sessions.get(2)).hasSize(1);
    }

    // ------------------------------------------------------------------
    // Case 4: Không cắt ngang lesson → overflow thêm vào buổi hiện tại
    // ------------------------------------------------------------------

    @Test
    void case4_KhongCatNgangLesson_Overflow() {
        // unitsPerSession=2, nhưng tiết 3 cùng lesson_id với tiết 2 (đã đủ nhịp) → overflow vào buổi 1
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 200L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 200L, "BAI_MOI", "Tiết 3"), // cùng bài với tiết 2 → overflow
                bai(4, 4, 1, 300L, "BAI_MOI", "Tiết 4")
        );

        List<List<Period>> sessions = groupPeriods(periods, 2);

        assertThat(sessions).hasSize(2);
        assertThat(sessions.get(0)).hasSize(3); // tiết 1,2,3 — overflow 1 tiết
        assertThat(sessions.get(1)).hasSize(1); // tiết 4
    }

    // ------------------------------------------------------------------
    // Case 5: tiet_moi_tuan=1 → mỗi tiết một buổi
    // ------------------------------------------------------------------

    @Test
    void case5_TietMoiTuan1_MoiTietMotBuoi() {
        // lesson_id khác nhau ở mỗi tiết — không kích hoạt quy tắc overflow "không cắt ngang bài"
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 101L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 102L, "BAI_MOI", "Tiết 3")
        );

        List<List<Period>> sessions = groupPeriods(periods, 1);

        assertThat(sessions).hasSize(3);
        assertThat(sessions).allMatch(s -> s.size() == 1);
    }

    // ------------------------------------------------------------------
    // Case 6: Danh sách tiết rỗng → 0 buổi, không lỗi
    // ------------------------------------------------------------------

    @Test
    void case6_DanhSachRong_KhongLoi() {
        List<Period> periods = List.of();

        List<List<Period>> sessions = groupPeriods(periods, 2);

        assertThat(sessions).isEmpty();
    }

    // ------------------------------------------------------------------
    // Case 7: resolveSessionType — 1 tiết ON_TAP → REVIEW; nhiều tiết → TEACHING
    // ------------------------------------------------------------------

    @Test
    void case7_ResolveSessionType_OnTapVaNhieuTiet() {
        String reviewType = resolveSessionType(List.of(
                bai(1, 1, 1, 100L, "ON_TAP", "Ôn tập chương 1")));
        assertThat(reviewType).isEqualTo("REVIEW");

        String teachingType = resolveSessionType(List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 100L, "ON_TAP", "Tiết 2")));
        assertThat(teachingType).isEqualTo("TEACHING");
    }

    // ------------------------------------------------------------------
    // Case 8: resolveSessionType — THUC_HANH → ACTIVITY; KIEM_TRA → EXAM
    // ------------------------------------------------------------------

    @Test
    void case8_ResolveSessionType_ThucHanhVaKiemTra() {
        String activityType = resolveSessionType(List.of(
                bai(1, 1, 1, 100L, "THUC_HANH", "Thực hành")));
        assertThat(activityType).isEqualTo("ACTIVITY");

        String examType = resolveSessionType(List.of(
                bai(1, 1, 1, null, "KIEM_TRA", "Kiểm tra")));
        assertThat(examType).isEqualTo("EXAM");
    }

    // ------------------------------------------------------------------
    // Case 9: buildTitle — 1 tiết lấy title; nhiều tiết → "Buổi N"
    // ------------------------------------------------------------------

    @Test
    void case9_BuildTitle() {
        String single = buildTitle(List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Hàm số bậc nhất")), 5);
        assertThat(single).isEqualTo("Hàm số bậc nhất");

        String multi = buildTitle(List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 100L, "BAI_MOI", "Tiết 2")), 5);
        assertThat(multi).isEqualTo("Buổi 5");

        String empty = buildTitle(List.of(), 7);
        assertThat(empty).isEqualTo("Buổi 7");
    }

    // ------------------------------------------------------------------
    // Case 10: Nhiều buổi + overflow xen kẽ → tổng số tiết bảo toàn
    // ------------------------------------------------------------------

    @Test
    void case10_TongSoTietBaoToan_KhongMatKhongLap() {
        List<Period> periods = new ArrayList<>();
        long id = 1;
        // 3 bài, mỗi bài 3 tiết cùng lesson_id, xen giữa có 1 KIEM_TRA
        for (int lesson = 1; lesson <= 3; lesson++) {
            for (int p = 1; p <= 3; p++) {
                periods.add(bai(id++, p, lesson, (long) (lesson * 1000), "BAI_MOI", "Bài " + lesson + " - Tiết " + p));
            }
            if (lesson == 2) {
                periods.add(bai(id++, 1, lesson, null, "KIEM_TRA", "Kiểm tra giữa kỳ"));
            }
        }

        List<List<Period>> sessions = groupPeriods(periods, 2);

        int totalIn = periods.size();
        int totalOut = sessions.stream().mapToInt(List::size).sum();
        assertThat(totalOut).isEqualTo(totalIn);

        // Không tiết nào bị lặp lại giữa các buổi
        Set<Long> seenIds = new HashSet<>();
        for (List<Period> session : sessions) {
            for (Period p : session) {
                assertThat(seenIds.add(p.id())).isTrue();
            }
        }
        assertThat(seenIds).hasSize(totalIn);
    }

    // ------------------------------------------------------------------
    // Case 11: Không phụ thuộc lịch phân phối chương — Period không mang ngày/chương,
    // gom buổi đúng cho nhiều "chương" (lesson_id) khác nhau mà không cần ngày phân phối nào.
    // ------------------------------------------------------------------

    @Test
    void case11_KhongPhuThuocLichPhanPhoiChuong() {
        // Period record chỉ có: id, periodNo, weekNo, lessonId, periodKind, title — không có
        // startsOn/endsOn/chapterId nào. Ba "chương" dưới đây (lessonId 100/200/300) không có
        // bất kỳ ngày phân phối nào được gán, nhưng thuật toán vẫn gom đúng theo period_kind và
        // lesson_id — chứng minh nó không đọc lịch phân phối từng chương.
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Chương 1 - Tiết 1"),
                bai(2, 2, 1, 100L, "BAI_MOI", "Chương 1 - Tiết 2"),
                bai(3, 3, 2, 200L, "BAI_MOI", "Chương 2 - Tiết 1"),
                bai(4, 4, 2, 200L, "BAI_MOI", "Chương 2 - Tiết 2"),
                bai(5, 5, 3, 300L, "BAI_MOI", "Chương 3 - Tiết 1")
        );

        List<List<Period>> sessions = groupPeriods(periods, 2);

        assertThat(sessions).hasSize(3);
        assertThat(sessions.get(0)).hasSize(2);
        assertThat(sessions.get(1)).hasSize(2);
        assertThat(sessions.get(2)).hasSize(1);
        // Tổng số tiết bảo toàn dù các tiết trải trên nhiều chương không có ngày.
        int total = sessions.stream().mapToInt(List::size).sum();
        assertThat(total).isEqualTo(periods.size());
    }

    // ------------------------------------------------------------------
    // Case 12: Sinh lại với nhịp tiết/buổi khác nhau → kết quả gom thay đổi theo nhịp mới
    // ------------------------------------------------------------------

    @Test
    void case12_SinhLaiVoiNhipKhacNhau() {
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 101L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 102L, "BAI_MOI", "Tiết 3"),
                bai(4, 4, 1, 103L, "BAI_MOI", "Tiết 4"),
                bai(5, 5, 1, 104L, "BAI_MOI", "Tiết 5"),
                bai(6, 6, 1, 105L, "BAI_MOI", "Tiết 6")
        );

        // Lần sinh đầu: nhịp 1 tiết/buổi — mỗi tiết một buổi riêng.
        List<List<Period>> lanDau = groupPeriods(periods, 1);
        assertThat(lanDau).hasSize(6);
        assertThat(lanDau).allMatch(s -> s.size() == 1);

        // Sinh lại với nhịp 3 tiết/buổi trên cùng danh sách tiết — kết quả phải đổi theo nhịp mới.
        List<List<Period>> lanSau = groupPeriods(periods, 3);
        assertThat(lanSau).hasSize(2);
        assertThat(lanSau.get(0)).hasSize(3);
        assertThat(lanSau.get(1)).hasSize(3);

        // Tổng số tiết bảo toàn ở cả hai lần sinh — sinh lại không làm mất hay lặp tiết.
        assertThat(lanDau.stream().mapToInt(List::size).sum()).isEqualTo(periods.size());
        assertThat(lanSau.stream().mapToInt(List::size).sum()).isEqualTo(periods.size());
    }

    // ------------------------------------------------------------------
    // Case 13: units_per_session ưu tiên hơn tiet_moi_tuan
    // (tách biệt semantic: gom tiết thành buổi vs. nhịp dạy tuần)
    // ------------------------------------------------------------------

    @Test
    void case13_UnitsPerSessionUuTienHonTietMoiTuan() {
        List<String> warnings = new ArrayList<>();
        // tiet_moi_tuan=3, nhưng units_per_session=2 → phải dùng 2 (không phải 3)
        int result = resolveUnitsPerSession(2, 3, warnings);

        assertThat(result).isEqualTo(2);
        assertThat(warnings).isEmpty(); // Không cần warning khi có units_per_session rõ ràng

        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 101L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 102L, "BAI_MOI", "Tiết 3"),
                bai(4, 4, 1, 103L, "BAI_MOI", "Tiết 4")
        );

        List<List<Period>> sessions = groupPeriods(periods, result);
        assertThat(sessions).hasSize(2); // 4 tiết / 2 tiết/buổi = 2 buổi (theo units_per_session=2)
        assertThat(sessions.get(0)).hasSize(2);
        assertThat(sessions.get(1)).hasSize(2);
    }

    // ------------------------------------------------------------------
    // Case 14: Fallback chain — units_per_session=null → dùng tiet_moi_tuan → có warning tương thích ngược
    // ------------------------------------------------------------------

    @Test
    void case14_FallbackTuUnitsPerSessionVaoTietMoiTuan() {
        List<String> warnings = new ArrayList<>();
        // units_per_session=null, tiet_moi_tuan=3 → fallback về 3, kèm warning
        int result = resolveUnitsPerSession(null, 3, warnings);

        assertThat(result).isEqualTo(3);
        assertThat(warnings).hasSize(1);
        assertThat(warnings.get(0)).contains("units_per_session");
        assertThat(warnings.get(0)).contains("tiet_moi_tuan");

        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 101L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 102L, "BAI_MOI", "Tiết 3"),
                bai(4, 4, 1, 103L, "BAI_MOI", "Tiết 4"),
                bai(5, 5, 1, 104L, "BAI_MOI", "Tiết 5"),
                bai(6, 6, 1, 105L, "BAI_MOI", "Tiết 6")
        );

        List<List<Period>> sessions = groupPeriods(periods, result);
        assertThat(sessions).hasSize(2); // 6 tiết / 3 tiết/buổi = 2 buổi
        assertThat(sessions).allMatch(s -> s.size() == 3);
    }

    // ------------------------------------------------------------------
    // Case 15: BALANCED — chỉ overflow khi tiết kế tiếp là tiết CUỐI CÙNG của lesson;
    // nếu lesson còn nhiều hơn 1 tiết phía sau, cắt đúng ranh giới (chia lesson qua 2 buổi).
    // ------------------------------------------------------------------

    @Test
    void case15_Balanced_CatLessonKhiKhongPhaiTietCuoi() {
        // lesson 200L có 3 tiết (2,3,4) — tiết 2 đã đủ nhịp (unitsPerSession=2) khi xét tiết 3,
        // nhưng tiết 3 KHÔNG phải tiết cuối của lesson 200L (còn tiết 4 phía sau) → cắt ngay.
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 200L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 200L, "BAI_MOI", "Tiết 3"),
                bai(4, 4, 1, 200L, "BAI_MOI", "Tiết 4")
        );

        List<List<Period>> sessions = groupPeriods(periods, 2, "BALANCED", "SEPARATE");

        assertThat(sessions).hasSize(2);
        assertThat(sessions.get(0)).hasSize(2); // tiết 1,2 — cắt đúng ranh giới dù tiết 3 cùng lesson 200L
        assertThat(sessions.get(1)).hasSize(2); // tiết 3,4 — phần còn lại của lesson 200L
    }

    @Test
    void case15b_Balanced_OverflowKhiLaTietCuoiCuaLesson() {
        // lesson 200L chỉ có 2 tiết (2,3) — tiết 3 LÀ tiết cuối của lesson 200L → overflow thêm
        // vào buổi hiện tại để tránh buổi sau chỉ còn đúng 1 tiết mồ côi.
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 200L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 200L, "BAI_MOI", "Tiết 3"),
                bai(4, 4, 1, 300L, "BAI_MOI", "Tiết 4")
        );

        List<List<Period>> sessions = groupPeriods(periods, 2, "BALANCED", "SEPARATE");

        assertThat(sessions).hasSize(2);
        assertThat(sessions.get(0)).hasSize(3); // tiết 1,2,3 — overflow vì tiết 3 là tiết cuối lesson 200L
        assertThat(sessions.get(1)).hasSize(1); // tiết 4
    }

    // ------------------------------------------------------------------
    // Case 16: FIXED_CAPACITY — luôn cắt đúng ranh giới, không bao giờ overflow dù cùng lesson.
    // ------------------------------------------------------------------

    @Test
    void case16_FixedCapacity_KhongBaoGioOverflow() {
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 200L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 200L, "BAI_MOI", "Tiết 3"), // cùng lesson với tiết 2, và là tiết cuối lesson 200L
                bai(4, 4, 1, 300L, "BAI_MOI", "Tiết 4")
        );

        List<List<Period>> sessions = groupPeriods(periods, 2, "FIXED_CAPACITY", "SEPARATE");

        assertThat(sessions).hasSize(2);
        assertThat(sessions.get(0)).hasSize(2); // luôn cắt đúng 2 tiết/buổi, kể cả BALANCED sẽ cho overflow
        assertThat(sessions.get(1)).hasSize(2);
    }

    // ------------------------------------------------------------------
    // Case 17: MERGE — KIEM_TRA gộp chung vào gói bình thường thay vì tách buổi riêng;
    // resolveSessionType vẫn trả EXAM cho buổi có chứa KIEM_TRA dù buổi nhiều tiết.
    // ------------------------------------------------------------------

    @Test
    void case17_Merge_KiemTraGomChungVaVanLaEXAM() {
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, null, "KIEM_TRA", "Kiểm tra 15 phút"),
                bai(3, 3, 1, 101L, "BAI_MOI", "Tiết 3")
        );

        List<List<Period>> sessions = groupPeriods(periods, 3, "KEEP_LESSON", "MERGE");

        // MERGE: không tách buổi riêng cho KIEM_TRA nữa → gom chung theo nhịp bình thường
        assertThat(sessions).hasSize(1);
        assertThat(sessions.get(0)).hasSize(3);

        // Buổi chứa KIEM_TRA (dù nhiều tiết khác) vẫn phải được đánh dấu EXAM để nổi bật trên UI
        assertThat(resolveSessionType(sessions.get(0))).isEqualTo("EXAM");
    }

    @Test
    void case17b_Separate_MacDinhVanTachBuoiRiengChoKiemTra() {
        // Đối chứng: assessment_policy=SEPARATE (mặc định) vẫn giữ hành vi cũ dù truyền qua overload 4 tham số.
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, null, "KIEM_TRA", "Kiểm tra 15 phút"),
                bai(3, 3, 1, 101L, "BAI_MOI", "Tiết 3")
        );

        List<List<Period>> sessions = groupPeriods(periods, 3, "KEEP_LESSON", "SEPARATE");

        assertThat(sessions).hasSize(3);
        assertThat(sessions.get(1)).hasSize(1);
        assertThat(sessions.get(1).get(0).periodKind()).isEqualTo("KIEM_TRA");
    }

    // ------------------------------------------------------------------
    // Case 18: buildTitle — nối tên nhiều lesson trong cùng buổi theo quy tắc
    // 1 lesson → tên đó; 2 lesson → "A · B"; 3+ lesson → "A · B + N nội dung".
    // ------------------------------------------------------------------

    @Test
    void case18_BuildTitle_NoiTenNhieuLesson() {
        // 2 lesson khác nhau trong cùng buổi
        String hai = buildTitle(List.of(
                baiL(1, 1, 1, 100L, "BAI_MOI", "Tiết 1", "Mệnh đề"),
                baiL(2, 2, 1, 200L, "BAI_MOI", "Tiết 2", "Tập hợp")), 3);
        assertThat(hai).isEqualTo("Mệnh đề · Tập hợp");

        // 3 lesson khác nhau trong cùng buổi
        String ba = buildTitle(List.of(
                baiL(1, 1, 1, 100L, "BAI_MOI", "Tiết 1", "Mệnh đề"),
                baiL(2, 2, 1, 200L, "BAI_MOI", "Tiết 2", "Tập hợp"),
                baiL(3, 3, 1, 300L, "BAI_MOI", "Tiết 3", "Các phép toán tập hợp")), 3);
        assertThat(ba).isEqualTo("Mệnh đề · Tập hợp + 1 nội dung");

        // Cùng 1 lesson trải nhiều tiết → chỉ 1 tên duy nhất, không lặp
        String motLesson = buildTitle(List.of(
                baiL(1, 1, 1, 100L, "BAI_MOI", "Tiết 1", "Mệnh đề"),
                baiL(2, 2, 1, 100L, "BAI_MOI", "Tiết 2", "Mệnh đề")), 3);
        assertThat(motLesson).isEqualTo("Mệnh đề");

        // Buổi 1 tiết ưu tiên lesson_title hơn title của tiết
        String motTiet = buildTitle(List.of(
                baiL(1, 1, 1, 100L, "BAI_MOI", "Tiết 1", "Mệnh đề")), 3);
        assertThat(motTiet).isEqualTo("Mệnh đề");
    }

    // ------------------------------------------------------------------
    // Case 19: computeContinuationFlags — buổi đầu luôn false; buổi sau true khi tiết đầu
    // cùng lesson_id với tiết cuối buổi liền trước (lesson bị cắt qua ranh giới 2 buổi).
    // ------------------------------------------------------------------

    @Test
    void case19_ContinuationFlags_PhatHienLessonBiCat() {
        List<Period> periods = List.of(
                bai(1, 1, 1, 100L, "BAI_MOI", "Tiết 1"),
                bai(2, 2, 1, 200L, "BAI_MOI", "Tiết 2"),
                bai(3, 3, 1, 200L, "BAI_MOI", "Tiết 3"),
                bai(4, 4, 1, 200L, "BAI_MOI", "Tiết 4"),
                bai(5, 5, 1, 300L, "BAI_MOI", "Tiết 5")
        );

        // FIXED_CAPACITY cắt đúng 2 tiết/buổi → lesson 200L (tiết 2,3,4) bị cắt qua 2 buổi
        List<List<Period>> sessions = groupPeriods(periods, 2, "FIXED_CAPACITY", "SEPARATE");
        assertThat(sessions).hasSize(3); // [1,2] [3,4] [5]

        List<Boolean> flags = computeContinuationFlags(sessions);
        assertThat(flags).hasSize(3);
        assertThat(flags.get(0)).isFalse();  // buổi đầu luôn false
        assertThat(flags.get(1)).isTrue();   // buổi 2 bắt đầu bằng tiết 3, cùng lesson 200L với tiết 2 (cuối buổi 1)
        assertThat(flags.get(2)).isFalse();  // buổi 3 (lesson 300L) không tiếp nối lesson 200L
    }

    // ------------------------------------------------------------------
    // Case 20-21: Đổi mạch (strand) luôn cắt buổi mới — một buổi không bao giờ được gộp tiết
    // từ hai mạch khác nhau (Đại số / Hình học / Chuyên đề chạy song song theo tuần), kể cả khi
    // buổi hiện tại chưa đủ nhịp unitsPerSession. Đây là bug thực tế: query sinh buổi sắp tiết
    // theo (week_no, strand.order_index, period_no) trên TOÀN BỘ các mạch gộp chung một danh
    // sách phẳng, nên nếu không chặn ở đây, buổi sẽ lẫn lộn nội dung của nhiều mạch khác nhau.
    // ------------------------------------------------------------------

    @Test
    void case20_DoiMachLuonCatBuoiMoi_DuChuaDuNhip() {
        // unitsPerSession=3 nhưng mạch đổi ngay sau tiết đầu — phải cắt buổi ngay, không chờ đủ nhịp.
        List<Period> periods = List.of(
                baiS(1, 1, 1, 100L, "BAI_MOI", "Đại số - Tiết 1", 1L),
                baiS(2, 1, 1, 200L, "BAI_MOI", "Hình học - Tiết 1", 2L),
                baiS(3, 2, 1, 100L, "BAI_MOI", "Đại số - Tiết 2", 1L)
        );

        List<List<Period>> sessions = groupPeriods(periods, 3);

        assertThat(sessions).hasSize(3);
        assertThat(sessions.get(0)).hasSize(1);
        assertThat(sessions.get(0).get(0).strandId()).isEqualTo(1L);
        assertThat(sessions.get(1)).hasSize(1);
        assertThat(sessions.get(1).get(0).strandId()).isEqualTo(2L);
        assertThat(sessions.get(2)).hasSize(1);
        assertThat(sessions.get(2).get(0).strandId()).isEqualTo(1L);
    }

    @Test
    void case21_CungMachGomBinhThuong_DoiMachCatNgayVaBatDauNhipMoi() {
        // Cùng mạch → gom bình thường theo nhịp; đổi mạch giữa chừng → cắt ngay dù buổi hiện tại
        // chưa đầy, và buổi mới đếm nhịp lại từ đầu (không dồn phần dư từ mạch trước).
        List<Period> periods = List.of(
                baiS(1, 1, 1, 100L, "BAI_MOI", "Tiết 1", 1L),
                baiS(2, 2, 1, 100L, "BAI_MOI", "Tiết 2", 1L),
                baiS(3, 1, 1, 200L, "BAI_MOI", "Tiết 1", 2L),
                baiS(4, 2, 1, 201L, "BAI_MOI", "Tiết 2", 2L),
                baiS(5, 3, 1, 202L, "BAI_MOI", "Tiết 3", 2L)
        );

        List<List<Period>> sessions = groupPeriods(periods, 2);

        assertThat(sessions).hasSize(3);
        assertThat(sessions.get(0)).hasSize(2); // mạch 1: tiết 1,2
        assertThat(sessions.get(1)).hasSize(2); // mạch 2: tiết 1,2 (đúng nhịp 2)
        assertThat(sessions.get(2)).hasSize(1); // mạch 2: tiết 3 còn lại
    }
}
