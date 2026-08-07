package com.math10.progress.repository;

import com.math10.progress.entity.LearningProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;

public interface LearningProgressRepository extends JpaRepository<LearningProgress, Long>, JpaSpecificationExecutor<LearningProgress> {

    Optional<LearningProgress> findByStudentIdAndLessonId(Long studentId, Long lessonId);
    Optional<LearningProgress> findByStudentIdAndWorksheetId(Long studentId, Long worksheetId);
}
