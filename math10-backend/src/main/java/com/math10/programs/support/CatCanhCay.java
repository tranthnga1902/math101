package com.math10.programs.support;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Dấu xoá của cây chương trình: cắt ở đâu thì đóng dấu xuống hết nhánh dưới đó.
 *
 * <p>Trước lớp này, xoá mềm chỉ đóng dấu lên đúng dòng bị xoá. Xoá một chương thì các bài của nó
 * vẫn còn {@code deleted_at} rỗng, nên chúng vẫn là bài đang sống với mọi đường đọc hỏi thẳng bài:
 * dạng bài, luồng nội dung, tài liệu của bài, và {@code /api/public/lessons/&#123;code&#125;} —
 * đường sau cùng là {@code permitAll}, tức ra tới người chưa đăng nhập. Mà trên màn hình quản trị
 * thì chương đã biến mất, nên không còn lối nào để tìm ra mấy bài ấy mà dọn.
 *
 * <p>Có hai cách chữa. Cách thứ nhất: mọi đường đọc phải tự join ngược lên cha, ông, cụ. Cách ấy đã
 * thử rồi và đã thua bốn lần — mỗi đường đọc mới là một lần phải nhớ lại, quên một chỗ là rò một
 * chỗ. Cách thứ hai, chọn ở đây: giữ cho <em>dấu xoá luôn đầy đủ</em>, để mỗi đường đọc chỉ cần
 * lọc {@code deleted_at is null} trên chính bảng của nó — đúng thứ tất cả chúng đã làm sẵn. Một cơ
 * chế, một chỗ sửa.
 *
 * <p>Câu truy vấn con cố ý <b>không</b> lọc {@code deleted_at} ở tầng giữa: nếu một bài đã bị xoá
 * từ trước mà con của nó còn sót lại, lượt cắt này dọn luôn thay vì bỏ qua.
 *
 * <p>Chưa với tới {@code lesson_documents} và {@code lesson_resources}. Hai bảng ấy là việc của
 * Lát 8 — chúng sẽ bị rút khỏi mọi đường đọc ở đó — nên đóng dấu vào hai bảng sắp gỡ là làm việc
 * để rồi xoá đi. Không có lỗ nào hở vì {@code listLessonDocuments} nạp thực thể {@code Lesson}
 * trước, mà {@code Lesson} có {@code @SQLRestriction}: bài đã đóng dấu thì nó trả 404.
 */
@Component
@RequiredArgsConstructor
public class CatCanhCay {

    private final JdbcTemplate jdbc;

    /** Dưới một bài: dạng bài và mục luồng nội dung. */
    public void duoiBai(Long bai) {
        dong("exercise_types", "lesson_id = ?", bai);
        dong("program_resources", "lesson_id = ?", bai);
    }

    /** Dưới một chương: các bài của nó, và mọi thứ dưới các bài ấy. */
    public void duoiChuong(Long chuong) {
        String baiCuaChuong = "lesson_id in (select id from lessons where chapter_id = ?)";
        dong("exercise_types", baiCuaChuong, chuong);
        dong("program_resources", baiCuaChuong, chuong);
        dong("lessons", "chapter_id = ?", chuong);
    }

    /** Dưới một chương trình: cả cây. */
    public void duoiChuongTrinh(Long chuongTrinh) {
        String baiCuaChuongTrinh = """
                lesson_id in (select l.id from lessons l
                                join chapters ch on ch.id = l.chapter_id
                               where ch.course_id = ?)""";
        dong("exercise_types", baiCuaChuongTrinh, chuongTrinh);
        dong("program_resources", baiCuaChuongTrinh, chuongTrinh);
        dong("lessons", "chapter_id in (select id from chapters where course_id = ?)", chuongTrinh);
        dong("chapters", "course_id = ?", chuongTrinh);
    }

    // Điều kiện "and deleted_at is null" giữ cho lượt cắt không dẫm lên dấu thời gian của một lần
    // xoá trước: dòng đã xoá hôm qua phải giữ nguyên ngày hôm qua.
    private void dong(String bang, String dieuKien, Long id) {
        jdbc.update("update " + bang + " set deleted_at = now(), updated_at = now() where "
                + dieuKien + " and deleted_at is null", id);
    }
}
