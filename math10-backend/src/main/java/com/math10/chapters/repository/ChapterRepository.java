package com.math10.chapters.repository;

import com.math10.chapters.entity.Chapter;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.List;

public interface ChapterRepository extends JpaRepository<Chapter, Long>, JpaSpecificationExecutor<Chapter> {

    List<Chapter> findByCourseIdOrderByOrderIndexAsc(Long courseId);
}
