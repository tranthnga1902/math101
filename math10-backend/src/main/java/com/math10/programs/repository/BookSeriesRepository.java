package com.math10.programs.repository;

import com.math10.programs.entity.BookSeries;
import com.math10.programs.entity.BookSeriesStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BookSeriesRepository extends JpaRepository<BookSeries, Long> {
    List<BookSeries> findAllByOrderByOrderNoAscNameAsc();
    List<BookSeries> findByStatusOrderByOrderNoAscNameAsc(BookSeriesStatus status);
    Optional<BookSeries> findByCode(String code);
}
