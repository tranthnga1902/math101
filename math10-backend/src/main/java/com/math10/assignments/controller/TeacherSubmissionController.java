package com.math10.assignments.controller;

import com.math10.assignments.domain.AssignmentWindow;
import com.math10.assignments.domain.McqGrading;
import com.math10.assignments.domain.WorksheetScoring;
import com.math10.assignments.dto.SubmissionGradingSheetResponse;
import com.math10.assignments.dto.SubmissionItemView;
import com.math10.assignments.service.WorksheetAnswerKeys;
import com.math10.assignments.entity.Assignment;
import com.math10.assignments.entity.AssignmentProgress;
import com.math10.assignments.entity.SubmissionItemGrade;
import com.math10.assignments.repository.AssignmentProgressRepository;
import com.math10.assignments.repository.AssignmentRepository;
import com.math10.assignments.repository.SubmissionItemGradeRepository;
import com.math10.assignments.service.SubmissionLogService;
import com.math10.audit.service.AuditService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.enrollments.repository.ClassTeacherRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.math10.mathcontent.repository.ProblemRepository;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/teacher/submissions")
@PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
public class TeacherSubmissionController {
    private final JdbcTemplate jdbc;
    private final AssignmentProgressRepository progress;
    private final AssignmentRepository assignments;
    private final SubmissionLogService submissionLog;
    private final ClassTeacherRepository classTeachers;
    private final CurrentUserService current;
    private final WorksheetAnswerKeys answerKeys;
    private final ProblemRepository problems;
    private final SubmissionItemGradeRepository itemGrades;
    private final ObjectMapper objectMapper;
    private final AuditService audit;

    /**
     * Tỉ lệ đúng từng câu. Dùng đúng phép so sánh của {@link McqGrading} chứ không tự so lại,
     * và câu chưa nhập đáp án thì không đội lốt "cả lớp làm sai" — đề hỏng phải hiện ra là đề hỏng.
     */
    @GetMapping("/assignments/{assignmentId}/analysis")
    public ApiResponse<List<Map<String,Object>>> analysis(@PathVariable Long assignmentId){
        Assignment assignment=worksheetAssignment(assignmentId);
        List<Map<Long,String>> baiLam=progress.findByAssignmentId(assignmentId).stream()
                .filter(row->row.getSubmittedAt()!=null).map(row->readAnswers(row.getAnswerJson())).toList();
        List<McqGrading.Key> keys=answerKeys.of(assignment.getWorksheetId());
        Map<Long,String> codeByProblem=new LinkedHashMap<>();
        problems.findAllById(keys.stream().map(McqGrading.Key::problemId).toList())
                .forEach(problem->codeByProblem.put(problem.getId(),problem.getPublicCode()));
        List<Map<String,Object>> result=new ArrayList<>();
        int orderNo=0;
        for(McqGrading.Key key:keys){
            orderNo++;
            boolean tuLuan=WorksheetScoring.laTuLuan(key);
            boolean coDapAn=McqGrading.isOption(key.correctOption());
            boolean thongKeDuoc=!tuLuan&&coDapAn;
            int correct=0;
            for(Map<Long,String> answers:baiLam)if(McqGrading.isCorrect(key,answers.get(key.problemId())))correct++;
            double rate=baiLam.isEmpty()?0:Math.round(1000.0*correct/baiLam.size())/10.0;
            Map<String,Object> value=new LinkedHashMap<>();
            value.put("problemId",key.problemId());
            value.put("orderNo",orderNo);
            value.put("publicCode",codeByProblem.get(key.problemId()));
            value.put("essay",tuLuan);
            value.put("correct",thongKeDuoc?correct:null);
            value.put("total",baiLam.size());
            value.put("rate",thongKeDuoc?rate:null);
            // Câu chưa nhập đáp án không phải câu cả lớp làm sai. Tô đỏ nhầm ở đây là giáo viên
            // đi sửa đề đúng thành đề khác. Câu tự luận thì càng không: nó vốn không có đáp án để
            // nhập, báo "thiếu đáp án" ở đây là bắt giáo viên đi sửa một cái không hỏng.
            value.put("missingAnswerKey",!tuLuan&&!coDapAn);
            value.put("warning",thongKeDuoc&&!baiLam.isEmpty()&&rate<30);
            result.add(value);
        }
        return ApiResponse.ok("Phân tích câu hỏi",result);
    }

    /**
     * Chấm lại cả lớp sau khi sửa đáp án đề. Nếu đề còn câu trắc nghiệm chưa nhập đáp án thì dừng
     * hẳn: trước đây câu đó bị tính là cả lớp làm sai nhưng vẫn chia cho đủ số câu, nên chỉ cần
     * thêm một câu quên đáp án rồi bấm nút này là tụt điểm cả lớp mà không ai được báo.
     *
     * <p>Chỉ tính lại <b>phần máy chấm</b>. Điểm tự luận giáo viên đã nhập được giữ nguyên và cộng
     * lại vào tổng — nút này để sửa đáp án trắc nghiệm, không phải để xoá công chấm tay.
     *
     * <p>Bài nào giáo viên đã cho điểm cả bài bằng tay (không có bảng điểm từng câu) thì bỏ qua:
     * tính lại một bài như thế là lấy con số giáo viên tự chấm thay bằng con số máy tính ra từ
     * phần trắc nghiệm, tức là mất trắng phần tự luận.
     */
    @PostMapping("/assignments/{assignmentId}/regrade") @Transactional
    public ApiResponse<Map<String,Integer>> regrade(@PathVariable Long assignmentId){
        Assignment assignment=worksheetAssignment(assignmentId);
        List<McqGrading.Key> keys=answerKeys.of(assignment.getWorksheetId());
        WorksheetScoring.requireGradable(keys);
        boolean coTuLuan=WorksheetScoring.coCauTuLuan(keys);
        List<AssignmentProgress> rows=progress.findByAssignmentId(assignmentId).stream()
                .filter(row->row.getSubmittedAt()!=null).toList();
        Map<Long,Map<Long,BigDecimal>> diemTay=diemNguoiCham(rows.stream().map(AssignmentProgress::getId).toList());
        int updated=0,doiDiem=0,boQua=0;
        for(AssignmentProgress row:rows){
            Map<Long,BigDecimal> cuaEm=diemTay.getOrDefault(row.getId(),Map.of());
            if(coTuLuan&&cuaEm.isEmpty()&&row.getRawScore()!=null){boQua++;continue;}
            BigDecimal diemCu=row.getScore();
            Map<Long,String> baiLam=readAnswers(row.getAnswerJson());
            WorksheetScoring.ThongKeTracNghiem tracNghiem=WorksheetScoring.thongKeTracNghiem(keys,baiLam);
            WorksheetScoring.KetQua ketQua=WorksheetScoring.tongHop(keys,baiLam,cuaEm);
            row.setCorrectCount(tracNghiem.dung());row.setTotalQuestions(tracNghiem.tong());
            // Tính lại từ điểm gốc rồi mới trừ muộn: chấm lại nhiều lần không được trừ chồng lên nhau.
            row.setRawScore(ketQua.rawScore());
            row.setScore(ketQua.rawScore()==null?null
                    :AssignmentWindow.applyLatePenalty(assignment,ketQua.rawScore(),row.isSubmittedLate()));
            row.setMaxScore(WorksheetScoring.MAX_SCORE);
            if(ketQua.chamXong()){
                row.setGradedAt(LocalDateTime.now());
                if(row.getReturnedAt()==null)row.setGradingStatus("GRADED");
            }else{
                // Sửa đề làm mọc thêm câu tự luận chưa chấm thì bài phải quay về hàng chờ, và điểm
                // đã trả cho học sinh phải rút lại — để nguyên là để một con số sai đứng trên màn
                // hình các em mà không ai biết nó đã hết đúng.
                row.setGradedAt(null);row.setReturnedAt(null);row.setGradingStatus("SUBMITTED");
            }
            progress.save(row);updated++;
            if(!bangNhau(diemCu,row.getScore()))doiDiem++;
        }
        // Đây là thao tác đổi điểm cả lớp bằng một nút bấm, và trước lát này nó không để lại dấu
        // vết nào: không có bản ghi nào nói ai bấm, lúc nào, và bao nhiêu bài đổi điểm.
        audit.record("REGRADE","ASSIGNMENT",assignmentId,null,
                "updated=%d,scoreChanged=%d,skipped=%d".formatted(updated,doiDiem,boQua));
        return ApiResponse.ok(boQua==0?"Đã chấm lại toàn bộ bài nộp"
                        :"Đã chấm lại "+updated+" bài, giữ nguyên "+boQua+" bài giáo viên đã tự cho điểm",
                Map.of("updated",updated,"skipped",boQua));
    }

    /**
     * So điểm cũ với điểm mới. Dùng {@code compareTo} chứ không {@code equals}: 8.0 và 8.00 là hai
     * {@code BigDecimal} khác nhau theo {@code equals} nhưng là cùng một điểm, và đếm nhầm ở đây
     * thì con số "bao nhiêu bài đổi điểm" trong nhật ký hết dùng được.
     */
    private static boolean bangNhau(BigDecimal a,BigDecimal b){
        if(a==null||b==null)return a==null&&b==null;
        return a.compareTo(b)==0;
    }

    /** Điểm tự luận giáo viên đã nhập, gom theo bài nộp — một lượt hỏi cho cả lớp. */
    private Map<Long,Map<Long,BigDecimal>> diemNguoiCham(List<Long> progressIds){
        Map<Long,Map<Long,BigDecimal>> result=new LinkedHashMap<>();
        if(progressIds.isEmpty())return result;
        for(var item:itemGrades.findByProgressIdIn(progressIds)){
            if(item.getScore()==null)continue;
            result.computeIfAbsent(item.getProgressId(),key->new LinkedHashMap<>()).put(item.getProblemId(),item.getScore());
        }
        return result;
    }

    private Assignment worksheetAssignment(Long assignmentId){
        Assignment assignment=assignments.findById(assignmentId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài giao"));
        checkClass(assignment.getClassId());
        if(assignment.getWorksheetId()==null)throw new BusinessException("Bài giao không phải phiếu đề");
        return assignment;
    }

    /**
     * Hàng chờ chấm của một lớp. Chỉ bài BẮT BUỘC lọt vào đây: bài TỰ CHỌN cũng ghi submitted_at
     * (học sinh đánh dấu hoàn thành) nhưng theo cách chấm đã chốt thì nó chỉ đo mức tự giác,
     * không bao giờ ra điểm — nên phải chặn ngay từ danh sách để giáo viên không chấm nhầm.
     */
    @GetMapping
    public ApiResponse<List<Map<String,Object>>> list(@RequestParam Long classId) {
        checkClass(classId);
        return ApiResponse.ok("Danh sách bài nộp", jdbc.queryForList("""
            select ap.id,ap.assignment_id,a.title,ap.student_id,u.full_name,u.username,
                   ap.submitted_at,ap.graded_at,ap.returned_at,ap.score,ap.max_score,
                   ap.correct_count,ap.total_questions,ap.teacher_feedback,ap.grading_status,ap.answer_json,
                   ap.attempt_no,ap.submitted_late,ap.raw_score,a.due_at,a.late_policy,a.late_penalty_percent
            from assignment_progress ap
            join assignments a on a.id=ap.assignment_id and a.deleted_at is null
            join users u on u.id=ap.student_id and u.deleted_at is null
            where a.class_id=? and a.requirement='BAT_BUOC' and ap.submitted_at is not null and ap.deleted_at is null
            order by ap.submitted_at desc
            """, classId));
    }

    @PutMapping("/{id}/grade")
    @Transactional
    public ApiResponse<Void> grade(@PathVariable Long id,@Valid @RequestBody GradeRequest request) {
        AssignmentProgress row=owned(id);
        Assignment assignment=assignment(row);
        String truoc=diemHienTai(row);
        if(row.getSubmittedAt()==null)throw new BusinessException("Học sinh chưa nộp bài");
        if(!"BAT_BUOC".equals(assignment.getRequirement()))throw new BusinessException("Bài tự chọn chỉ ghi nhận đã làm, không chấm điểm");
        // Giáo viên nhập điểm bài làm; phần trừ nộp muộn là chính sách của bài, máy áp dụng,
        // để cả lớp bị trừ như nhau chứ không phụ thuộc người chấm có nhớ hay không.
        row.setRawScore(request.score());row.setScore(AssignmentWindow.applyLatePenalty(assignment,request.score(),row.isSubmittedLate()));
        row.setMaxScore(BigDecimal.TEN);row.setTeacherFeedback(request.feedback());
        row.setGradedAt(LocalDateTime.now());row.setGradingStatus("GRADED");row.setReturnedAt(null);progress.save(row);
        // Cho điểm cả bài thì bảng điểm từng câu không còn giải thích cho con số này nữa — giữ lại
        // là để hai bản ghi mâu thuẫn nhau nằm cạnh nhau, rồi học sinh cộng tay từng câu ra một
        // đằng còn sổ điểm ghi một nẻo.
        itemGrades.deleteByProgressId(id);
        submissionLog.record(assignment,row.getStudentId(),"GRADED",row.getScore(),request.feedback());
        audit.record("GRADE","SUBMISSION",id,truoc,diemHienTai(row));
        return ApiResponse.noContent("Đã lưu điểm");
    }

    /**
     * Bảng chấm chi tiết một bài nộp: từng câu, bài làm của học sinh, điểm máy chấm và điểm giáo
     * viên đã nhập. Đây là màn hình chấm tự luận.
     */
    @GetMapping("/{id}/items")
    @Transactional(readOnly=true)
    public ApiResponse<SubmissionGradingSheetResponse> items(@PathVariable Long id){
        AssignmentProgress row=owned(id);
        Assignment assignment=assignment(row);
        if(assignment.getWorksheetId()==null)throw new BusinessException("Bài giao không phải phiếu đề");
        if(row.getSubmittedAt()==null)throw new BusinessException("Học sinh chưa nộp bài");
        return ApiResponse.ok("Bảng chấm chi tiết",bangCham(row,assignment));
    }

    /**
     * Lưu điểm và nhận xét từng câu tự luận.
     *
     * <p>Cho phép lưu dở: giáo viên chấm 40 bài không làm một mạch được, nên lần gọi này chỉ cần
     * mang những câu vừa chấm. Chỉ khi <b>mọi</b> câu tự luận đã có điểm thì tổng mới được chốt và
     * bài mới chuyển sang đã chấm — chốt sớm là đưa cho học sinh một con số thấp hơn thật.
     *
     * <p>Không nhận điểm cho câu trắc nghiệm: điểm câu trắc nghiệm do đáp án của đề quyết định,
     * và chỉ một chỗ được quyết. Muốn sửa thì sửa đáp án rồi bấm chấm lại.
     */
    @PutMapping("/{id}/grade-items")
    @Transactional
    public ApiResponse<SubmissionGradingSheetResponse> gradeItems(@PathVariable Long id,
                                                                   @Valid @RequestBody GradeItemsRequest request){
        AssignmentProgress row=owned(id);
        Assignment assignment=assignment(row);
        if(assignment.getWorksheetId()==null)throw new BusinessException("Bài giao không phải phiếu đề");
        if(row.getSubmittedAt()==null)throw new BusinessException("Học sinh chưa nộp bài");
        if(!"BAT_BUOC".equals(assignment.getRequirement()))throw new BusinessException("Bài tự chọn chỉ ghi nhận đã làm, không chấm điểm");
        String truoc=diemHienTai(row);
        List<McqGrading.Key> keys=answerKeys.of(assignment.getWorksheetId());
        WorksheetScoring.requireGradable(keys);
        if(!WorksheetScoring.coCauTuLuan(keys))throw new BusinessException("Phiếu này không có câu tự luận để chấm tay");
        BigDecimal toiDaMoiCau=WorksheetScoring.diemToiDaMoiCau(keys.size());
        Map<Long,McqGrading.Key> theoCauHoi=new LinkedHashMap<>();
        keys.forEach(key->theoCauHoi.put(key.problemId(),key));
        Map<Long,SubmissionItemGrade> daCo=new LinkedHashMap<>();
        itemGrades.findByProgressId(id).forEach(item->daCo.put(item.getProblemId(),item));
        for(ItemScoreRequest item:request.items()){
            McqGrading.Key key=theoCauHoi.get(item.problemId());
            if(key==null)throw new BusinessException("Câu hỏi không thuộc phiếu đề này");
            if(!WorksheetScoring.laTuLuan(key))throw new BusinessException("Câu trắc nghiệm do máy chấm theo đáp án, không nhập điểm tay");
            if(item.score()!=null&&(item.score().signum()<0||item.score().compareTo(toiDaMoiCau)>0))
                throw new BusinessException("Điểm mỗi câu phải trong khoảng 0 đến "+toiDaMoiCau.toPlainString());
            SubmissionItemGrade luu=daCo.get(item.problemId());
            if(luu==null){
                luu=new SubmissionItemGrade();
                luu.setProgressId(id);luu.setProblemId(item.problemId());
                daCo.put(item.problemId(),luu);
            }
            luu.setMaxScore(toiDaMoiCau);luu.setScore(item.score());luu.setFeedback(item.feedback());
            itemGrades.save(luu);
        }
        Map<Long,String> baiLam=readAnswers(row.getAnswerJson());
        Map<Long,BigDecimal> diemTay=new LinkedHashMap<>();
        daCo.values().forEach(item->{if(item.getScore()!=null)diemTay.put(item.getProblemId(),item.getScore());});
        WorksheetScoring.ThongKeTracNghiem tracNghiem=WorksheetScoring.thongKeTracNghiem(keys,baiLam);
        WorksheetScoring.KetQua ketQua=WorksheetScoring.tongHop(keys,baiLam,diemTay);
        row.setCorrectCount(tracNghiem.dung());row.setTotalQuestions(tracNghiem.tong());
        row.setMaxScore(WorksheetScoring.MAX_SCORE);
        row.setRawScore(ketQua.rawScore());
        row.setScore(ketQua.rawScore()==null?null
                :AssignmentWindow.applyLatePenalty(assignment,ketQua.rawScore(),row.isSubmittedLate()));
        if(request.feedback()!=null)row.setTeacherFeedback(request.feedback());
        if(ketQua.chamXong()){
            row.setGradedAt(LocalDateTime.now());row.setGradingStatus("GRADED");row.setReturnedAt(null);
        }else{
            // Chấm dở thì bài vẫn nằm trong hàng chờ và học sinh chưa thấy gì — đúng như trước khi
            // giáo viên mở nó ra.
            row.setGradedAt(null);row.setReturnedAt(null);row.setGradingStatus("SUBMITTED");
        }
        progress.save(row);
        if(ketQua.chamXong())submissionLog.record(assignment,row.getStudentId(),"GRADED",row.getScore(),request.feedback());
        audit.record("GRADE_ITEMS","SUBMISSION",id,truoc,
                diemHienTai(row)+",itemsSaved=%d,remaining=%d".formatted(request.items().size(),ketQua.conThieu()));
        return ApiResponse.ok(ketQua.chamXong()?"Đã chấm xong bài này"
                :"Đã lưu, còn "+ketQua.conThieu()+" câu chưa chấm",bangCham(row,assignment));
    }

    private SubmissionGradingSheetResponse bangCham(AssignmentProgress row,Assignment assignment){
        List<McqGrading.Key> keys=answerKeys.of(assignment.getWorksheetId());
        WorksheetScoring.requireGradable(keys);
        BigDecimal toiDaMoiCau=WorksheetScoring.diemToiDaMoiCau(keys.size());
        Map<Long,String> baiLam=readAnswers(row.getAnswerJson());
        Map<Long,BigDecimal> tuDong=WorksheetScoring.diemTuDong(keys,baiLam);
        Map<Long,SubmissionItemGrade> tay=new LinkedHashMap<>();
        itemGrades.findByProgressId(row.getId()).forEach(item->tay.put(item.getProblemId(),item));
        Map<Long,com.math10.mathcontent.entity.Problem> deBai=new LinkedHashMap<>();
        problems.findAllById(keys.stream().map(McqGrading.Key::problemId).toList())
                .forEach(problem->deBai.put(problem.getId(),problem));
        List<SubmissionItemView> items=new ArrayList<>();
        int orderNo=0;
        for(McqGrading.Key key:keys){
            orderNo++;
            boolean tuLuan=WorksheetScoring.laTuLuan(key);
            SubmissionItemGrade luu=tay.get(key.problemId());
            var problem=deBai.get(key.problemId());
            items.add(new SubmissionItemView(key.problemId(),orderNo,
                    problem==null?null:problem.getPublicCode(),
                    problem==null?null:problem.getStatementLatex(),
                    tuLuan,tuLuan?null:key.correctOption(),baiLam.get(key.problemId()),
                    tuLuan?(luu==null?null:luu.getScore()):tuDong.get(key.problemId()),
                    toiDaMoiCau,tuLuan&&luu!=null?luu.getFeedback():null));
        }
        Map<Long,BigDecimal> diemTay=new LinkedHashMap<>();
        tay.values().forEach(item->{if(item.getScore()!=null)diemTay.put(item.getProblemId(),item.getScore());});
        WorksheetScoring.KetQua ketQua=WorksheetScoring.tongHop(keys,baiLam,diemTay);
        String hoTen=jdbc.queryForObject("select full_name from users where id=? and deleted_at is null",String.class,row.getStudentId());
        return new SubmissionGradingSheetResponse(row.getId(),row.getAssignmentId(),row.getStudentId(),hoTen,
                row.getGradingStatus(),row.getTeacherFeedback(),toiDaMoiCau,items,
                ketQua.daCham(),ketQua.tongSoCau(),ketQua.conThieu(),ketQua.rawScore(),row.getScore(),
                row.isSubmittedLate());
    }

    @PatchMapping("/{id}/return")
    @Transactional
    public ApiResponse<Void> release(@PathVariable Long id) {
        AssignmentProgress row=owned(id);
        if(row.getScore()==null)throw new BusinessException("Phải chấm điểm trước khi trả bài");
        String truoc=diemHienTai(row);
        row.setReturnedAt(LocalDateTime.now());row.setGradingStatus("RETURNED");progress.save(row);
        submissionLog.record(assignment(row),row.getStudentId(),"RETURNED",row.getScore(),null);
        audit.record("RETURN","SUBMISSION",id,truoc,diemHienTai(row));
        return ApiResponse.noContent("Đã trả điểm cho học sinh");
    }

    /**
     * Tóm tắt gọn cho nhật ký. Cố tình không ghi cả bản ghi bài nộp: {@code answer_json} là bài
     * làm của học sinh, đưa vào bảng nhật ký là nhân bản dữ liệu học tập ra một chỗ mà mọi quản
     * trị viên đều đọc được, trong khi câu hỏi nhật ký cần trả lời chỉ là điểm đã đổi thế nào.
     */
    private static String diemHienTai(AssignmentProgress row){
        return "student=%d,score=%s,rawScore=%s,status=%s".formatted(
                row.getStudentId(),row.getScore(),row.getRawScore(),row.getGradingStatus());
    }

    private Assignment assignment(AssignmentProgress row){
        return assignments.findById(row.getAssignmentId()).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài giao"));
    }

    private AssignmentProgress owned(Long id){
        AssignmentProgress row=progress.findById(id).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy bài nộp"));
        Long classId=jdbc.queryForObject("select class_id from assignments where id=? and deleted_at is null",Long.class,row.getAssignmentId());
        checkClass(classId);return row;
    }
    private void checkClass(Long classId){if("ADMIN".equals(current.requireRoleCode()))return;if(!classTeachers.existsByClassIdAndTeacherId(classId,current.requireUserId()))throw new AccessDeniedException("Không có quyền truy cập lớp");}
    private Map<Long,String> readAnswers(String json){if(json==null||json.isBlank())return Map.of();try{Map<String,String> raw=objectMapper.readValue(json,new TypeReference<>(){});Map<Long,String> result=new LinkedHashMap<>();raw.forEach((key,value)->result.put(Long.valueOf(key),value));return result;}catch(Exception e){return Map.of();}}
    public record GradeRequest(@NotNull @DecimalMin("0") @DecimalMax("10") BigDecimal score,String feedback){}

    /**
     * {@code score} để trống nghĩa là <b>bỏ chấm câu này</b>, đưa nó về trạng thái chưa chấm —
     * không phải cho 0 điểm. Trần điểm mỗi câu phụ thuộc số câu của đề nên soát trong thân hàm
     * chứ không đặt được bằng {@code @DecimalMax}.
     */
    public record ItemScoreRequest(@NotNull Long problemId,@DecimalMin("0") BigDecimal score,String feedback){}

    /** {@code feedback} là nhận xét cho cả bài; để trống thì giữ nguyên nhận xét cũ. */
    public record GradeItemsRequest(@NotNull @Valid List<ItemScoreRequest> items,String feedback){}
}
