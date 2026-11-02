package com.math10.metadata.repository;

import com.math10.metadata.entity.MetadataOptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface MetadataOptionRepository extends JpaRepository<MetadataOptionEntity, Long> {
    List<MetadataOptionEntity> findByCategoryInAndActiveTrueOrderByCategoryAscSortOrderAscValueAsc(Collection<String> categories);

    Optional<MetadataOptionEntity> findByCategoryAndValue(String category, String value);

    boolean existsByCategoryAndValueAndActiveTrue(String category, String value);

    boolean existsByCategoryAndLabelIgnoreCaseAndActiveTrue(String category, String label);

    @org.springframework.data.jpa.repository.Query("select coalesce(max(o.sortOrder),0) from MetadataOptionEntity o where o.category = :category")
    int maxSortOrder(@org.springframework.data.repository.query.Param("category") String category);
}
