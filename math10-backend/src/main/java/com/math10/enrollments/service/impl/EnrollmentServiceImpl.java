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
import com.math10.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
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
    private final JdbcTemplate jdbc;
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
        if (request.courseInstanceId() == null) throw new BusinessException("Khóa là bắt buộc");
        // Quyền vẫn xét trên chương trình — khóa chỉ là lần triển khai của nó trong một năm học.
        securityService.checkCourseOwnership(programOf(request.courseInstanceId()));
        if (classCourseRepository.existsByClassIdAndCourseInstanceId(request.classId(), request.courseInstanceId())) return;
        ClassCourse entity = new ClassCourse();
        entity.setClassId(request.classId());
        entity.setCourseInstanceId(request.courseInstanceId());
        classCourseRepository.save(entity);
    }

    /** Khóa không có thực thể JPA nên tra thẳng; thiếu khóa thì dừng ở đây chứ không để FK báo. */
    private Long programOf(Long courseInstanceId) {
        List<Long> found = jdbc.queryForList("""
                select pt.program_id from course_instances ci
                join program_templates pt on pt.id=ci.template_id and pt.deleted_at is null
                where ci.id=? and ci.deleted_at is null
                """, Long.class, courseInstanceId);
        if (found.isEmpty()) throw new ResourceNotFoundException("Không tìm thấy khóa");
        return found.get(0);
    }

    private String labelOf(Long courseInstanceId) {
        List<String> found = jdbc.queryForList(
                "select name from course_instances where id=? and deleted_at is null", String.class, courseInstanceId);
        return found.isEmpty() ? "Khóa" : found.get(0);
    }

    @Override public List<EnrollmentResponse> classTeachers(Long classId){checkTeacherClass(classId);return classTeacherRepository.findByClassIdOrderByCreatedAtAsc(classId).stream().map(x->new EnrollmentResponse(x.getId(),x.getClassId(),x.getTeacherId(),null,userRepository.findById(x.getTeacherId()).map(u->u.getFullName()).orElse("Giáo viên"))).toList();}
    @Override public List<EnrollmentResponse> classStudents(Long classId){checkTeacherClass(classId);return classStudentRepository.findByClassIdOrderByCreatedAtAsc(classId).stream().map(x->new EnrollmentResponse(x.getId(),x.getClassId(),x.getStudentId(),null,userRepository.findById(x.getStudentId()).map(u->u.getFullName()).orElse("Học sinh"))).toList();}
    @Override public List<EnrollmentResponse> classCourses(Long classId){checkTeacherClass(classId);return classCourseRepository.findByClassIdOrderByCreatedAtAsc(classId).stream().map(x->new EnrollmentResponse(x.getId(),x.getClassId(),null,x.getCourseInstanceId(),labelOf(x.getCourseInstanceId()))).toList();}
    @Override @Transactional public void removeTeacher(Long id){classTeacherRepository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy phân công")).markDeleted();}
    @Override @Transactional public void removeStudent(Long id){ClassStudent row=classStudentRepository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy ghi danh"));checkTeacherClass(row.getClassId());row.markDeleted();}
    @Override @Transactional public void removeCourse(Long id){ClassCourse row=classCourseRepository.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy khóa học của lớp"));checkTeacherClass(row.getClassId());row.markDeleted();}
    private void checkTeacherClass(Long classId){if("ADMIN".equals(currentUserService.requireRoleCode()))return;if(!"TEACHER".equals(currentUserService.requireRoleCode())||!classTeacherRepository.existsByClassIdAndTeacherId(classId,currentUserService.requireUserId()))throw new AccessDeniedException("Không có quyền quản lý lớp");}
}
