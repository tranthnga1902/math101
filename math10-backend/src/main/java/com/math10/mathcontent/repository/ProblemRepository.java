package com.math10.mathcontent.repository;
import com.math10.mathcontent.entity.Problem;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface ProblemRepository extends JpaRepository<Problem,Long>{
 List<Problem> findByProblemTypeIdOrderByCreatedAtDesc(Long problemTypeId);
 Optional<Problem> findByQrSlugAndStatus(String qrSlug,String status);
 boolean existsByPublicCode(String code); boolean existsByQrSlug(String slug);
 long countByStatus(String status);
}
