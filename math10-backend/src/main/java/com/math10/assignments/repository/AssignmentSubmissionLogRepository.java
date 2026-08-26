package com.math10.assignments.repository;

import com.math10.assignments.entity.AssignmentSubmissionLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssignmentSubmissionLogRepository extends JpaRepository<AssignmentSubmissionLog, Long> {

    Page<AssignmentSubmissionLog> findByClassIdOrderByCreatedAtDesc(Long classId, Pageable pageable);

    Page<AssignmentSubmissionLog> findByClassIdAndStudentIdOrderByCreatedAtDesc(Long classId, Long studentId, Pageable pageable);
}
