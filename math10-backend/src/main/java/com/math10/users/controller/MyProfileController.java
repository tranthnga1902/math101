package com.math10.users.controller;

import com.math10.classes.repository.ClassroomRepository;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.enrollments.repository.ClassTeacherRepository;
import com.math10.grades.repository.GradeRepository;
import com.math10.users.dto.MyProfileResponse;
import com.math10.users.dto.MyProfileUpdateRequest;
import com.math10.users.entity.User;
import com.math10.users.repository.UserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/me/profile")
public class MyProfileController {
    private final CurrentUserService currentUser;
    private final UserRepository users;
    private final ClassroomRepository classrooms;
    private final ClassStudentRepository students;
    private final ClassTeacherRepository teachers;
    private final GradeRepository grades;

    @GetMapping
    @Transactional(readOnly = true)
    public ApiResponse<MyProfileResponse> get() {
        return ApiResponse.ok("Lấy thông tin cá nhân thành công", response(user()));
    }

    @PutMapping
    @Transactional
    public ApiResponse<MyProfileResponse> update(@Valid @RequestBody MyProfileUpdateRequest request) {
        User user = user();
        users.findByEmail(request.email().trim()).filter(other -> !other.getId().equals(user.getId()))
                .ifPresent(other -> { throw new BusinessException("Email đã tồn tại"); });
        user.setEmail(request.email().trim());
        user.setFullName(request.fullName().trim());
        user.setPhone(request.phone() == null || request.phone().isBlank() ? null : request.phone().trim());
        user.setDateOfBirth(request.dateOfBirth());
        user.setGender(request.gender() == null || request.gender().isBlank() ? null : request.gender().trim());
        user.setAvatarUrl(request.avatarUrl() == null || request.avatarUrl().isBlank() ? null : request.avatarUrl());
        return ApiResponse.ok("Cập nhật thông tin cá nhân thành công", response(user));
    }

    private User user() {
        return users.findById(currentUser.requireUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài khoản"));
    }

    private MyProfileResponse response(User user) {
        List<Long> classIds = "STUDENT".equals(user.getRoleCode())
                ? students.findByStudentId(user.getId()).stream().map(x -> x.getClassId()).toList()
                : "TEACHER".equals(user.getRoleCode())
                ? teachers.findByTeacherId(user.getId()).stream().map(x -> x.getClassId()).toList()
                : List.of();
        var assigned = classrooms.findAllById(classIds);
        Integer grade = assigned.stream().findFirst().flatMap(c -> grades.findById(c.getGradeId()))
                .map(x -> x.getGradeNumber()).orElse(null);
        int year = LocalDate.now().getMonthValue() >= 9 ? LocalDate.now().getYear() : LocalDate.now().getYear() - 1;
        String prefix = switch (user.getRoleCode()) { case "STUDENT" -> "HS"; case "TEACHER" -> "GV"; default -> "AD"; };
        return new MyProfileResponse(user.getId(), prefix + String.format("%06d", user.getId()), user.getUsername(),
                user.getEmail(), user.getFullName(), user.getPhone(), user.getRoleCode(), user.getStatus(),
                user.getCreatedAt(), null, user.getDateOfBirth() == null ? null : user.getDateOfBirth().toString(),
                user.getGender(), null, user.getAvatarUrl(), grade,
                assigned.stream().map(x -> x.getName()).toList(), year + "–" + (year + 1),
                "TEACHER".equals(user.getRoleCode()) ? "Toán" : null,
                "ADMIN".equals(user.getRoleCode()) ? "Quản trị hệ thống" : null, null);
    }
}
