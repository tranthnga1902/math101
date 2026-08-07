package com.math10.mathcontent.repository;
import com.math10.mathcontent.entity.ProblemHint;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ProblemHintRepository extends JpaRepository<ProblemHint,Long>{List<ProblemHint> findByProblemIdOrderByOrderIndex(Long id);}
