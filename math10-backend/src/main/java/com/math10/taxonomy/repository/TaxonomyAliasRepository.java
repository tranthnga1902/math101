package com.math10.taxonomy.repository;

import com.math10.taxonomy.entity.TaxonomyAlias;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TaxonomyAliasRepository extends JpaRepository<TaxonomyAlias, Long> {

    List<TaxonomyAlias> findByNodeId(Long nodeId);

    boolean existsByNodeIdAndSlug(Long nodeId, String slug);
}
