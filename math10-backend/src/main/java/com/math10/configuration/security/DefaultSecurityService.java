package com.math10.configuration.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import com.math10.resources.repository.LessonResourceRepository;
import com.math10.enrollments.repository.CourseTeacherRepository;

@Service
@RequiredArgsConstructor
public class DefaultSecurityService implements SecurityService {
    private final CurrentUserService currentUserService;
    private final LessonResourceRepository lessonResourceRepository;
    private final CourseTeacherRepository courseTeacherRepository;

    @Override
    public void checkCourseOwnership(Long courseId) {
        requireAuthenticated();
        if ("ADMIN".equals(currentUserService.requireRoleCode())) return;
        if (!"TEACHER".equals(currentUserService.requireRoleCode())
                || !courseTeacherRepository.existsByCourseIdAndTeacherId(courseId, currentUserService.requireUserId())) {
            throw new AccessDeniedException("Không có quyền quản lý khóa học");
        }
    }

    @Override
    public void checkFileAccess(Long fileId) {
        requireAuthenticated();
        String role = currentUserService.requireRoleCode();
        if ("ADMIN".equals(role) || "TEACHER".equals(role)) return;
        if (!"STUDENT".equals(role) || !lessonResourceRepository.studentCanAccessFile(fileId, currentUserService.requireUserId())) {
            throw new AccessDeniedException("Bạn không thuộc lớp được cấp tài liệu này");
        }
    }

    private void requireAuthenticated() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof Math10Principal)) {
            throw new AccessDeniedException("Unauthenticated");
        }
    }
}
