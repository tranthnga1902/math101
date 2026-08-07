package com.math10.progress.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.mathcontent.repository.ProblemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/problem-progress")
@PreAuthorize("hasRole('STUDENT')")
public class ProblemProgressController {
    private final JdbcTemplate jdbc;
    private final CurrentUserService current;
    private final ProblemRepository problems;

    @PatchMapping("/{problemId}/opened")
    @Transactional
    public ApiResponse<Map<String, Object>> opened(@PathVariable Long problemId) {
        requirePublicPractice(problemId);
        Long studentId = current.requireUserId();
        LocalDateTime now = LocalDateTime.now();
        jdbc.update("""
            insert into problem_progress(student_id,problem_id,status,opened_at,created_at,updated_at)
            values (?,?, 'IN_PROGRESS', ?, ?, ?)
            on conflict(student_id,problem_id) do update
            set opened_at=coalesce(problem_progress.opened_at,excluded.opened_at),
                updated_at=excluded.updated_at
            where problem_progress.deleted_at is null and problem_progress.completed_at is null
            """, studentId, problemId, now, now, now);
        return ApiResponse.ok("Đã ghi nhận đang làm", state(studentId, problemId));
    }

    @PatchMapping("/{problemId}/completed")
    @Transactional
    public ApiResponse<Map<String, Object>> completed(@PathVariable Long problemId) {
        requirePublicPractice(problemId);
        Long studentId = current.requireUserId();
        LocalDateTime now = LocalDateTime.now();
        jdbc.update("""
            insert into problem_progress(student_id,problem_id,status,opened_at,completed_at,created_at,updated_at)
            values (?,?, 'COMPLETED', ?, ?, ?, ?)
            on conflict(student_id,problem_id) do update
            set status='COMPLETED',
                opened_at=coalesce(problem_progress.opened_at,excluded.opened_at),
                completed_at=excluded.completed_at,
                updated_at=excluded.updated_at,
                deleted_at=null
            """, studentId, problemId, now, now, now, now);
        return ApiResponse.ok("Đã hoàn thành bài toán", state(studentId, problemId));
    }

    private void requirePublicPractice(Long id) {
        var problem = problems.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài toán"));
        if (!"PRACTICE".equals(problem.getProblemKind()) || !"PUBLISHED".equals(problem.getStatus())) {
            throw new BusinessException("Chỉ bài PRACTICE đã xuất bản mới ghi nhận tiến độ");
        }
    }

    private Map<String, Object> state(Long studentId, Long problemId) {
        return jdbc.queryForMap("""
            select problem_id,status,opened_at,completed_at
            from problem_progress
            where student_id=? and problem_id=? and deleted_at is null
            """, studentId, problemId);
    }
}
