package com.math10.assignments.repository;
import com.math10.assignments.entity.Assignment;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface AssignmentRepository extends JpaRepository<Assignment,Long>{List<Assignment> findByClassIdOrderByCreatedAtDesc(Long classId);}
