package com.math10.users.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDateTime;
import java.util.Map;

/**
 * Vị trí học gần nhất của một người dùng. Không kế thừa {@code BaseEntity} vì bảng này
 * cố tình mỗi người đúng một dòng — user_id làm khóa chính, ghi mới là ghi đè, không
 * có lịch sử và cũng không xóa mềm.
 */
@Getter
@Setter
@Entity
@Table(name = "user_last_position")
public class UserLastPosition {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false, length = 512)
    private String route;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb")
    private Map<String, Object> context;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
