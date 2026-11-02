package com.math10.assignments.repository;

import com.math10.assignments.entity.SubmissionItemGrade;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;

public interface SubmissionItemGradeRepository extends JpaRepository<SubmissionItemGrade, Long> {

    /** Bảng điểm từng câu của một bài nộp. Thứ tự hiển thị lấy theo đề, không lấy theo bảng này. */
    List<SubmissionItemGrade> findByProgressId(Long progressId);

    /**
     * Điểm từng câu của nhiều bài nộp trong một lượt hỏi. Dùng cho nút "Chấm lại cả lớp": hỏi
     * riêng từng em thì lớp 40 học sinh thành 40 lượt hỏi cơ sở dữ liệu cho một cú bấm nút.
     */
    List<SubmissionItemGrade> findByProgressIdIn(Collection<Long> progressIds);

    /**
     * Xoá thẳng, không đánh dấu xoá: ràng buộc duy nhất {@code (progress_id, problem_id)} không
     * tính {@code deleted_at}, nên dòng đánh dấu xoá vẫn chặn lần chấm sau.
     *
     * <p>Viết bằng {@code @Modifying} thay vì tải lên rồi {@code deleteAll}: chỗ gọi là "học sinh
     * nộp lại" và "giáo viên chuyển sang chấm cả bài", cả hai đều chỉ cần bảng sạch chứ không cần
     * đọc nội dung cũ.
     */
    @Modifying
    @Query("delete from SubmissionItemGrade g where g.progressId = :progressId")
    int deleteByProgressId(@Param("progressId") Long progressId);
}
