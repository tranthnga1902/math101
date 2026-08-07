package com.math10.enrollments.service;

import com.math10.enrollments.dto.EnrollmentRequest;
import com.math10.enrollments.dto.EnrollmentResponse;
import java.util.List;

public interface EnrollmentService {

    void assignTeacherToClass(EnrollmentRequest request);

    void addStudentToClass(EnrollmentRequest request);

    void assignCourseToClass(EnrollmentRequest request);
    List<EnrollmentResponse> classTeachers(Long classId);
    List<EnrollmentResponse> classStudents(Long classId);
    List<EnrollmentResponse> classCourses(Long classId);
    void removeTeacher(Long id);
    void removeStudent(Long id);
    void removeCourse(Long id);
}
