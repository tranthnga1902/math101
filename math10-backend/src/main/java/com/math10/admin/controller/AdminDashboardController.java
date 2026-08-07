package com.math10.admin.controller;

import com.math10.admin.dto.AdminDashboardResponse;
import com.math10.classes.repository.ClassroomRepository;
import com.math10.common.dto.ApiResponse;
import com.math10.courses.entity.CourseStatus;
import com.math10.courses.repository.CourseRepository;
import com.math10.users.repository.UserRepository;
import com.math10.mathcontent.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin")
public class AdminDashboardController {
    private final UserRepository users;
    private final ClassroomRepository classrooms;
    private final CourseRepository courses;
    private final ProblemRepository problems;

    @GetMapping("/dashboard")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<AdminDashboardResponse> dashboard() {
        return ApiResponse.ok("Lấy dashboard admin thành công", new AdminDashboardResponse(
                users.count(),
                users.countByRoleCode("TEACHER"),
                users.countByRoleCode("STUDENT"),
                classrooms.count(),
                courses.count(),
                courses.countByStatus(CourseStatus.PUBLISHED),
                problems.countByStatus("PUBLISHED")
        ));
    }
}
