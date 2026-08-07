package com.math10.mathcontent.repository;
import com.math10.mathcontent.entity.SolutionStep;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface SolutionStepRepository extends JpaRepository<SolutionStep,Long>{List<SolutionStep> findByProblemIdOrderByOrderIndex(Long id);}
