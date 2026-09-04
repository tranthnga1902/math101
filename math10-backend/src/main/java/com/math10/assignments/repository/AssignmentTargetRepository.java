package com.math10.assignments.repository;
import com.math10.assignments.entity.AssignmentTarget;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface AssignmentTargetRepository extends JpaRepository<AssignmentTarget,Long>{
 List<AssignmentTarget> findByAssignmentId(Long assignmentId);
 boolean existsByAssignmentIdAndStudentId(Long assignmentId,Long studentId);
}
