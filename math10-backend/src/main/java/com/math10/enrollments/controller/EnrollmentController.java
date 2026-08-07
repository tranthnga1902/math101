package com.math10.enrollments.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.enrollments.dto.EnrollmentRequest;
import com.math10.enrollments.service.EnrollmentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.*;
import com.math10.enrollments.dto.EnrollmentResponse;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/enrollments")
public class EnrollmentController {

    private final EnrollmentService enrollmentService;

    @PostMapping("/class-teachers")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> assignTeacherToClass(@Valid @RequestBody EnrollmentRequest request) {
        enrollmentService.assignTeacherToClass(request);
        return ApiResponse.ok("Gán giáo viên vào lớp thành công", null);
    }

    @PostMapping("/class-students")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<Void> addStudentToClass(@Valid @RequestBody EnrollmentRequest request) {
        enrollmentService.addStudentToClass(request);
        return ApiResponse.ok("Thêm học sinh vào lớp thành công", null);
    }

    @PostMapping("/class-courses")
    @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<Void> assignCourseToClass(@Valid @RequestBody EnrollmentRequest request) {
        enrollmentService.assignCourseToClass(request);
        return ApiResponse.ok("Gán khóa học cho lớp thành công", null);
    }

    @GetMapping("/class-teachers") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<EnrollmentResponse>> teachers(@RequestParam Long classId){return ApiResponse.ok("Giáo viên của lớp",enrollmentService.classTeachers(classId));}
    @GetMapping("/class-students") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<EnrollmentResponse>> students(@RequestParam Long classId){return ApiResponse.ok("Học sinh của lớp",enrollmentService.classStudents(classId));}
    @GetMapping("/class-courses") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
    public ApiResponse<List<EnrollmentResponse>> courses(@RequestParam Long classId){return ApiResponse.ok("Khóa học của lớp",enrollmentService.classCourses(classId));}
    @DeleteMapping("/class-teachers/{id}") @PreAuthorize("hasRole('ADMIN')") public ApiResponse<Void> removeTeacher(@PathVariable Long id){enrollmentService.removeTeacher(id);return ApiResponse.noContent("Gỡ giáo viên");}
    @DeleteMapping("/class-students/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") public ApiResponse<Void> removeStudent(@PathVariable Long id){enrollmentService.removeStudent(id);return ApiResponse.noContent("Gỡ học sinh");}
    @DeleteMapping("/class-courses/{id}") @PreAuthorize("hasAnyRole('ADMIN','TEACHER')") public ApiResponse<Void> removeCourse(@PathVariable Long id){enrollmentService.removeCourse(id);return ApiResponse.noContent("Gỡ khóa học");}
}
