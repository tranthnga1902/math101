package com.math10.chapters.repository;

import com.math10.chapters.entity.Chapter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ChapterRepository extends JpaRepository<Chapter, Long>, JpaSpecificationExecutor<Chapter> {

    List<Chapter> findByCourseIdOrderByOrderIndexAsc(Long courseId);

    /** Cùng luật {@link com.math10.programs.support.LuongNoiDung#BAI_MO}: chương mở khi chương trình chứa nó đã xuất bản. */
    @Query("""
            select count(c) > 0 from Chapter ch, com.math10.courses.entity.Course c
            where ch.id = :chapterId and c.id = ch.courseId
              and c.status = com.math10.courses.entity.CourseStatus.PUBLISHED""")
    boolean chuongTrinhDaXuatBan(@Param("chapterId") Long chapterId);
}
