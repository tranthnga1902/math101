package com.math10.courses.service.impl;

import com.math10.configuration.security.SecurityService;
import com.math10.courses.dto.request.CourseRequest;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.courses.dto.response.CourseResponse;
import com.math10.courses.exception.CourseNotFoundException;
import com.math10.courses.mapper.CourseMapper;
import com.math10.courses.repository.CourseRepository;
import com.math10.courses.service.CourseService;
import com.math10.courses.validator.CourseValidator;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.math10.audit.service.AuditService;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.entity.CourseTeacher;
import com.math10.enrollments.repository.CourseTeacherRepository;
import com.math10.programs.support.CatCanhCay;
import org.springframework.data.domain.PageImpl;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CourseServiceImpl implements CourseService {

    private static final Logger log = LoggerFactory.getLogger(CourseServiceImpl.class);

    private final CourseRepository courseRepository;
    private final CourseMapper courseMapper;
    private final CourseValidator courseValidator;
    private final SecurityService securityService;
    private final AuditService auditService;
    private final CurrentUserService currentUserService;
    private final CourseTeacherRepository courseTeacherRepository;
    private final CatCanhCay catCanhCay;

    @Override
    @Transactional(readOnly = true)
    public Page<CourseResponse> findAll(Pageable pageable) {
        if ("TEACHER".equals(currentUserService.requireRoleCode())) {
            List<CourseResponse> rows = courseTeacherRepository.findByTeacherId(currentUserService.requireUserId()).stream()
                    .map(x -> courseRepository.findById(x.getCourseId()).map(courseMapper::toResponse).orElse(null))
                    .filter(java.util.Objects::nonNull).toList();
            return new PageImpl<>(rows, pageable, rows.size());
        }
        return courseRepository.findAll(pageable).map(courseMapper::toResponse);
    }

    @Override
    @Transactional(readOnly = true)
    public CourseResponse findById(Long id) {
        return courseRepository.findById(id)
                .map(courseMapper::toResponse)
                .orElseThrow(() -> new CourseNotFoundException(id));
    }

    @Override
    @Transactional
    public CourseResponse create(CourseRequest request) {
        courseValidator.ensureCodeAvailable(request.code());
        var course = courseMapper.toEntity(request);
        var saved = courseRepository.save(course);
        if ("TEACHER".equals(currentUserService.requireRoleCode())) {
            CourseTeacher owner = new CourseTeacher();
            owner.setCourseId(saved.getId());
            owner.setTeacherId(currentUserService.requireUserId());
            courseTeacherRepository.save(owner);
        }
        auditService.record("CREATE", "COURSE", saved.getId(), null, request.toString());
        log.info("Created course {}", saved.getId());
        return courseMapper.toResponse(saved);
    }

    @Override
    @Transactional
    public CourseResponse update(Long id, CourseRequest request) {
        var course = courseRepository.findById(id).orElseThrow(() -> new CourseNotFoundException(id));
        String oldData = courseMapper.toResponse(course).toString();
        securityService.checkCourseOwnership(course.getId());
        courseValidator.ensureCodeAvailableForUpdate(request.code(), id);
        courseMapper.updateEntity(request, course);
        auditService.record("UPDATE", "COURSE", id, oldData, request.toString());
        log.info("Updated course {}", course.getId());
        return courseMapper.toResponse(course);
    }

    @Override
    @Transactional
    public void softDelete(Long id) {
        var course = courseRepository.findById(id).orElseThrow(() -> new CourseNotFoundException(id));
        securityService.checkCourseOwnership(course.getId());
        auditService.record("DELETE", "COURSE", id, courseMapper.toResponse(course).toString(), null);
        catCanhCay.duoiChuongTrinh(id);
        course.markDeleted();
        log.info("Soft deleted course {}", course.getId());
    }

    @Override
    @Transactional
    public void reorder(ReorderRequest request) {
        log.info("Course reorder accepted for {} IDs; course order persistence is deferred until order_index is added", request.ids().size());
    }
}
