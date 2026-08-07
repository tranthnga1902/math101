package com.math10.enrollments.service.impl;

import com.math10.common.exception.BusinessException;
import com.math10.enrollments.dto.EnrollmentRequest;
import com.math10.enrollments.entity.ClassCourse;
import com.math10.enrollments.entity.ClassStudent;
import com.math10.enrollments.entity.ClassTeacher;
import com.math10.enrollments.repository.ClassCourseRepository;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.enrollments.repository.ClassTeacherRepository;
import com.math10.enrollments.service.EnrollmentService;
import com.math10.enrollments.dto.EnrollmentResponse;
import com.math10.users.repository.UserRepository;
import com.math10.courses.repository.CourseRepository;
import com.math10.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.List;
import com.math10.configuration.security.CurrentUserService;
import org.springframework.security.access.AccessDeniedException;
import com.math10.configuration.security.SecurityService;

@Service
@RequiredArgsConstructor
public class EnrollmentServiceImpl implements EnrollmentService {

    private final ClassTeacherRepository classTeacherRepository;
    private final ClassStudentRepository classStudentRepository;
    private final ClassCourseRepository classCourseRepository;
    private final UserRepository userRepository;
    private final CourseRepository courseRepository;
    private final CurrentUserService currentUserService;
    private final SecurityService securityService;

    @Override
    @Transactional
    public void assignTeacherToClass(EnrollmentRequest request) {
        if (request.userId() == null) throw new BusinessException("Teacher ID là bắt buộc");
        if (classTeacherRepository.existsByClassIdAndTeacherId(request.classId(), request.userId())) return;
        ClassTeacher entity = new ClassTeacher();
        entity.setClassId(request.classId());
        entity.setTeacherId(request.userId());
        classTeacherRepository.save(entity);
    }

    @Override
    @Transactional
    public void addStudentToClass(EnrollmentRequest request) {
        checkTeacherClass(request.classId());
        if (request.userId() == null) throw new BusinessException("Student ID là bắt buộc");
        if (classStudentRepository.existsByClassIdAndStudentId(request.classId(), request.userId())) return;
        ClassStudent entity = new ClassStudent();
        entity.setClassId(request.classId());
        entity.setStudentId(request.userId());
        classStudentRepository.save(entity);
    }

    @Override
    @Transactional
    public void assignCourseToClass(EnrollmentRequest request) {
        checkTeacherClass(request.classId());
        if (request.courseId() == null) throw new BusinessException("Course ID là bắt buộc");
        securityService.checkCourseOwnership(request.courseId());
        if (classCourseRepository.existsByClassIdAndCourseId(request.classId(), request.courseId())) return;
        ClassCourse entity = new ClassCourse();
        entity.setClassId(request.classId());
        entity.setCourseId(request.courseId());
        classCourseRepository.save(entity);
    }

    @Override public List<EnrollmentResponse> classTeachers(Long classId){checkTeacherClass(classId);return classTeacherRepository.findByClassIdOrderByCreatedAtAsc(classId).stream().map(x->new EnrollmentResponse(x.getId(),x.getClassId(),x.getTeacherId(),null,userRepository.findById(x.getTeacherId()).map(u->u.getFullName()).orElse("Giáo viên"))).toList();}
    @Override public List<EnrollmentResponse> classStudents(Long classId){checkTeacherClass(classId);return classStudentRepository.findByClassIdOrderByCreatedAtAsc(classId).stream().map(x->new EnrollmentResponse(x.getId(),x.getClassId(),x.getStudentId(),null,userRepository.findById(x.getStudentId()).map(u->u.getFullName()).orElse("Học sinh"))).toList();}
    @Override public List<EnrollmentResponse> classCourses(Long classId){checkTeacherClass(classId);return classCourseRepository.findByClassIdOrderByCreatedAtAsc(classId).stream().map(x->new EnrollmentResponse(x.getId(),x.getClassId(),null,x.getCourseId(),courseRepository.findById(x.getCourseId()).map(c->c.getName()).orElse("Khóa học"))).toList();}
    @Override @Transactional public void removeTeacher(Long id){classTeacherRepository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy phân công")).markDeleted();}
    @Override @Transactional public void removeStudent(Long id){ClassStudent row=classStudentRepository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy ghi danh"));checkTeacherClass(row.getClassId());row.markDeleted();}
    @Override @Transactional public void removeCourse(Long id){ClassCourse row=classCourseRepository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy khóa học của lớp"));checkTeacherClass(row.getClassId());row.markDeleted();}
    private void checkTeacherClass(Long classId){if("ADMIN".equals(currentUserService.requireRoleCode()))return;if(!"TEACHER".equals(currentUserService.requireRoleCode())||!classTeacherRepository.existsByClassIdAndTeacherId(classId,currentUserService.requireUserId()))throw new AccessDeniedException("Không có quyền quản lý lớp");}
}
