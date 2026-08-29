package com.math10.programs.repository;

import com.math10.programs.entity.ProgramSchedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ProgramScheduleRepository extends JpaRepository<ProgramSchedule, Long> {
    List<ProgramSchedule> findByCourseIdOrderByStartsOnAsc(Long courseId);

    @Query("""
            select schedule from ProgramSchedule schedule
            where schedule.courseId = :courseId and schedule.status = 'ACTIVE'
              and schedule.startsOn <= :at and schedule.endsOn >= :at
            order by schedule.startsOn desc
            """)
    List<ProgramSchedule> findCurrent(@Param("courseId") Long courseId, @Param("at") LocalDate at);

    @Query("""
            select count(schedule) from ProgramSchedule schedule
            where schedule.courseId = :courseId and schedule.status = 'ACTIVE'
              and schedule.id <> :excludedId
              and schedule.startsOn <= :endsOn and schedule.endsOn >= :startsOn
            """)
    long countOverlapping(@Param("courseId") Long courseId,
                          @Param("startsOn") LocalDate startsOn,
                          @Param("endsOn") LocalDate endsOn,
                          @Param("excludedId") Long excludedId);

    default Optional<ProgramSchedule> current(Long courseId, LocalDate at) {
        return findCurrent(courseId, at).stream().findFirst();
    }
}
