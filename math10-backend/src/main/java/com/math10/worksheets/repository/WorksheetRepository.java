package com.math10.worksheets.repository;
import com.math10.worksheets.entity.Worksheet;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface WorksheetRepository extends JpaRepository<Worksheet,Long>{
 List<Worksheet> findByCreatedByOrderByCreatedAtDesc(Long userId);
 List<Worksheet> findByLessonIdOrderByCreatedAtAsc(Long lessonId);
}
