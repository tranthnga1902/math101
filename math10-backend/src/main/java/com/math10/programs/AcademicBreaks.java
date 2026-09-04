package com.math10.programs;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Một chỗ duy nhất trả lời "ngày này có nghỉ không".
 *
 * <p>Hai màn hình hỏi câu này: màn hình khóa của Admin biết sẵn mình đang xem khóa nào, còn màn
 * hình học sinh chỉ biết chương trình. Nếu mỗi bên tự viết câu truy vấn của mình thì sớm muộn hai
 * bên lệch nhau, và lệch theo kiểu tệ nhất — học sinh được báo nghỉ còn giáo viên thì không, hoặc
 * ngược lại. Nên cả hai đi qua lớp này.
 */
@Component
@RequiredArgsConstructor
public class AcademicBreaks {
    private final JdbcTemplate jdbc;

    /** Kỳ nghỉ đang phủ lên {@code at} của một khóa cụ thể. */
    public Optional<Break> of(Long courseInstanceId, LocalDate at) {
        return first(jdbc.query("""
                select id, starts_on, ends_on, reason from academic_breaks
                where course_instance_id=? and deleted_at is null and ? between starts_on and ends_on
                order by ends_on desc limit 1
                """, this::map, courseInstanceId, at));
    }

    /**
     * Kỳ nghỉ của khóa mà người dùng đang theo học chương trình này — với tư cách học sinh hay
     * giáo viên đều được.
     *
     * <p>Đường đọc mức chương trình không mang theo khóa nào, nên khóa phải suy ra từ lớp của người
     * gọi. Người không thuộc lớp nào (Admin đang xem chương trình chung) thì không có khóa, và
     * không có khóa thì không có kỳ nghỉ — đó là câu trả lời đúng chứ không phải chỗ thiếu sót:
     * chương trình không nghỉ, khóa mới nghỉ.
     */
    public Optional<Break> forUser(Long userId, Long programId, LocalDate at) {
        return first(jdbc.query("""
                select ab.id, ab.starts_on, ab.ends_on, ab.reason from academic_breaks ab
                join course_instances ci on ci.id=ab.course_instance_id and ci.deleted_at is null
                join program_templates pt on pt.id=ci.template_id and pt.deleted_at is null
                join class_courses cc on cc.course_instance_id=ci.id and cc.deleted_at is null
                where pt.program_id=? and ab.deleted_at is null and ? between ab.starts_on and ab.ends_on
                  and (exists(select 1 from class_students cs
                              where cs.class_id=cc.class_id and cs.student_id=? and cs.deleted_at is null)
                    or exists(select 1 from class_teachers ct
                              where ct.class_id=cc.class_id and ct.teacher_id=? and ct.deleted_at is null))
                order by ab.ends_on desc limit 1
                """, this::map, programId, at, userId, userId));
    }

    /**
     * Toàn bộ kỳ nghỉ của một khóa, xếp theo ngày bắt đầu.
     *
     * <p>Bộ sinh lịch tuần cần cả danh sách chứ không phải một ngày, nên nó cần cửa này. Viết thẳng
     * một câu {@code select} trong bộ sinh thì nhanh hơn, nhưng khi ấy sẽ có hai chỗ biết cách đọc
     * bảng kỳ nghỉ — và cái thứ hai sẽ là cái quên mất {@code deleted_at} vào một ngày nào đó.
     */
    public List<Break> all(Long courseInstanceId) {
        return jdbc.query("""
                select id, starts_on, ends_on, reason from academic_breaks
                where course_instance_id=? and deleted_at is null
                order by starts_on, ends_on
                """, this::map, courseInstanceId);
    }

    private Optional<Break> first(List<Break> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    private Break map(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        return new Break(rs.getLong("id"), rs.getDate("starts_on").toLocalDate(),
                rs.getDate("ends_on").toLocalDate(), rs.getString("reason"));
    }

    /** Lý do đi kèm ngày: màn hình phải nói được nghỉ vì gì và bao giờ học lại. */
    public record Break(Long id, LocalDate startsOn, LocalDate endsOn, String reason) {}
}
