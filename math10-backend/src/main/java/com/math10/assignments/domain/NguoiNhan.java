package com.math10.assignments.domain;

import com.math10.assignments.entity.Assignment;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Ai nhận được một bài giao — đúng một luật, một chỗ.
 *
 * <p>Bài giao vốn chỉ gắn với lớp, nên "ai nhận" và "lớp nào" là một, và mỗi màn hình tự viết
 * {@code join class_students} là đủ đúng. Từ lúc có {@code target_scope} thì hai câu ấy tách ra:
 * một bài SELECTED vẫn thuộc lớp nhưng chỉ vài em nhận. Màn hình nào còn hỏi câu cũ sẽ phát bài
 * học bù cho cả lớp — im lặng, không lỗi, và chỉ lộ ra khi có phụ huynh hỏi.
 *
 * <p>Vì vậy mảnh SQL nằm ở đây chứ không chép vào từng câu, theo đúng khuôn
 * {@code LuongNoiDung}: sáu cửa đọc, một sự thật. Thiếu một cửa là rò.
 *
 * <p><b>Đọc bảng mà không đọc cột thì hiểu ngược.</b> {@code assignment_targets} rỗng nghĩa là
 * <em>cả lớp</em> chứ không phải <em>không ai</em> — {@code target_scope} mới là thứ quyết định,
 * và mảnh SQL dưới đây luôn hỏi cả hai.
 */
@Component
@RequiredArgsConstructor
public class NguoiNhan {

    private final com.math10.assignments.repository.AssignmentTargetRepository targets;
    private final com.math10.enrollments.repository.ClassStudentRepository classStudents;

    /**
     * Điều kiện "em này nhận được bài này", để dán vào mệnh đề {@code where}.
     *
     * <p>Bám hai bí danh: {@code a} là {@code assignments}, {@code cs} là {@code class_students}.
     * Cả sáu câu đọc bài giao đã đặt sẵn hai bí danh ấy — đó là lý do mảnh này dán được mà không
     * phải sửa cấu trúc câu nào.
     *
     * <p>Phép so vẫn là {@code cs.student_id} chứ không phải tham số học sinh, vì có câu (sổ điểm)
     * quét mọi em trong lớp một lượt chứ không hỏi cho một em.
     */
    public static final String NHAN_DUOC =
            "(a.target_scope='CLASS' or exists(select 1 from assignment_targets t"
          + " where t.assignment_id=a.id and t.student_id=cs.student_id and t.deleted_at is null))";

    /** Bản dành cho câu đặt bí danh khác cho bảng học sinh của lớp. */
    public static String nhanDuoc(String biDanhBai, String cotHocSinh) {
        return "(" + biDanhBai + ".target_scope='CLASS' or exists(select 1 from assignment_targets t"
             + " where t.assignment_id=" + biDanhBai + ".id and t.student_id=" + cotHocSinh
             + " and t.deleted_at is null))";
    }

    /**
     * Cùng câu hỏi, hỏi qua đường JPA — dùng ở hai cửa không có SQL để dán mảnh vào.
     *
     * <p>Có cả trong lớp lẫn trong danh sách chọn mới là nhận: rời lớp thì mất bài kể cả khi dòng
     * target còn đó, nếu không thì xoá em khỏi lớp vẫn để lại một đường vào.
     */
    public boolean nhanDuoc(Assignment bai, Long hocSinhId) {
        if (!classStudents.existsByClassIdAndStudentId(bai.getClassId(), hocSinhId)) return false;
        if (!"SELECTED".equals(bai.getTargetScope())) return true;
        return targets.existsByAssignmentIdAndStudentId(bai.getId(), hocSinhId);
    }

    /** Danh sách em được chọn; rỗng khi bài giao cho cả lớp. */
    public List<Long> hocSinhDuocChon(Long baiGiaoId) {
        return targets.findByAssignmentId(baiGiaoId).stream()
                .map(com.math10.assignments.entity.AssignmentTarget::getStudentId).toList();
    }
}
