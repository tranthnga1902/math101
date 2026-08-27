package com.math10.assignments.domain;

import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentProgress;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Map;

/**
 * Dựng lại {@link Assignment} / {@link AssignmentProgress} từ một dòng {@code queryForList}.
 *
 * <p>Có lớp này vì vài màn hình đọc bài giao bằng SQL viết tay chứ không qua repository, mà luật
 * vòng đời thì chỉ được có một bản. Dựng lại thực thể rồi hỏi {@link AssignmentWindow} thì màn
 * hình nào cũng trả lời giống nhau; viết lại điều kiện bằng SQL ở từng chỗ là chỗ chúng lệch nhau.
 *
 * <p>Cột thiếu được coi như chưa đặt (null) để {@link AssignmentWindow} áp mặc định của nó, trùng
 * với mặc định của cột trong cơ sở dữ liệu.
 */
public final class AssignmentRows {

    private AssignmentRows() {
    }

    public static Assignment assignment(Map<String, Object> row) {
        Assignment assignment = new Assignment();
        assignment.setId(number(row.get("id")));
        assignment.setStatus(text(row.get("status")));
        assignment.setOpenAt(dateTime(row.get("open_at")));
        assignment.setDueAt(dateTime(row.get("due_at")));
        assignment.setLessonId(number(row.get("lesson_id")));
        assignment.setWorksheetId(number(row.get("worksheet_id")));
        assignment.setMaxAttempts(integer(row.get("max_attempts")));
        assignment.setLatePolicy(text(row.get("late_policy")));
        assignment.setLatePenaltyPercent(integer(row.get("late_penalty_percent")));
        assignment.setPublishScoreAt(dateTime(row.get("publish_score_at")));
        return assignment;
    }

    public static AssignmentProgress progress(Map<String, Object> row) {
        AssignmentProgress progress = new AssignmentProgress();
        progress.setGradedAt(dateTime(row.get("graded_at")));
        progress.setReturnedAt(dateTime(row.get("returned_at")));
        progress.setSubmittedAt(dateTime(row.get("submitted_at")));
        progress.setAttemptNo(integer(row.get("attempt_no")));
        progress.setSubmittedLate(Boolean.TRUE.equals(row.get("submitted_late")));
        progress.setScore(decimal(row.get("score")));
        progress.setMaxScore(decimal(row.get("max_score")));
        return progress;
    }

    private static Long number(Object value) {
        return value == null ? null : ((Number) value).longValue();
    }

    private static Integer integer(Object value) {
        return value == null ? null : ((Number) value).intValue();
    }

    private static String text(Object value) {
        return value == null ? null : value.toString();
    }

    private static BigDecimal decimal(Object value) {
        return value == null ? null : new BigDecimal(value.toString());
    }

    private static LocalDateTime dateTime(Object value) {
        return value == null ? null : ((Timestamp) value).toLocalDateTime();
    }
}
