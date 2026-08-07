package com.math10.mathcontent.repository;
import com.math10.mathcontent.entity.ProblemType;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ProblemTypeRepository extends JpaRepository<ProblemType,Long>{List<ProblemType> findByTopicIdOrderByName(Long topicId);}
