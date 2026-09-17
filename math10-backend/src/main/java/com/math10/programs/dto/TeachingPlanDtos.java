package com.math10.programs.dto;

import java.time.LocalDate;
import java.util.List;

/**
 * DTO cho Kế hoạch giảng dạy (teaching_plans).
 */
public class TeachingPlanDtos {

    public record CreatePlanInput(
            Long courseId,
            String name,
            String description,
            Integer totalWeeks,
            Integer totalPeriods,
            String status
    ) {}

    public record PlanResponse(
            Long id,
            Long courseId,
            String courseName,
            Long templateId,
            String name,
            String description,
            int totalWeeks,
            int totalPeriods,
            String status,
            long itemCount
    ) {}

    public record PlanItemInput(
            Long programPeriodId,
            int weekNumber,
            int orderInWeek
    ) {}
}
