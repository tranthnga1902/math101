package com.math10.assignments.controller;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.assignments.domain.AssignmentWindow;
import com.math10.assignments.domain.McqGrading;
import com.math10.assignments.domain.WorksheetScoring;
import com.math10.assignments.dto.AssignmentProgressResponse;
import com.math10.assignments.dto.AssignmentResultResponse;
import com.math10.assignments.dto.AssignmentSubmitRequest;
import com.math10.assignments.dto.SubmissionItemView;
import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentProgress;
import com.math10.assignments.entity.AssignmentState;
import com.math10.assignments.repository.AssignmentProgressRepository;
import com.math10.assignments.repository.AssignmentRepository;
import com.math10.assignments.repository.SubmissionItemGradeRepository;
import com.math10.assignments.service.SubmissionLogService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.assignments.service.WorksheetAnswerKeys;
import com.math10.progress.entity.LearningProgress;
import com.math10.progress.repository.LearningProgressRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
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
    private final WorksheetAnswerKeys answerKeys;
    private final SubmissionItemGradeRepository itemGrades;
    private final ObjectMapper objectMapper;

    @PatchMapping("/{assignmentId}/opened")
    @Transactional
    public ApiResponse<AssignmentProgressResponse> opened(@PathVariable Long assignmentId) {
        AssignmentProgress row = get(assignmentId);
        requireContentVisible(assignment(assignmentId));
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
        LocalDateTime now=LocalDateTime.now();
        boolean firstTime=row.getCompletedAt()==null;
        // Bài học/tài liệu không có bước nộp để chấm, nên đánh dấu hoàn thành chính là lần "nộp":
        // phải ghi submitted_at thì bài BẮT BUỘC mới vào được hàng chờ chấm của giáo viên, và bài
        // TỰ CHỌN mới đếm được vào mức tự giác — cả hai chỉ số đều đo bằng đúng cột này.
        boolean marksSubmission=assignment.getWorksheetId()==null&&row.getSubmittedAt()==null;
        // Vì đây là lần nộp thật, nó phải chịu đúng luật vòng đời như nút Nộp bài của phiếu.
        if(marksSubmission)AssignmentWindow.requireSubmittable(assignment,row,now);
        else requireContentVisible(assignment);
        if(row.getOpenedAt()==null)row.setOpenedAt(now);
        row.setCompletedAt(now);row.setCompletionPercent(100);
        if(marksSubmission){row.setSubmittedAt(now);row.setGradingStatus("SUBMITTED");row.setSubmittedLate(AssignmentWindow.isLate(assignment,now));row.setAttemptNo(attempt(row));}
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
        LocalDateTime now = LocalDateTime.now();
        AssignmentWindow.requireSubmittable(assignment, row, now);
        List<McqGrading.Key> keys = answerKeys.of(assignment.getWorksheetId());
        WorksheetScoring.requireCompleteAnswers(keys, request.answers());
        WorksheetScoring.ThongKeTracNghiem tracNghiem = WorksheetScoring.thongKeTracNghiem(keys, request.answers());
        // Máy chấm phần trắc nghiệm ngay; phần tự luận chờ giáo viên nên chưa có điểm người chấm.
        WorksheetScoring.KetQua ketQua = WorksheetScoring.tongHop(keys, request.answers(), Map.of());
        boolean late = AssignmentWindow.isLate(assignment, now);
        if (row.getOpenedAt() == null) row.setOpenedAt(now);
        row.setAnswerJson(write(request.answers()));
        row.setSubmittedAt(now);
        row.setCompletedAt(now);
        row.setCompletionPercent(100);
        row.setCorrectCount(tracNghiem.dung());
        row.setTotalQuestions(tracNghiem.tong());
        // Cho nộp nhiều lượt thì lượt sau đè lượt trước: điểm ghi vào sổ là lần nộp cuối cùng.
        row.setAttemptNo(attempt(row));
        row.setSubmittedLate(late);
        row.setMaxScore(WorksheetScoring.MAX_SCORE);
        BigDecimal rawScore = ketQua.rawScore();
        row.setRawScore(rawScore);
        row.setScore(rawScore == null ? null : AssignmentWindow.applyLatePenalty(assignment, rawScore, late));
        // Đề toàn trắc nghiệm thì chấm xong ngay như trước. Đề có câu tự luận thì dừng ở SUBMITTED
        // với điểm để trống: điền 0 vào đây là báo cho học sinh một con số thấp hơn thật, và họ
        // nhìn thấy nó trước khi giáo viên kịp mở bài ra chấm.
        row.setGradedAt(ketQua.chamXong() ? now : null);
        row.setGradingStatus(ketQua.chamXong() ? "GRADED" : "SUBMITTED");
        // Nộp lại thì điểm từng câu của lượt trước không còn ứng với bài nào — xoá, đừng để giáo
        // viên chấm tiếp lên bài cũ.
        if (row.getId() != null) itemGrades.deleteByProgressId(row.getId());
        syncWorksheet(assignmentId, row, true);
        AssignmentProgress saved = progress.save(row);
        String note = ketQua.chamXong()
                ? tracNghiem.dung() + "/" + tracNghiem.tong() + " câu đúng" + (late ? " · nộp muộn" : "")
                : "Chờ chấm " + ketQua.conThieu() + " câu tự luận" + (late ? " · nộp muộn" : "");
        submissionLog.record(assignment, saved.getStudentId(), "SUBMITTED", saved.getScore(), note);
        return ApiResponse.ok(late ? "Đã nhận bài nộp muộn" : "Nộp bài thành công", result(assignment, saved, false));
    }

    @PutMapping("/{assignmentId}/answers")
    @Transactional
    public ApiResponse<AssignmentResultResponse> saveAnswers(@PathVariable Long assignmentId,
                                                              @Valid @RequestBody AssignmentSubmitRequest request) {
        Assignment assignment=assignment(assignmentId);
        if(assignment.getWorksheetId()==null)throw new BusinessException("Chỉ phiếu bài tập mới có đáp án để lưu");
        AssignmentProgress row=get(assignmentId);
        // Sửa được đáp án đúng lúc còn nộp được — không sớm hơn, không muộn hơn. Trước đây chỉ
        // chặn "đã nộp", nên hết hạn rồi vẫn tự động lưu được, và bài cho nộp nhiều lượt thì
        // lượt thứ hai lại không sửa nổi đáp án.
        AssignmentWindow.requireSubmittable(assignment,row,LocalDateTime.now());
        List<McqGrading.Key> keys=answerKeys.of(assignment.getWorksheetId());
        Map<Long,McqGrading.Key> theoCauHoi=new LinkedHashMap<>();
        keys.forEach(key->theoCauHoi.put(key.problemId(),key));
        Map<Long,String> merged=new LinkedHashMap<>(read(row.getAnswerJson()));
        request.answers().forEach((problemId,answer)->{
            McqGrading.Key key=theoCauHoi.get(problemId);
            if(key==null)throw new BusinessException("Đáp án không hợp lệ");
            if(WorksheetScoring.laTuLuan(key)){
                // Xoá khỏi bài làm khi ô trống, thay vì lưu chuỗi rỗng: em nào gõ rồi xoá đi thì
                // câu đó phải quay lại là chưa làm, cả ở phần trăm hoàn thành lẫn ở lúc nộp.
                String tuLuan=WorksheetScoring.chuanHoaTuLuan(answer);
                if(tuLuan==null)merged.remove(problemId);else merged.put(problemId,tuLuan);
            }else{
                if(!McqGrading.isOption(answer))throw new BusinessException("Đáp án không hợp lệ");
                merged.put(problemId,McqGrading.normalize(answer));
            }
        });
        if(row.getOpenedAt()==null)row.setOpenedAt(LocalDateTime.now());
        row.setAnswerJson(write(merged));
        row.setCompletionPercent(Math.max(10,(int)Math.round(90.0*merged.size()/Math.max(keys.size(),1))));
        return ApiResponse.ok("Đã tự động lưu đáp án",result(assignment,progress.save(row),true));
    }

    @GetMapping("/{assignmentId}/result")
    @Transactional(readOnly = true)
    public ApiResponse<AssignmentResultResponse> result(@PathVariable Long assignmentId) {
        Assignment assignment = assignment(assignmentId);
        requireContentVisible(assignment);
        return ApiResponse.ok("Kết quả bài làm", result(assignment, get(assignmentId), true));
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

    /** Bài chưa tới giờ mở thì đến cả đề cũng không được trả về, nói gì tới đáp án. */
    private void requireContentVisible(Assignment assignment) {
        AssignmentState state = AssignmentWindow.stateOf(assignment, LocalDateTime.now());
        if (!state.contentVisibleToStudent()) {
            throw new BusinessException(state == AssignmentState.SCHEDULED
                    ? "Bài chưa tới giờ mở (" + assignment.getOpenAt() + ")"
                    : "Bài giao chưa được mở");
        }
    }

    private int attempt(AssignmentProgress row) {
        return (row.getAttemptNo() == null ? 0 : row.getAttemptNo()) + 1;
    }

    private AssignmentResultResponse result(Assignment assignment, AssignmentProgress row, boolean includeAnswers) {
        LocalDateTime now = LocalDateTime.now();
        // "Đã công bố" nay có hai đường: giáo viên bấm trả bài, hoặc tới giờ công bố đã hẹn.
        boolean released = AssignmentWindow.scoreVisible(assignment, row, now);
        return new AssignmentResultResponse(row.getAssignmentId(), row.getStudentId(), row.getGradingStatus(), row.getCompletionPercent(),
                row.getSubmittedAt(), released ? row.getGradedAt() : null, row.getReturnedAt(), released ? row.getScore() : null,
                released ? row.getMaxScore() : null, released ? row.getCorrectCount() : null, released ? row.getTotalQuestions() : null,
                released ? row.getTeacherFeedback() : null, includeAnswers ? read(row.getAnswerJson()) : Map.of(),
                AssignmentWindow.stateOf(assignment, now).name(), assignment.getOpenAt(), assignment.getDueAt(),
                AssignmentWindow.attemptsLeft(assignment, row), row.isSubmittedLate(),
                released && row.isSubmittedLate() ? row.getRawScore() : null,
                released ? bangDiemTungCau(assignment, row) : List.of());
    }

    /**
     * Điểm và nhận xét từng câu cho học sinh xem.
     *
     * <p>Chỉ dựng khi điểm đã công bố — người gọi đã kiểm — vì mỗi lần dựng là thêm mấy lượt hỏi
     * cơ sở dữ liệu, mà hàm {@code result} này còn nằm trên cả đường tự động lưu đáp án, chạy vài
     * giây một lần suốt buổi làm bài.
     *
     * <p><b>Không kèm đáp án đúng.</b> Học sinh thấy bài mình làm, điểm từng câu và lời phê của
     * thầy cô; đáp án của đề thì không đi ra bằng đường này — xem {@link AssignmentResultResponse}.
     */
    private List<SubmissionItemView> bangDiemTungCau(Assignment assignment, AssignmentProgress row) {
        if (assignment.getWorksheetId() == null || row.getId() == null || row.getSubmittedAt() == null) return List.of();
        List<McqGrading.Key> keys = answerKeys.of(assignment.getWorksheetId());
        if (keys.isEmpty()) return List.of();
        BigDecimal toiDaMoiCau = WorksheetScoring.diemToiDaMoiCau(keys.size());
        Map<Long, String> baiLam = read(row.getAnswerJson());
        // Đề còn câu trắc nghiệm quên đáp án thì không dựng bảng chấm nào cả: cái sai nằm ở đề,
        // và bịa ra "câu này em sai" cho học sinh xem là biến lỗi soạn đề thành lỗi của các em.
        Map<Long, BigDecimal> tuDong;
        try { tuDong = WorksheetScoring.diemTuDong(keys, baiLam); }
        catch (BusinessException exception) { return List.of(); }
        Map<Long, com.math10.assignments.entity.SubmissionItemGrade> tay = new LinkedHashMap<>();
        itemGrades.findByProgressId(row.getId()).forEach(item -> tay.put(item.getProblemId(), item));
        List<SubmissionItemView> items = new ArrayList<>();
        int orderNo = 0;
        for (McqGrading.Key key : keys) {
            orderNo++;
            boolean tuLuan = WorksheetScoring.laTuLuan(key);
            var luu = tay.get(key.problemId());
            items.add(new SubmissionItemView(key.problemId(), orderNo, null, null, tuLuan, null,
                    baiLam.get(key.problemId()),
                    tuLuan ? (luu == null ? null : luu.getScore()) : tuDong.get(key.problemId()),
                    toiDaMoiCau, luu == null ? null : luu.getFeedback()));
        }
        return items;
    }
}
