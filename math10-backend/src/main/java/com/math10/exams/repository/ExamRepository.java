package com.math10.exams.repository;
import com.math10.exams.entity.Exam;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ExamRepository extends JpaRepository<Exam,Long>{
 List<Exam> findByScopeOrderByCreatedAtDesc(String scope);
 List<Exam> findByClassIdOrderByCreatedAtDesc(Long classId);
 List<Exam> findByCourseInstanceIdOrderByCreatedAtDesc(Long courseInstanceId);
}
