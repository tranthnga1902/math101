package com.math10.assignments.entity;

import com.math10.common.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SQLRestriction;

import java.time.LocalDateTime;

/**
 * Lớp X đã học xong tiết Y lúc Z.
 *
 * <p>Đây là sự kiện, không phải lịch: tiết vẫn là tiết của chương trình dùng chung, dòng này chỉ
 * nói lớp này đi tới đó lúc nào. Nhờ vậy "buổi không gắn ngày" vẫn đứng, mà hạn nộp vẫn nói được
 * câu "trước buổi sau".
 *
 * <p>{@code closedAt} tách khỏi {@code createdAt} có lý do: dạy bù hôm thứ Bảy, chủ nhật mới bấm
 * hoàn thành thì hai giờ ấy khác nhau, và cái mở bài giao phải là giờ học chứ không phải giờ bấm.
 */
@Getter
@Setter
@Entity
@Table(name = "class_period_progress")
@SQLRestriction("deleted_at IS NULL")
public class ClassPeriodProgress extends BaseEntity {

    @Column(name = "class_id", nullable = false)
    private Long classId;

    /** Tiết của chương trình ({@code program_periods}), không phải buổi có ngày. */
    @Column(name = "period_id", nullable = false)
    private Long periodId;

    @Column(name = "closed_at", nullable = false)
    private LocalDateTime closedAt;

    @Column(name = "closed_by", nullable = false)
    private Long closedBy;

    @Column(length = 500)
    private String note;
}
