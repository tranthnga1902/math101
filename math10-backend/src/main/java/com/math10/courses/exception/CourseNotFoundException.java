package com.math10.courses.exception;

import com.math10.common.exception.ResourceNotFoundException;

public class CourseNotFoundException extends ResourceNotFoundException {

    public CourseNotFoundException(Long id) {
        super("Không tìm thấy khóa học: " + id);
    }
}
