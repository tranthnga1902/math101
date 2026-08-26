package com.math10.assignments.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.assignments.dto.AssignmentProgressResponse;
import com.math10.assignments.dto.AssignmentResultResponse;
import com.math10.assignments.dto.AssignmentSubmitRequest;
import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentProgress;
import com.math10.assignments.repository.AssignmentProgressRepository;
import com.math10.assignments.repository.AssignmentRepository;
import com.math10.assignments.service.SubmissionLogService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.mathcontent.repository.ProblemRepository;
import com.math10.progress.entity.LearningProgress;
import com.math10.progress.repository.LearningProgressRepository;
import com.math10.worksheets.repository.WorksheetItemRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/assignment-progress")
@PreAuthorize("hasRole('STUDENT')")
public class AssignmentProgressController {
    private final AssignmentRepository assignments;
    private final AssignmentProgressRepository progress;
    private final SubmissionLogService submissionLog;
    private final ClassStudentRepository classStudents;
    private final CurrentUserService current;
    private final LearningProgressRepository learningProgress;
    private final WorksheetItemRepository worksheetItems;
    private final ProblemRepository problems;
    private final ObjectMapper objectMapper;

    @PatchMapping("/{assignmentId}/opened")
    @Transactional
    public ApiResponse<AssignmentProgressResponse> opened(@PathVariable Long assignmentId) {
        AssignmentProgress row = get(assignmentId);
        if (row.getOpenedAt() == null) row.setOpenedAt(LocalDateTime.now());
        row.setCompletionPercent(Math.max(row.getCompletionPercent(), 10));
        syncWorksheet(assignmentId, row, false);
        return ApiResponse.ok("Đã mở bài giao", map(progress.save(row)));
    }

    @PatchMapping("/{assignmentId}/completed")
    @Transactional
    public ApiResponse<AssignmentProgressResponse> completed(@PathVariable Long assignmentId) {
        AssignmentProgress row=get(assignmentId);
        Assignment assignment=assignment(assignmentId);
        boolean firstTime=row.getCompletedAt()==null;
        if(row.getOpenedAt()==null)row.setOpenedAt(LocalDateTime.now());
        row.setCompletedAt(LocalDateTime.now());row.setCompletionPercent(100);
        // Bài học/tài liệu không có bước nộp để chấm, nên đánh dấu hoàn thành chính là lần "nộp":
        // phải ghi submitted_at thì bài BẮT BUỘC mới vào được hàng chờ chấm của giáo viên, và bài
        // TỰ CHỌN mới đếm được vào mức tự giác — cả hai chỉ số đều đo bằng đúng cột này.
        if(assignment.getWorksheetId()==null&&row.getSubmittedAt()==null){row.setSubmittedAt(LocalDateTime.now());row.setGradingStatus("SUBMITTED");}
        syncWorksheet(assignmentId,row,true);
        AssignmentProgressResponse response=map(progress.save(row));
        // Chỉ ghi lần đầu để bấm lại nhiều lần không đẻ ra nhiều dòng nhật ký.
        if(firstTime&&assignment.getWorksheetId()==null)submissionLog.record(assignment,row.getStudentId(),"SUBMITTED",null,"Đánh dấu hoàn thành");
        return ApiResponse.ok("Đã hoàn thành bài giao",response);
    }

    @PostMapping("/{assignmentId}/submit")
    @Transactional
    public ApiResponse<AssignmentResultResponse> submit(@PathVariable Long assignmentId,
                                                         @Valid @RequestBody AssignmentSubmitRequest request) {
        Assignment assignment = assignment(assignmentId);
        if (assignment.getWorksheetId() == null) throw new BusinessException("Chỉ phiếu bài tập mới có thể nộp để chấm điểm");
        AssignmentProgress row = get(assignmentId);
        if ("RETURNED".equals(row.getGradingStatus())) throw new BusinessException("Điểm đã được trả; không thể nộp lại");
        var items = worksheetItems.findByWorksheetIdOrderByOrderIndex(assignment.getWorksheetId());
        if (items.isEmpty()) throw new BusinessException("Đề chưa có câu hỏi");
        if (request.answers().size() != items.size()) throw new BusinessException("Bạn phải trả lời đầy đủ tất cả câu hỏi");
        int correct = 0;
        for (var item : items) {
            var problem = problems.findById(item.getProblemId()).orElseThrow();
            if (problem.getCorrectOption() == null) throw new BusinessException("Đề có câu chưa được cấu hình đáp án đúng");
            String answer = request.answers().get(item.getProblemId());
            if (answer == null || !Set.of("A", "B", "C", "D").contains(answer.toUpperCase())) throw new BusinessException("Đáp án không hợp lệ");
            if (problem.getCorrectOption().equalsIgnoreCase(answer)) correct++;
        }
        int total = items.size();
        LocalDateTime now = LocalDateTime.now();
        if (row.getOpenedAt() == null) row.setOpenedAt(now);
        row.setAnswerJson(write(request.answers()));
        row.setSubmittedAt(now);
        row.setCompletedAt(now);
        row.setCompletionPercent(100);
        row.setCorrectCount(correct);
        row.setTotalQuestions(total);
        row.setScore(BigDecimal.valueOf(correct).multiply(BigDecimal.TEN).divide(BigDecimal.valueOf(total), 2, RoundingMode.HALF_UP));
        row.setMaxScore(BigDecimal.TEN);
        row.setGradedAt(now);
        row.setGradingStatus("GRADED");
        syncWorksheet(assignmentId, row, true);
        AssignmentProgress saved = progress.save(row);
        submissionLog.record(assignment, saved.getStudentId(), "SUBMITTED", saved.getScore(), correct + "/" + total + " câu đúng");
        return ApiResponse.ok("Nộp bài thành công", result(saved, false));
    }

    @PutMapping("/{assignmentId}/answers")
    @Transactional
    public ApiResponse<AssignmentResultResponse> saveAnswers(@PathVariable Long assignmentId,
                                                              @Valid @RequestBody AssignmentSubmitRequest request) {
        Assignment assignment=assignment(assignmentId);
        if(assignment.getWorksheetId()==null)throw new BusinessException("Chỉ phiếu bài tập mới có đáp án để lưu");
        AssignmentProgress row=get(assignmentId);
        if(row.getSubmittedAt()!=null)throw new BusinessException("Bài đã nộp, không thể sửa đáp án");
        Set<Long> allowed=new HashSet<>();
        worksheetItems.findByWorksheetIdOrderByOrderIndex(assignment.getWorksheetId()).forEach(item->allowed.add(item.getProblemId()));
        Map<Long,String> merged=new LinkedHashMap<>(read(row.getAnswerJson()));
        request.answers().forEach((problemId,answer)->{String normalized=answer==null?"":answer.toUpperCase(Locale.ROOT);if(!allowed.contains(problemId)||!Set.of("A","B","C","D").contains(normalized))throw new BusinessException("Đáp án không hợp lệ");merged.put(problemId,normalized);});
        if(row.getOpenedAt()==null)row.setOpenedAt(LocalDateTime.now());
        row.setAnswerJson(write(merged));
        row.setCompletionPercent(Math.max(10,(int)Math.round(90.0*merged.size()/Math.max(allowed.size(),1))));
        return ApiResponse.ok("Đã tự động lưu đáp án",result(progress.save(row),true));
    }

    @GetMapping("/{assignmentId}/result")
    @Transactional(readOnly = true)
    public ApiResponse<AssignmentResultResponse> result(@PathVariable Long assignmentId) {
        return ApiResponse.ok("Kết quả bài làm", result(get(assignmentId), true));
    }

    private Assignment assignment(Long id) {
        return assignments.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài giao"));
    }

    private AssignmentProgress get(Long id) {
        Assignment assignment = assignment(id);
        Long student = current.requireUserId();
        if (!classStudents.existsByClassIdAndStudentId(assignment.getClassId(), student)) throw new AccessDeniedException("Bài giao không thuộc lớp của bạn");
        return progress.findByAssignmentIdAndStudentId(id, student).orElseGet(() -> {
            AssignmentProgress created = new AssignmentProgress();
            created.setAssignmentId(id);
            created.setStudentId(student);
            return created;
        });
    }

    private void syncWorksheet(Long assignmentId, AssignmentProgress assignmentProgress, boolean completed) {
        Assignment assignment = assignment(assignmentId);
        if (assignment.getWorksheetId() == null) return;
        LearningProgress row = learningProgress.findByStudentIdAndWorksheetId(assignmentProgress.getStudentId(), assignment.getWorksheetId()).orElseGet(() -> {
            LearningProgress created = new LearningProgress();
            created.setStudentId(assignmentProgress.getStudentId());
            created.setWorksheetId(assignment.getWorksheetId());
            return created;
        });
        if (row.getOpenedAt() == null) row.setOpenedAt(LocalDateTime.now());
        row.setStatus(completed ? "COMPLETED" : "IN_PROGRESS");
        row.setCompletionPercent(completed ? 100 : Math.max(row.getCompletionPercent(), 10));
        if (completed) row.setCompletedAt(LocalDateTime.now());
        learningProgress.save(row);
    }

    private AssignmentProgressResponse map(AssignmentProgress row) {
        String status = row.getCompletedAt() != null ? "COMPLETED" : row.getOpenedAt() != null ? "IN_PROGRESS" : "NOT_OPENED";
        return new AssignmentProgressResponse(row.getAssignmentId(), row.getStudentId(), row.getOpenedAt(), row.getCompletedAt(), row.getCompletionPercent(), status);
    }

    private String write(Map<Long, String> answers) {
        try { return objectMapper.writeValueAsString(answers); }
        catch (Exception exception) { throw new BusinessException("Không thể lưu đáp án"); }
    }

    private Map<Long, String> read(String json) {
        if (json == null || json.isBlank()) return Map.of();
        try {
            Map<String, String> raw = objectMapper.readValue(json, new TypeReference<>() {});
            Map<Long, String> answers = new LinkedHashMap<>();
            raw.forEach((key, value) -> answers.put(Long.valueOf(key), value));
            return answers;
        } catch (Exception exception) { return Map.of(); }
    }

    private AssignmentResultResponse result(AssignmentProgress row, boolean includeAnswers) {
        boolean released = row.getReturnedAt() != null;
        return new AssignmentResultResponse(row.getAssignmentId(), row.getStudentId(), row.getGradingStatus(), row.getCompletionPercent(),
                row.getSubmittedAt(), released ? row.getGradedAt() : null, row.getReturnedAt(), released ? row.getScore() : null,
                released ? row.getMaxScore() : null, released ? row.getCorrectCount() : null, released ? row.getTotalQuestions() : null,
                released ? row.getTeacherFeedback() : null, includeAnswers ? read(row.getAnswerJson()) : Map.of());
    }
}
