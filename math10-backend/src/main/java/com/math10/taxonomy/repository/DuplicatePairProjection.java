package com.math10.taxonomy.repository;

public interface DuplicatePairProjection {
    Long getNodeAId();
    String getNodeATitle();
    Long getNodeBId();
    String getNodeBTitle();
    Double getSimilarity();
}
