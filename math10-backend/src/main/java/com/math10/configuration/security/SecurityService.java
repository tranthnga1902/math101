package com.math10.configuration.security;

public interface SecurityService {

    void checkCourseOwnership(Long courseId);

    void checkFileAccess(Long fileId);
}
