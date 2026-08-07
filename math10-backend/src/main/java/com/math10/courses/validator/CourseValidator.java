package com.math10.courses.validator;

import com.math10.common.exception.BusinessException;
import com.math10.courses.repository.CourseRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CourseValidator {

    private final CourseRepository courseRepository;

    public void ensureCodeAvailable(String code) {
        if (courseRepository.existsByCode(code)) {
            throw new BusinessException("Mã khóa học đã tồn tại");
        }
    }

    public void ensureCodeAvailableForUpdate(String code, Long courseId) {
        if (courseRepository.existsByCodeAndIdNot(code, courseId)) {
            throw new BusinessException("Mã khóa học đã tồn tại");
        }
    }
}
