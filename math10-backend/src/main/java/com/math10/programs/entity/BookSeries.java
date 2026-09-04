package com.math10.programs.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

/**
 * Bộ sách giáo khoa (Cánh Diều, Kết nối tri thức, Chân trời sáng tạo…). Một khối lớp dạy theo
 * nhiều bộ, nên chương trình trỏ tới bộ sách của nó thay vì gói tên bộ sách vào tên chương trình.
 */
@Getter @Setter @Entity
@Table(name = "book_series")
@SQLRestriction("deleted_at IS NULL")
public class BookSeries extends BaseEntity {
    @Column(nullable=false, length=50) private String code;
    @Column(nullable=false, length=180) private String name;
    @Column(length=180) private String publisher;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=30) private BookSeriesStatus status = BookSeriesStatus.ACTIVE;
    @Column(name="order_no", nullable=false) private Integer orderNo = 0;
}
