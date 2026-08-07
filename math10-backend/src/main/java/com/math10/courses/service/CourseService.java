package com.math10.courses.service;

import com.math10.courses.dto.request.CourseRequest;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.courses.dto.response.CourseResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface CourseService {

    Page<CourseResponse> findAll(Pageable pageable);

    CourseResponse findById(Long id);

    CourseResponse create(CourseRequest request);

    CourseResponse update(Long id, CourseRequest request);

    void softDelete(Long id);

    void reorder(ReorderRequest request);
}
