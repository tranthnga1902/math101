package com.math10.classes.service;

import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.enrollments.repository.ClassTeacherRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Một chỗ duy nhất trả lời câu hỏi "ai được đụng vào lớp này", để các controller của module
 * lớp học không mỗi nơi chép một bản rồi lệch nhau.
 */
@Component
@RequiredArgsConstructor
public class ClassAccessGuard {

    private final ClassTeacherRepository classTeachers;
    private final ClassStudentRepository classStudents;
    private final CurrentUserService current;

    /** Sửa nội dung lớp: chỉ giáo viên phụ trách lớp đó, hoặc admin. */
    public void requireTeacher(Long classId) {
        if ("ADMIN".equals(current.requireRoleCode())) return;
        if (!classTeachers.existsByClassIdAndTeacherId(classId, current.requireUserId()))
            throw new AccessDeniedException("Không có quyền quản lý lớp này");
    }

    /** Xem nội dung lớp: giáo viên phụ trách, admin, hoặc học sinh đang học lớp đó. */
    public void requireMember(Long classId) {
        String role = current.requireRoleCode();
        if ("ADMIN".equals(role)) return;
        Long userId = current.requireUserId();
        if ("STUDENT".equals(role)) {
            if (!classStudents.existsByClassIdAndStudentId(classId, userId))
                throw new AccessDeniedException("Bạn không thuộc lớp này");
            return;
        }
        if (!classTeachers.existsByClassIdAndTeacherId(classId, userId))
            throw new AccessDeniedException("Không có quyền quản lý lớp này");
    }
}
