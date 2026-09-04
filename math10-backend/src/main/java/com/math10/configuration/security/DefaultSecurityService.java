package com.math10.configuration.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import lombok.RequiredArgsConstructor;
import com.math10.programs.support.LuongNoiDung;
import com.math10.enrollments.repository.CourseTeacherRepository;

@Service
@RequiredArgsConstructor
public class DefaultSecurityService implements SecurityService {
    private final CurrentUserService currentUserService;
    private final LuongNoiDung luongNoiDung;
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

    /**
     * Cổng tệp hỏi lại đúng cái luật mà danh sách học liệu vừa hỏi.
     *
     * <p>Trước lát này cổng lần theo {@code lesson_resources} — bảng không có cột trạng thái lẫn cột
     * đối tượng — nên nó chỉ trả lời được "em có thuộc lớp được cấp không". Từ khi danh sách chuyển
     * sang luồng nội dung, câu ấy là chưa đủ: mục đã bị giấu khỏi màn hình vẫn còn tệp, và tệp thì
     * mở bằng số hiệu chứ không cần đi qua màn hình nào.
     */
    @Override
    public void checkFileAccess(Long fileId) {
        requireAuthenticated();
        String role = currentUserService.requireRoleCode();
        if ("ADMIN".equals(role) || "TEACHER".equals(role)) return;
        if (!"STUDENT".equals(role) || !luongNoiDung.moDuocTep(fileId, currentUserService.requireUserId())) {
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
