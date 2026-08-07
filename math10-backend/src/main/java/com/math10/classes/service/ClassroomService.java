package com.math10.classes.service;

import com.math10.classes.dto.ClassroomRequest;
import com.math10.classes.dto.ClassroomResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import com.math10.classes.entity.ClassStatus;

public interface ClassroomService {

    Page<ClassroomResponse> findAll(String search, Long gradeId, ClassStatus status, Pageable pageable);

    ClassroomResponse create(ClassroomRequest request);

    ClassroomResponse update(Long id, ClassroomRequest request);

    void lock(Long id);

    void softDelete(Long id);
}
