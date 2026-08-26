package com.math10.taxonomy.repository;

import com.math10.taxonomy.entity.TaxonomyNode;
import com.math10.taxonomy.entity.TaxonomyStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;

public interface TaxonomyNodeRepository extends JpaRepository<TaxonomyNode, Long> {

    List<TaxonomyNode> findBySubjectAndStatusNotOrderByDepthAscOrderNoAsc(String subject, TaxonomyStatus excludedStatus);

    List<TaxonomyNode> findByParentId(Long parentId);

    boolean existsByParentIdAndSlug(Long parentId, String slug);

    long countByParentIdAndStatusNotIn(Long parentId, Collection<TaxonomyStatus> statuses);

    long countByMergedInto(Long targetId);

    @Query(value = """
        select a.id as nodeAId, a.title as nodeATitle, b.id as nodeBId, b.title as nodeBTitle,
               similarity(a.slug, b.slug) as similarity
        from taxonomy_node a
        join taxonomy_node b on a.id < b.id and a.subject = b.subject
        where a.deleted_at is null and b.deleted_at is null
          and a.status in ('ACTIVE','PENDING') and b.status in ('ACTIVE','PENDING')
          and a.depth = b.depth
          and similarity(a.slug, b.slug) >= 0.6
        order by similarity desc
        """, nativeQuery = true)
    List<DuplicatePairProjection> findDuplicateSuggestions();

    long countByParentId(Long parentId);
}
