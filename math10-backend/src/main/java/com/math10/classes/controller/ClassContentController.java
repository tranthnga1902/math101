package com.math10.classes.controller;

import com.math10.classes.entity.ClassCurriculum;
import com.math10.classes.entity.ClassDocument;
import com.math10.classes.entity.ClassRequirement;
import com.math10.classes.repository.ClassCurriculumRepository;
import com.math10.classes.repository.ClassDocumentRepository;
import com.math10.classes.service.ClassAccessGuard;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.documents.entity.Document;
import com.math10.documents.entity.DocumentStatus;
import com.math10.documents.repository.DocumentRepository;
import com.math10.documents.support.DocumentUrls;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Nội dung của một lớp: chương trình học (tham chiếu cây chuyên đề) và tài liệu đi kèm.
 * Tài liệu chỉ được gắn theo tham chiếu — nhãn Bắt buộc/Tự chọn nằm ở cấp lớp, còn tài liệu
 * gốc trong kho chung thì giáo viên không sửa/xóa được.
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/classes/{classId}")
@PreAuthorize("hasAnyRole('ADMIN','TEACHER','STUDENT')")
public class ClassContentController {

    private final JdbcTemplate jdbc;
    private final ClassCurriculumRepository curriculum;
    private final ClassDocumentRepository classDocuments;
    private final DocumentRepository documents;
    private final ClassAccessGuard guard;
    private final CurrentUserService current;

    // ==================== Chương trình học ====================

    @GetMapping("/curriculum")
    public ApiResponse<List<Map<String, Object>>> listCurriculum(@PathVariable Long classId) {
        requireMember(classId);
        return ApiResponse.ok("Chương trình học của lớp", jdbc.queryForList("""
                select cc.id,cc.taxonomy_node_id,cc.order_no,cc.note,cc.created_at,
                       tn.title,tn.depth,tn.slug,parent.title parent_title,
                       (select count(*) from documents d where d.taxonomy_node_id=cc.taxonomy_node_id and d.deleted_at is null) document_count
                from class_curriculum cc
                join taxonomy_node tn on tn.id=cc.taxonomy_node_id and tn.deleted_at is null
                left join taxonomy_node parent on parent.id=tn.parent_id
                where cc.class_id=? and cc.deleted_at is null
                order by cc.order_no,cc.id
                """, classId));
    }

    @PostMapping("/curriculum")
    @Transactional
    public ApiResponse<Void> addCurriculum(@PathVariable Long classId, @Valid @RequestBody CurriculumRequest request) {
        requireTeacher(classId);
        Integer exists = jdbc.queryForObject("select count(*) from taxonomy_node where id=? and deleted_at is null", Integer.class, request.taxonomyNodeId());
        if (exists == null || exists == 0) throw new ResourceNotFoundException("Không tìm thấy mục chuyên đề");
        if (curriculum.existsByClassIdAndTaxonomyNodeId(classId, request.taxonomyNodeId()))
            throw new BusinessException("Mục này đã có trong chương trình học của lớp");
        Integer next = jdbc.queryForObject("select coalesce(max(order_no),0)+1 from class_curriculum where class_id=? and deleted_at is null", Integer.class, classId);
        ClassCurriculum row = new ClassCurriculum();
        row.setClassId(classId);
        row.setTaxonomyNodeId(request.taxonomyNodeId());
        row.setOrderNo(next == null ? 1 : next);
        row.setNote(request.note());
        row.setCreatedBy(current.requireUserId());
        curriculum.save(row);
        return ApiResponse.created("Đã thêm vào chương trình học", null);
    }

    @DeleteMapping("/curriculum/{id}")
    @Transactional
    public ApiResponse<Void> removeCurriculum(@PathVariable Long classId, @PathVariable Long id) {
        requireTeacher(classId);
        ClassCurriculum row = curriculum.findByIdAndClassId(id, classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mục chương trình học"));
        row.markDeleted();
        curriculum.save(row);
        return ApiResponse.noContent("Đã bỏ khỏi chương trình học");
    }

    // ==================== Tài liệu của lớp ====================

    @GetMapping("/documents")
    public ApiResponse<List<Map<String, Object>>> listDocuments(@PathVariable Long classId) {
        requireMember(classId);
        List<Map<String, Object>> rows = jdbc.queryForList("""
                select cd.id,cd.document_id,cd.requirement,cd.note,cd.created_at attached_at,
                       d.title,d.doc_type,d.file_url,d.thumbnail_url,d.total_pages,d.owner_id,d.content_markdown is not null has_markdown,
                       case when d.owner_id is null then 'KHO_CHUNG' else 'RIENG' end source,
                       owner.full_name owner_name,tn.title taxonomy_title,attacher.full_name attached_by_name
                from class_documents cd
                join documents d on d.id=cd.document_id and d.deleted_at is null
                left join users owner on owner.id=d.owner_id
                left join users attacher on attacher.id=cd.attached_by
                left join taxonomy_node tn on tn.id=d.taxonomy_node_id
                where cd.class_id=? and cd.deleted_at is null
                order by cd.requirement,cd.created_at desc
                """, classId);
        rows.forEach(row -> {
            DocumentUrls.maskContent(row, "document_id", "doc_type", "file_url");
            DocumentUrls.maskThumbnail(row, "document_id", "thumbnail_url");
        });
        return ApiResponse.ok("Tài liệu của lớp", rows);
    }

    /** Kho tài liệu giáo viên được phép gắn: kho chung cấp trường (owner_id is null) + tài liệu riêng của chính mình. */
    @GetMapping("/document-library")
    public ApiResponse<List<Map<String, Object>>> library(@PathVariable Long classId,
                                                         @RequestParam(required = false) String search,
                                                         @RequestParam(required = false) String source,
                                                         @RequestParam(required = false) Long taxonomyNodeId) {
        requireTeacher(classId);
        boolean isAdmin = "ADMIN".equals(current.requireRoleCode());
        StringBuilder sql = new StringBuilder("""
                select d.id,d.title,d.doc_type,d.file_url,d.thumbnail_url,d.total_pages,d.owner_id,d.taxonomy_node_id,d.created_at,
                       case when d.owner_id is null then 'KHO_CHUNG' else 'RIENG' end source,
                       tn.title taxonomy_title,
                       exists(select 1 from class_documents cd where cd.class_id=? and cd.document_id=d.id and cd.deleted_at is null) attached
                from documents d
                left join taxonomy_node tn on tn.id=d.taxonomy_node_id
                where d.deleted_at is null and d.status <> 'HIDDEN' and (? or d.owner_id is null or d.owner_id=?)
                """);
        List<Object> args = new ArrayList<>(List.of(classId, isAdmin, current.requireUserId()));
        if (search != null && !search.isBlank()) {
            sql.append(" and lower(d.title) like ?");
            args.add("%" + search.strip().toLowerCase() + "%");
        }
        if ("KHO_CHUNG".equals(source)) sql.append(" and d.owner_id is null");
        else if ("RIENG".equals(source)) sql.append(" and d.owner_id is not null");
        if (taxonomyNodeId != null) {
            sql.append(" and d.taxonomy_node_id=?");
            args.add(taxonomyNodeId);
        }
        sql.append(" order by d.created_at desc limit 300");
        List<Map<String, Object>> rows = jdbc.queryForList(sql.toString(), args.toArray());
        rows.forEach(row -> {
            DocumentUrls.maskContent(row, "id", "doc_type", "file_url");
            DocumentUrls.maskThumbnail(row, "id", "thumbnail_url");
        });
        return ApiResponse.ok("Kho tài liệu có thể gắn vào lớp", rows);
    }

    @PostMapping("/documents")
    @Transactional
    public ApiResponse<Void> attachDocument(@PathVariable Long classId, @Valid @RequestBody ClassDocumentRequest request) {
        requireTeacher(classId);
        Document document = documents.findById(request.documentId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu"));
        if (document.getStatus() == DocumentStatus.HIDDEN) throw new BusinessException("Tài liệu này đang bị ẩn");
        // Giáo viên chỉ gắn được tài liệu của kho chung hoặc tài liệu do chính mình tải lên.
        if (!"ADMIN".equals(current.requireRoleCode())
                && document.getOwnerId() != null && !document.getOwnerId().equals(current.requireUserId()))
            throw new AccessDeniedException("Không có quyền dùng tài liệu này");
        if (classDocuments.existsByClassIdAndDocumentId(classId, request.documentId()))
            throw new BusinessException("Tài liệu này đã có trong lớp");
        ClassDocument row = new ClassDocument();
        row.setClassId(classId);
        row.setDocumentId(request.documentId());
        row.setRequirement(request.requirement() == null ? ClassRequirement.TU_CHON : request.requirement());
        row.setNote(request.note());
        row.setAttachedBy(current.requireUserId());
        classDocuments.save(row);
        return ApiResponse.created("Đã gắn tài liệu vào lớp", null);
    }

    /** Chỉ đổi nhãn bắt buộc/tự chọn và ghi chú ở cấp lớp — không đụng tới tài liệu gốc. */
    @PatchMapping("/documents/{id}")
    @Transactional
    public ApiResponse<Void> updateDocument(@PathVariable Long classId, @PathVariable Long id,
                                            @RequestBody ClassDocumentUpdateRequest request) {
        requireTeacher(classId);
        ClassDocument row = classDocuments.findByIdAndClassId(id, classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu trong lớp"));
        if (request.requirement() != null) row.setRequirement(request.requirement());
        if (request.note() != null) row.setNote(request.note());
        classDocuments.save(row);
        return ApiResponse.ok("Đã cập nhật tài liệu của lớp", null);
    }

    @DeleteMapping("/documents/{id}")
    @Transactional
    public ApiResponse<Void> detachDocument(@PathVariable Long classId, @PathVariable Long id) {
        requireTeacher(classId);
        ClassDocument row = classDocuments.findByIdAndClassId(id, classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu trong lớp"));
        row.markDeleted();
        classDocuments.save(row);
        return ApiResponse.noContent("Đã bỏ tài liệu khỏi lớp");
    }

    // ==================== Theo dõi ====================

    /**
     * Bảng theo dõi từng học sinh. Bắt buộc và tự chọn tách hẳn hai cột: phần bắt buộc cho ra
     * điểm trung bình, phần tự chọn chỉ đếm mức độ tự giác — không trộn vào điểm.
     */
    @GetMapping("/progress")
    public ApiResponse<List<Map<String, Object>>> progress(@PathVariable Long classId) {
        requireTeacher(classId);
        return ApiResponse.ok("Theo dõi lớp", jdbc.queryForList("""
                select u.id student_id,u.full_name,u.username,
                       count(a.id) filter (where a.requirement='BAT_BUOC') required_total,
                       count(a.id) filter (where a.requirement='BAT_BUOC' and ap.submitted_at is not null) required_submitted,
                       round(avg(ap.score) filter (where a.requirement='BAT_BUOC' and ap.returned_at is not null),2) required_avg_score,
                       count(a.id) filter (where a.requirement='TU_CHON') optional_total,
                       count(a.id) filter (where a.requirement='TU_CHON' and ap.submitted_at is not null) optional_submitted,
                       max(ap.submitted_at) last_submitted_at
                from class_students cs
                join users u on u.id=cs.student_id and u.deleted_at is null
                left join assignments a on a.class_id=cs.class_id and a.deleted_at is null
                left join assignment_progress ap on ap.assignment_id=a.id and ap.student_id=u.id and ap.deleted_at is null
                where cs.class_id=? and cs.deleted_at is null
                group by u.id,u.full_name,u.username
                order by u.full_name
                """, classId));
    }

    /** Nhật ký: mỗi lần nộp bài / chấm / trả bài là một dòng, mới nhất lên đầu. */
    @GetMapping("/submission-log")
    public ApiResponse<List<Map<String, Object>>> submissionLog(@PathVariable Long classId,
                                                                @RequestParam(required = false) Long studentId,
                                                                @RequestParam(defaultValue = "100") int limit) {
        requireTeacher(classId);
        int size = Math.max(1, Math.min(limit, 500));
        StringBuilder sql = new StringBuilder("""
                select l.id,l.assignment_id,a.title,l.student_id,u.full_name,u.username,
                       l.action,l.requirement,l.score,l.note,l.created_at,l.actor_id,actor.full_name actor_name
                from assignment_submission_log l
                join assignments a on a.id=l.assignment_id
                join users u on u.id=l.student_id
                left join users actor on actor.id=l.actor_id
                where l.class_id=? and l.deleted_at is null
                """);
        List<Object> args = new ArrayList<>(List.of(classId));
        if (studentId != null) {
            sql.append(" and l.student_id=?");
            args.add(studentId);
        }
        sql.append(" order by l.created_at desc limit ?");
        args.add(size);
        return ApiResponse.ok("Nhật ký nộp bài", jdbc.queryForList(sql.toString(), args.toArray()));
    }

    // ==================== Phân quyền ====================

    private void requireTeacher(Long classId) {
        guard.requireTeacher(classId);
    }

    /** Giáo viên phụ trách, admin, hoặc học sinh đang học lớp đó đều xem được nội dung lớp. */
    private void requireMember(Long classId) {
        guard.requireMember(classId);
    }

    public record CurriculumRequest(@NotNull(message = "Thiếu mục chuyên đề") Long taxonomyNodeId, String note) {}

    public record ClassDocumentRequest(@NotNull(message = "Thiếu tài liệu") Long documentId,
                                       ClassRequirement requirement, String note) {}

    public record ClassDocumentUpdateRequest(ClassRequirement requirement, String note) {}
}
