package com.math10.assignments.repository;
import com.math10.assignments.entity.AssignmentProgress;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface AssignmentProgressRepository extends JpaRepository<AssignmentProgress,Long>{Optional<AssignmentProgress> findByAssignmentIdAndStudentId(Long assignmentId,Long studentId);}
