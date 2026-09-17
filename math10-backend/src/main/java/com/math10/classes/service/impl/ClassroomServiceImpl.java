package com.math10.classes.service.impl;

import com.math10.classes.dto.ClassroomRequest;
import com.math10.classes.dto.ClassroomResponse;
import com.math10.classes.entity.ClassStatus;
import com.math10.classes.entity.Classroom;
import com.math10.classes.repository.ClassCurriculumRepository;
import com.math10.classes.repository.ClassDocumentRepository;
import com.math10.classes.repository.ClassroomRepository;
import com.math10.classes.service.ClassroomService;
import com.math10.common.exception.ResourceNotFoundException;
import lombok.RequiredArgsConstructor;
import com.math10.audit.service.AuditService;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.entity.ClassTeacher;
import com.math10.enrollments.repository.ClassTeacherRepository;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.enrollments.repository.ClassCourseRepository;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClassroomServiceImpl implements ClassroomService {

    private final ClassroomRepository classroomRepository;
    private final ClassTeacherRepository classTeachers;
    private final ClassStudentRepository classStudents;
    private final ClassCourseRepository classCourses;
    private final ClassCurriculumRepository classCurriculum;
    private final ClassDocumentRepository classDocuments;
    private final CurrentUserService current;
    private final AuditService audit;

    @Override
    @Transactional(readOnly = true)
    public Page<ClassroomResponse> findAll(String search, Long gradeId, ClassStatus status, Pageable pageable) {
        // Giáo viên chỉ thấy lớp mình phụ trách; admin thấy tất cả.
        java.util.List<Long> ownClassIds = "ADMIN".equals(current.requireRoleCode())
                ? null
                : classTeachers.findByTeacherId(current.requireUserId()).stream().map(ClassTeacher::getClassId).toList();
        if (ownClassIds != null && ownClassIds.isEmpty()) return Page.empty(pageable);
        return classroomRepository.findAll((root, query, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            if (search != null && !search.isBlank()) {
                String pattern = "%" + search.trim().toLowerCase() + "%";
                predicates.add(cb.or(cb.like(cb.lower(root.get("code")), pattern), cb.like(cb.lower(root.get("name")), pattern)));
            }
            if (gradeId != null) predicates.add(cb.equal(root.get("gradeId"), gradeId));
            if (status != null) predicates.add(cb.equal(root.get("status"), status));
            if (ownClassIds != null) predicates.add(root.get("id").in(ownClassIds));
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        }, pageable).map(this::toResponse);
    }

    @Override
    @Transactional
    public ClassroomResponse create(ClassroomRequest request) {
        Classroom classroom = new Classroom();
        apply(request, classroom);
        classroom.setCreatedBy(current.requireUserId());
        classroom=classroomRepository.save(classroom);
        if("TEACHER".equals(current.requireRoleCode())){ClassTeacher assignment=new ClassTeacher();assignment.setClassId(classroom.getId());assignment.setTeacherId(current.requireUserId());classTeachers.save(assignment);}
        // Audit là kênh báo cho Admin biết giáo viên vừa lập lớp — hiện ở màn Nhật ký hệ thống.
        ClassroomResponse response=toResponse(classroom);audit.record("CREATE","CLASS",classroom.getId(),null,response.toString());return response;
    }

    @Override
    @Transactional
    public ClassroomResponse update(Long id, ClassroomRequest request) {
        Classroom classroom = findEntity(id);
        checkOwnership(id);
        String old=toResponse(classroom).toString();
        apply(request, classroom);
        ClassroomResponse response=toResponse(classroom);audit.record("UPDATE","CLASS",id,old,response.toString());return response;
    }

    @Override
    @Transactional
    public void lock(Long id) {
        Classroom classroom=findEntity(id);checkOwnership(id);String old=toResponse(classroom).toString();classroom.setStatus(ClassStatus.LOCKED);audit.record("UPDATE","CLASS",id,old,toResponse(classroom).toString());
    }

    @Override
    @Transactional
    public void softDelete(Long id) {
        Classroom classroom=findEntity(id);checkOwnership(id);audit.record("DELETE","CLASS",id,toResponse(classroom).toString(),null);classroom.markDeleted();
    }

    private Classroom findEntity(Long id) {
        return classroomRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy lớp: " + id));
    }
    private void checkOwnership(Long id){if("ADMIN".equals(current.requireRoleCode()))return;if(!classTeachers.existsByClassIdAndTeacherId(id,current.requireUserId()))throw new AccessDeniedException("Không có quyền quản lý lớp");}

    private void apply(ClassroomRequest request, Classroom classroom) {
        classroom.setCode(request.code());
        classroom.setName(request.name());
        classroom.setGradeId(request.gradeId());
        classroom.setStatus(request.status());
        classroom.setDescription(request.description());
        if (request.startDate() != null) {
            classroom.setStartDate(request.startDate());
        }
    }

    private ClassroomResponse toResponse(Classroom classroom) {
        return new ClassroomResponse(classroom.getId(), classroom.getCode(), classroom.getName(), classroom.getGradeId(), classroom.getStatus(),
                classroom.getDescription(), classroom.getCreatedBy(),
                classTeachers.countByClassId(classroom.getId()), classStudents.countByClassId(classroom.getId()), classCourses.countByClassId(classroom.getId()),
                classCurriculum.countByClassId(classroom.getId()), classDocuments.countByClassId(classroom.getId()),
                classroom.getStartDate(),
                classroom.getCreatedAt(), classroom.getUpdatedAt());
    }
}
