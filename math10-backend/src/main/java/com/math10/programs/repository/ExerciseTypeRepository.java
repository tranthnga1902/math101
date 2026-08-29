package com.math10.programs.repository;

import com.math10.programs.entity.ExerciseType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ExerciseTypeRepository extends JpaRepository<ExerciseType, Long> {
    List<ExerciseType> findByLessonIdOrderByOrderIndexAsc(Long lessonId);
}
