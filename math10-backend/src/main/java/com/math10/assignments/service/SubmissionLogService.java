package com.math10.assignments.service;

import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentSubmissionLog;
import com.math10.assignments.repository.AssignmentSubmissionLogRepository;
import com.math10.configuration.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;

/**
 * Ghi nhật ký nộp bài. Gom về một chỗ để ba điểm phát sinh (học sinh nộp, giáo viên chấm,
 * giáo viên trả bài) không mỗi nơi ghi một kiểu.
 */
@Service
@RequiredArgsConstructor
public class SubmissionLogService {

    private final AssignmentSubmissionLogRepository logs;
    private final CurrentUserService current;

    public void record(Assignment assignment, Long studentId, String action, BigDecimal score, String note) {
        AssignmentSubmissionLog row = new AssignmentSubmissionLog();
        row.setAssignmentId(assignment.getId());
        row.setClassId(assignment.getClassId());
        row.setStudentId(studentId);
        row.setActorId(current.requireUserId());
        row.setAction(action);
        row.setRequirement(assignment.getRequirement() == null ? "BAT_BUOC" : assignment.getRequirement());
        row.setScore(score);
        row.setNote(note);
        logs.save(row);
    }
}
