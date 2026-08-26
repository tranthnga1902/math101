package com.math10.classes.repository;

import com.math10.classes.entity.ClassCurriculum;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClassCurriculumRepository extends JpaRepository<ClassCurriculum, Long> {

    List<ClassCurriculum> findByClassIdOrderByOrderNoAscIdAsc(Long classId);

    Optional<ClassCurriculum> findByIdAndClassId(Long id, Long classId);

    boolean existsByClassIdAndTaxonomyNodeId(Long classId, Long taxonomyNodeId);

    long countByClassId(Long classId);
}
