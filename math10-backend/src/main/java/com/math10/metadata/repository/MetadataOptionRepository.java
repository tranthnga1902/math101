package com.math10.metadata.repository;

import com.math10.metadata.entity.MetadataOptionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface MetadataOptionRepository extends JpaRepository<MetadataOptionEntity, Long> {
    List<MetadataOptionEntity> findByCategoryInAndActiveTrueOrderByCategoryAscSortOrderAscValueAsc(Collection<String> categories);
}
