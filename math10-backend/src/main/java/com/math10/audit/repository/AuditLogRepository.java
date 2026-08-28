package com.math10.audit.repository;

import com.math10.audit.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByTargetTypeAndTargetIdOrderByCreatedAtDesc(String targetType, Long targetId);

    /**
     * Mỗi tham số null nghĩa là "không lọc theo tiêu chí này". Viết một truy vấn nhận cả sáu
     * thay vì sáu phương thức dẫn xuất tên, vì màn hình quản trị cho phép kết hợp tuỳ ý.
     *
     * <p>{@code actorRole} lọc qua truy vấn con sang {@code users} thay vì lưu vai trò vào chính
     * dòng nhật ký: vai trò của một người có thể đổi, và nhật ký phải trả lời "hôm nay ai là giáo
     * viên đã làm việc này" theo danh sách hiện hành chứ không theo bản chụp lúc ghi.</p>
     *
     * <p>Mốc thời gian dùng {@code coalesce} chứ không dùng {@code :from is null} như năm tiêu chí
     * kia. Trình điều khiển PostgreSQL gửi kiểu "unspecified" cho tham số timestamp mang giá trị
     * null — nó không tự phân biệt được {@code timestamp} với {@code timestamptz} — nên vế
     * {@code ? is null} đứng một mình khiến CSDL bó tay: <i>could not determine data type</i>, và
     * cả endpoint trả 500. Đặt tham số vào trong {@code coalesce} cạnh chính cột {@code created_at}
     * thì CSDL suy ra được kiểu; không lọc ngày thì vế này thành {@code created_at >= created_at},
     * tức là luôn đúng. Năm tiêu chí kia là số và chuỗi, trình điều khiển gửi kèm kiểu nên không
     * dính lỗi này.</p>
     */
    @Query("""
            select l from AuditLog l
            where (:actorUserId is null or l.actorUserId = :actorUserId)
              and (:actorRole is null or l.actorUserId in (select u.id from User u where u.roleCode = :actorRole))
              and (:targetType is null or l.targetType = :targetType)
              and (:targetId is null or l.targetId = :targetId)
              and (:action is null or l.action = :action)
              and l.createdAt >= coalesce(:from, l.createdAt)
            """)
    Page<AuditLog> search(@Param("actorUserId") Long actorUserId,
                          @Param("actorRole") String actorRole,
                          @Param("targetType") String targetType,
                          @Param("targetId") Long targetId,
                          @Param("action") String action,
                          @Param("from") LocalDateTime from,
                          Pageable pageable);
}
