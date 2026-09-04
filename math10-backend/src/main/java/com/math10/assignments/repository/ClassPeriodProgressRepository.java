package com.math10.assignments.repository;
import com.math10.assignments.entity.ClassPeriodProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;
public interface ClassPeriodProgressRepository extends JpaRepository<ClassPeriodProgress,Long>{
 Optional<ClassPeriodProgress> findByClassIdAndPeriodIdAndDeletedAtIsNull(Long classId,Long periodId);
 List<ClassPeriodProgress> findByClassIdOrderByClosedAtDesc(Long classId);
}
