package com.math10.classes.controller;

import com.math10.audit.service.AuditService;
import com.math10.classes.dto.RosterImportPreviewResponse;
import com.math10.classes.dto.RosterImportResult;
import com.math10.classes.service.ClassAccessGuard;
import com.math10.classes.service.ClassRosterImportService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.enrollments.entity.ClassStudent;
import com.math10.enrollments.repository.ClassStudentRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * Danh sách học sinh của một lớp: xem, nhập từ file Excel, thêm lẻ từng em còn thiếu, và gỡ khỏi lớp.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes/{classId}/roster")
@PreAuthorize("hasAnyRole('ADMIN','TEACHER')")
public class ClassRosterController {

    private final JdbcTemplate jdbc;
    private final ClassRosterImportService rosterImport;
    private final ClassStudentRepository classStudents;
    private final ClassAccessGuard guard;
    private final AuditService audit;

    @GetMapping
    public ApiResponse<List<Map<String, Object>>> list(@PathVariable Long classId) {
        guard.requireTeacher(classId);
        return ApiResponse.ok("Học sinh của lớp", jdbc.queryForList("""
                select cs.id,cs.student_id,cs.created_at joined_at,
                       u.full_name,u.username,u.email,u.phone,u.status,
                       u.date_of_birth,u.gender
                from class_students cs
                join users u on u.id=cs.student_id and u.deleted_at is null
                where cs.class_id=? and cs.deleted_at is null
                order by u.full_name
                """, classId));
    }

    /** Học sinh đã có tài khoản nhưng chưa vào lớp này — để giáo viên chọn nhanh khi thêm lẻ. */
    @GetMapping("/candidates")
    public ApiResponse<List<Map<String, Object>>> candidates(@PathVariable Long classId,
                                                             @RequestParam(required = false) String search) {
        guard.requireTeacher(classId);
        String keyword = "%" + (search == null ? "" : search.strip().toLowerCase()) + "%";
        return ApiResponse.ok("Học sinh có thể thêm vào lớp", jdbc.queryForList("""
                select u.id,u.full_name,u.username,u.email
                from users u
                where u.deleted_at is null and u.role_code='STUDENT'
                  and (lower(u.full_name) like ? or lower(coalesce(u.username,'')) like ? or lower(u.email) like ?)
                  and not exists (select 1 from class_students cs
                                  where cs.class_id=? and cs.student_id=u.id and cs.deleted_at is null)
                order by u.full_name
                limit 20
                """, keyword, keyword, keyword, classId));
    }

    /**
     * Nhật ký chỉ ghi mã học sinh và việc có tạo tài khoản mới hay không — không ghi lại thân
     * yêu cầu, vì {@link AddStudentRequest} mang cả mật khẩu khởi tạo và bảng nhật ký thì mọi
     * quản trị viên đều đọc được.
     */
    @PostMapping("/students")
    @Transactional
    public ApiResponse<Long> addStudent(@PathVariable Long classId, @RequestBody AddStudentRequest request) {
        guard.requireTeacher(classId);
        Long studentId = rosterImport.addSingle(classId, request.userId(), request.fullName(),
                request.username(), request.email(), request.phone(), request.password());
        audit.record("ADD_STUDENT", "CLASS", classId, null,
                "studentId=%d,newAccount=%b".formatted(studentId, request.userId() == null));
        return ApiResponse.created("Đã thêm học sinh vào lớp", studentId);
    }

    @DeleteMapping("/students/{enrollmentId}")
    @Transactional
    public ApiResponse<Void> removeStudent(@PathVariable Long classId, @PathVariable Long enrollmentId) {
        guard.requireTeacher(classId);
        ClassStudent row = classStudents.findById(enrollmentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy học sinh trong lớp"));
        if (!row.getClassId().equals(classId)) throw new ResourceNotFoundException("Không tìm thấy học sinh trong lớp");
        row.markDeleted();
        classStudents.save(row);
        audit.record("REMOVE_STUDENT", "CLASS", classId,
                "studentId=%d,enrollmentId=%d".formatted(row.getStudentId(), enrollmentId), null);
        return ApiResponse.noContent("Đã gỡ học sinh khỏi lớp");
    }

    // ==================== Nhập từ file Excel ====================

    @GetMapping("/import/template")
    public ResponseEntity<byte[]> template(@PathVariable Long classId) {
        guard.requireTeacher(classId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=danh-sach-hoc-sinh.xlsx")
                .body(rosterImport.template());
    }

    @PostMapping("/import/presign")
    public ApiResponse<ClassRosterImportService.PresignResponse> presign(@PathVariable Long classId,
                                                                         @Valid @RequestBody PresignRequest request) {
        guard.requireTeacher(classId);
        return ApiResponse.ok("Tạo URL tải lên thành công", rosterImport.presign(classId, request.fileName(), request.contentType()));
    }

    @PostMapping("/import/preview")
    public ApiResponse<RosterImportPreviewResponse> preview(@PathVariable Long classId,
                                                             @Valid @RequestBody ObjectKeyRequest request) {
        guard.requireTeacher(classId);
        return ApiResponse.ok("Đọc file danh sách thành công", rosterImport.preview(classId, request.objectKey()));
    }

    @PostMapping("/import/confirm")
    public ApiResponse<RosterImportResult> confirm(@PathVariable Long classId,
                                                    @Valid @RequestBody ObjectKeyRequest request) {
        guard.requireTeacher(classId);
        RosterImportResult result = rosterImport.confirm(classId, request.objectKey());
        audit.record("IMPORT_ROSTER", "CLASS", classId, null,
                "created=%d,enrolled=%d,skipped=%d".formatted(result.created(), result.enrolled(), result.skipped()));
        return ApiResponse.created("Nhập danh sách hoàn tất", result);
    }

    public record PresignRequest(@NotBlank(message = "Thiếu tên file") String fileName, String contentType) {}

    public record ObjectKeyRequest(@NotBlank(message = "Thiếu file đã tải lên") String objectKey) {}

    public record AddStudentRequest(Long userId, String fullName, String username, String email,
                                    String phone, String password) {}
}
