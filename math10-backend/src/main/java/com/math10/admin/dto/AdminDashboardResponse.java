package com.math10.admin.dto;

public record AdminDashboardResponse(
        long totalUsers,
        long teachers,
        long students,
        long classes,
        long courses,
        long publishedCourses,
        long publishedProblems
) {
}
