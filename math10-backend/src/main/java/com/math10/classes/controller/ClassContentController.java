package com.math10.classes.controller;

import com.math10.assignments.domain.NguoiNhan;
import com.math10.audit.service.AuditService;
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
import com.math10.programs.support.LuongNoiDung;
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
    private final AuditService audit;
    private final LuongNoiDung luongNoiDung;

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

    @PatchMapping("/curriculum/{id}")
    @Transactional
    public ApiResponse<Void> updateCurriculum(@PathVariable Long classId, @PathVariable Long id,
                                              @RequestBody Map<String, Object> body) {
        requireTeacher(classId);
        ClassCurriculum row = curriculum.findByIdAndClassId(id, classId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mục chương trình học"));
        if (body.containsKey("note")) {
            row.setNote((String) body.get("note"));
        }
        if (body.containsKey("orderNo") && body.get("orderNo") instanceof Number n) {
            row.setOrderNo(n.intValue());
        }
        curriculum.save(row);
        return ApiResponse.ok("Đã cập nhật mục chương trình", null);
    }

    // ==================== Cấu trúc chương trình khóa học & Tài liệu đính kèm ====================

    /**
     * Cấu trúc chương trình học của khóa học được gán cho lớp, kèm tài liệu liên quan của từng bài học.
     * Trả về cây Khóa học -> Chương -> Bài học -> Danh sách tài liệu đính kèm.
     * Học sinh chỉ thấy tài liệu STUDENT_ALLOWED và PUBLISHED.
     */
    @GetMapping("/program-curriculum")
    public ApiResponse<Map<String, Object>> programCurriculum(@PathVariable Long classId) {
        requireMember(classId);
        String role = current.requireRoleCode();

        // 1. Tìm các khóa học được gán cho lớp
        List<Map<String, Object>> assignedCourses = jdbc.queryForList("""
                select ci.id as course_instance_id, ci.name as course_instance_name, ci.school_year, ci.status as instance_status,
                       coalesce(c.id, c2.id) as program_id,
                       coalesce(c.name, c2.name) as program_name,
                       coalesce(c.code, c2.code) as program_code,
                       pt.id as template_id, pt.name as template_name
                from class_courses cc
                join course_instances ci on ci.id = cc.course_instance_id and ci.deleted_at is null
                left join program_templates pt on pt.id = ci.template_id and pt.deleted_at is null
                left join courses c on c.id = pt.program_id and c.deleted_at is null
                left join courses c2 on c2.id = ci.course_id and c2.deleted_at is null
                where cc.class_id = ? and cc.deleted_at is null
                order by cc.created_at asc
                """, classId);

        List<Map<String, Object>> coursesList = new ArrayList<>();

        for (Map<String, Object> ac : assignedCourses) {
            Long programId = ac.get("program_id") != null ? ((Number) ac.get("program_id")).longValue() : null;
            if (programId == null) continue;

            // 2. Lấy danh sách chương của chương trình
            List<Map<String, Object>> chaptersRaw = jdbc.queryForList("""
                    select ch.id, ch.course_id, ch.title, ch.order_index, ch.status
                    from chapters ch
                    where ch.course_id = ? and ch.deleted_at is null
                    order by ch.order_index, ch.id
                    """, programId);

            List<Long> chapterIds = chaptersRaw.stream()
                    .map(ch -> ((Number) ch.get("id")).longValue())
                    .toList();

            // 3. Lấy danh sách bài học của các chương
            String chapterIdsIn = chapterIds.isEmpty() ? "-1" : chapterIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));
            List<Map<String, Object>> lessonsRaw = chapterIds.isEmpty() ? List.of() : jdbc.queryForList("""
                    select l.id, l.chapter_id, l.course_id, l.title, l.order_index, l.status,
                           l.total_periods, l.lesson_kind
                    from lessons l
                    where l.chapter_id in (%s)
                      and l.deleted_at is null
                    order by l.order_index, l.id
                    """.formatted(chapterIdsIn));

            List<Long> lessonIds = lessonsRaw.stream()
                    .map(l -> ((Number) l.get("id")).longValue())
                    .toList();

            String lessonIdsIn = lessonIds.isEmpty() ? "-1" : lessonIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));

            // 4. Lấy tài liệu đính kèm từ program_resources cho các bài học
            String roleFilter = "STUDENT".equals(role)
                    ? " and pr.audience='STUDENT_ALLOWED' and pr.status='PUBLISHED' and (d.id is null or (d.status='PUBLISHED' and d.audience='STUDENT_ALLOWED')) and (v.id is null or v.status='PUBLISHED')"
                    : "";

            String prSql = """
                    select pr.id, pr.resource_type, pr.resource_ref_id, pr.title, pr.audience, pr.status, pr.order_index,
                           pr.lesson_id, pr.noi_den_loai, pr.neo, pr.lop_id,
                           d.doc_type, d.file_url, d.file_asset_id, d.total_pages,
                           v.video_url, v.duration_seconds
                    from program_resources pr
                    left join documents d on pr.resource_type = 'DOCUMENT' and d.id = pr.resource_ref_id and d.deleted_at is null
                    left join videos v on pr.resource_type = 'VIDEO' and v.id = pr.resource_ref_id and v.deleted_at is null
                    where pr.deleted_at is null
                      and (pr.lop_id is null or pr.lop_id = ?)
                      and (
                        (pr.noi_den_loai = 'BAI' and pr.lesson_id in (%s))
                        or (pr.lesson_id in (%s))
                        or (pr.noi_den_loai = 'TIET' and exists (
                              select 1 from program_periods pp
                              where pp.id = pr.neo and pp.lesson_id in (%s) and pp.deleted_at is null))
                      )
                    """.formatted(lessonIdsIn, lessonIdsIn, lessonIdsIn) + roleFilter + """
                    order by pr.order_index, pr.id
                    """;

            List<Map<String, Object>> prResources = lessonIds.isEmpty() ? List.of() : jdbc.queryForList(prSql, classId);

            // 5. Lấy tài liệu đính kèm từ lesson_documents
            String ldRoleFilter = "STUDENT".equals(role) ? " and d.audience='STUDENT_ALLOWED' and d.status='PUBLISHED'" : "";
            String ldSql = """
                    select ld.id as ld_id, ld.lesson_id, ld.document_id, d.title, d.doc_type, d.audience, d.file_url,
                           ld.is_required as required, ld.teacher_note, ld.start_page, ld.display_order,
                           d.file_asset_id, d.total_pages
                    from lesson_documents ld
                    join documents d on d.id = ld.document_id and d.deleted_at is null
                    where ld.lesson_id in (%s) and ld.deleted_at is null
                    """.formatted(lessonIdsIn) + ldRoleFilter + """
                    order by ld.display_order, ld.id
                    """;
            List<Map<String, Object>> ldResources = lessonIds.isEmpty() ? List.of() : jdbc.queryForList(ldSql);

            // Gom tài liệu theo lessonId
            Map<Long, List<Map<String, Object>>> docsByLesson = new java.util.HashMap<>();
            java.util.Set<String> seenDocKeys = new java.util.HashSet<>();

            for (Map<String, Object> row : prResources) {
                Long lid = row.get("lesson_id") != null ? ((Number) row.get("lesson_id")).longValue() : null;
                if (lid == null && "TIET".equals(row.get("noi_den_loai")) && row.get("neo") != null) {
                    List<Long> pLids = jdbc.queryForList("select lesson_id from program_periods where id=? and deleted_at is null", Long.class, row.get("neo"));
                    if (!pLids.isEmpty()) lid = pLids.get(0);
                }
                if (lid == null) continue;

                String type = (String) row.get("resource_type");
                Object refId = row.get("resource_ref_id");
                String key = lid + ":" + type + ":" + refId;
                if (!seenDocKeys.add(key)) continue;

                Map<String, Object> doc = new java.util.LinkedHashMap<>();
                doc.put("id", row.get("id"));
                doc.put("resourceType", type);
                doc.put("resourceRefId", refId);
                doc.put("title", row.get("title"));
                doc.put("docType", "VIDEO".equals(type) ? "VIDEO" : row.get("doc_type"));
                doc.put("audience", row.get("audience"));
                doc.put("status", row.get("status"));
                doc.put("required", Boolean.FALSE);
                doc.put("totalPages", row.get("total_pages"));
                doc.put("isClassSpecific", row.get("lop_id") != null);

                if ("VIDEO".equals(type)) {
                    doc.put("fileUrl", row.get("video_url"));
                    doc.put("videoUrl", row.get("video_url"));
                    doc.put("durationSeconds", row.get("duration_seconds"));
                } else {
                    Object faId = row.get("file_asset_id");
                    String fUrl = (String) row.get("file_url");
                    if (faId != null) {
                        doc.put("fileUrl", "/api/files/" + faId + "/download");
                    } else if (fUrl != null && fUrl.startsWith("/api/documents/")) {
                        doc.put("fileUrl", "/api/program-resources/" + row.get("id") + "/content." + DocumentUrls.extensionOf(fUrl));
                    } else {
                        doc.put("fileUrl", fUrl);
                    }
                }
                docsByLesson.computeIfAbsent(lid, k -> new ArrayList<>()).add(doc);
            }

            for (Map<String, Object> row : ldResources) {
                Long lid = ((Number) row.get("lesson_id")).longValue();
                Object docId = row.get("document_id");
                String key = lid + ":DOCUMENT:" + docId;
                if (!seenDocKeys.add(key)) {
                    List<Map<String, Object>> existing = docsByLesson.get(lid);
                    if (existing != null) {
                        for (Map<String, Object> e : existing) {
                            if ("DOCUMENT".equals(e.get("resourceType")) && docId.equals(e.get("resourceRefId"))) {
                                if (row.get("required") != null) e.put("required", row.get("required"));
                                if (row.get("start_page") != null) e.put("startPage", row.get("start_page"));
                                if (row.get("teacher_note") != null) e.put("teacherNote", row.get("teacher_note"));
                            }
                        }
                    }
                    continue;
                }

                Map<String, Object> doc = new java.util.LinkedHashMap<>();
                doc.put("id", row.get("ld_id"));
                doc.put("resourceType", "DOCUMENT");
                doc.put("resourceRefId", docId);
                doc.put("title", row.get("title"));
                doc.put("docType", row.get("doc_type"));
                doc.put("audience", row.get("audience"));
                doc.put("required", row.get("required"));
                doc.put("startPage", row.get("start_page"));
                doc.put("teacherNote", row.get("teacher_note"));
                doc.put("totalPages", row.get("total_pages"));
                doc.put("isClassSpecific", false);

                Object faId = row.get("file_asset_id");
                String fUrl = (String) row.get("file_url");
                if (faId != null) {
                    doc.put("fileUrl", "/api/files/" + faId + "/download");
                } else if (fUrl != null && fUrl.startsWith("/api/documents/")) {
                    doc.put("fileUrl", DocumentUrls.contentUrl(((Number) docId).longValue(), (String) row.get("doc_type"), fUrl));
                } else {
                    doc.put("fileUrl", fUrl);
                }
                docsByLesson.computeIfAbsent(lid, k -> new ArrayList<>()).add(doc);
            }

            // 6. Tổ chức cây Chương -> Bài học -> Tài liệu
            List<Map<String, Object>> chaptersTree = new ArrayList<>();
            int totalDocsCount = 0;

            for (Map<String, Object> ch : chaptersRaw) {
                Long chId = ((Number) ch.get("id")).longValue();
                Map<String, Object> chapterNode = new java.util.LinkedHashMap<>();
                chapterNode.put("id", chId);
                chapterNode.put("courseId", ch.get("course_id"));
                chapterNode.put("title", ch.get("title"));
                chapterNode.put("orderIndex", ch.get("order_index"));
                chapterNode.put("status", ch.get("status"));

                List<Map<String, Object>> chapterLessons = new ArrayList<>();
                for (Map<String, Object> l : lessonsRaw) {
                    if (chId.equals(((Number) l.get("chapter_id")).longValue())) {
                        Long lid = ((Number) l.get("id")).longValue();
                        Map<String, Object> lessonNode = new java.util.LinkedHashMap<>(l);
                        lessonNode.put("chapterId", l.get("chapter_id"));
                        lessonNode.put("courseId", l.get("course_id"));
                        lessonNode.put("orderIndex", l.get("order_index"));
                        lessonNode.put("totalPeriods", l.get("total_periods"));
                        lessonNode.put("lessonKind", l.get("lesson_kind"));
                        List<Map<String, Object>> lDocs = docsByLesson.getOrDefault(lid, List.of());
                        lessonNode.put("documents", lDocs);
                        totalDocsCount += lDocs.size();
                        chapterLessons.add(lessonNode);
                    }
                }
                chapterNode.put("lessons", chapterLessons);
                chaptersTree.add(chapterNode);
            }

            // 7. Lấy tài liệu dùng chung toàn khóa (HE_THONG hoặc MACH)
            List<Map<String, Object>> commonDocs = jdbc.queryForList("""
                    select pr.id, pr.resource_type, pr.resource_ref_id, pr.title, pr.audience, pr.status, pr.order_index,
                           pr.noi_den_loai, pr.neo, pr.lop_id,
                           d.doc_type, d.file_url, d.file_asset_id, d.total_pages,
                           v.video_url, v.duration_seconds
                    from program_resources pr
                    left join documents d on pr.resource_type = 'DOCUMENT' and d.id = pr.resource_ref_id and d.deleted_at is null
                    left join videos v on pr.resource_type = 'VIDEO' and v.id = pr.resource_ref_id and v.deleted_at is null
                    where pr.deleted_at is null
                      and (pr.lop_id is null or pr.lop_id = ?)
                      and pr.noi_den_loai in ('HE_THONG', 'MACH')
                    """ + roleFilter + """
                    order by pr.order_index, pr.id
                    """, classId);

            List<Map<String, Object>> commonFormatted = new ArrayList<>();
            for (Map<String, Object> row : commonDocs) {
                String type = (String) row.get("resource_type");
                Object refId = row.get("resource_ref_id");
                Map<String, Object> doc = new java.util.LinkedHashMap<>();
                doc.put("id", row.get("id"));
                doc.put("resourceType", type);
                doc.put("resourceRefId", refId);
                doc.put("title", row.get("title"));
                doc.put("docType", "VIDEO".equals(type) ? "VIDEO" : row.get("doc_type"));
                doc.put("audience", row.get("audience"));
                doc.put("status", row.get("status"));
                doc.put("required", Boolean.FALSE);
                doc.put("totalPages", row.get("total_pages"));
                doc.put("isClassSpecific", row.get("lop_id") != null);
                if ("VIDEO".equals(type)) {
                    doc.put("fileUrl", row.get("video_url"));
                } else {
                    Object faId = row.get("file_asset_id");
                    String fUrl = (String) row.get("file_url");
                    if (faId != null) doc.put("fileUrl", "/api/files/" + faId + "/download");
                    else if (fUrl != null && fUrl.startsWith("/api/documents/"))
                        doc.put("fileUrl", "/api/program-resources/" + row.get("id") + "/content." + DocumentUrls.extensionOf(fUrl));
                    else doc.put("fileUrl", fUrl);
                }
                commonFormatted.add(doc);
            }

            Map<String, Object> courseObj = new java.util.LinkedHashMap<>(ac);
            courseObj.put("courseInstanceId", ac.get("course_instance_id"));
            courseObj.put("courseInstanceName", ac.get("course_instance_name"));
            courseObj.put("schoolYear", ac.get("school_year"));
            courseObj.put("instanceStatus", ac.get("instance_status"));
            courseObj.put("programId", ac.get("program_id"));
            courseObj.put("programName", ac.get("program_name"));
            courseObj.put("programCode", ac.get("program_code"));
            courseObj.put("templateId", ac.get("template_id"));
            courseObj.put("templateName", ac.get("template_name"));
            courseObj.put("totalChapters", chaptersTree.size());
            courseObj.put("totalLessons", lessonsRaw.size());
            courseObj.put("totalDocuments", totalDocsCount + commonFormatted.size());
            courseObj.put("chapters", chaptersTree);
            courseObj.put("commonDocuments", commonFormatted);

            coursesList.add(courseObj);
        }

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("classId", classId);
        response.put("courses", coursesList);
        return ApiResponse.ok("Chương trình học và tài liệu khóa học của lớp", response);
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

    /**
     * Gắn tài liệu vào lớp <em>chính là</em> việc cấp quyền đọc cho học sinh của lớp — đây là cơ
     * chế duy nhất mở tài liệu ra cho học sinh. Nên mọi lần gắn/gỡ đều phải để lại dấu vết, cùng
     * mức với thêm/bớt người trong lớp.
     */
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
        audit.record("ATTACH_DOCUMENT", "CLASS", classId, null,
                "documentId=%d,requirement=%s".formatted(request.documentId(), row.getRequirement()));
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
        String truoc = "documentId=%d,requirement=%s".formatted(row.getDocumentId(), row.getRequirement());
        if (request.requirement() != null) row.setRequirement(request.requirement());
        if (request.note() != null) row.setNote(request.note());
        classDocuments.save(row);
        audit.record("UPDATE_DOCUMENT", "CLASS", classId, truoc,
                "documentId=%d,requirement=%s".formatted(row.getDocumentId(), row.getRequirement()));
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
        audit.record("DETACH_DOCUMENT", "CLASS", classId,
                "documentId=%d,requirement=%s".formatted(row.getDocumentId(), row.getRequirement()), null);
        return ApiResponse.noContent("Đã bỏ tài liệu khỏi lớp");
    }

    // ==================== Học liệu (LuongNoiDung — resolver duy nhất) ====================

    /**
     * Học liệu của lớp, đi qua {@link LuongNoiDung#hocLieuChoBuoi}, không suy luận qua
     * {@code class_documents}. Không truyền {@code scheduleId} thì lấy học liệu chương trình của
     * khóa học đã gắn với lớp, không phụ thuộc lịch; truyền {@code scheduleId} thì chỉ khoanh đúng
     * tiết của buổi đó.
     *
     * <p>{@code fileUrl} trả ra trỏ tới {@code /api/files/{id}/download} — cửa tải đã gác bằng
     * {@link LuongNoiDung#moDuocTep}, chứ không phải {@code /api/documents/{id}/content} (gác
     * bằng {@code checkCanRead}, chưa biết gì về {@code lop_id} hẹp riêng của program_resources).
     * Trỏ nhầm cửa cũ thì tài liệu hẹp riêng cho lớp B sẽ mở được cho học sinh lớp A.
     */
    @GetMapping("/hoc-lieu")
    public ApiResponse<Map<String, Object>> hocLieu(@PathVariable Long classId,
                                                     @RequestParam(required = false) Long scheduleId) {
        requireMember(classId);
        if (scheduleId != null && jdbc.queryForObject(
                "select count(*) from class_schedule where id=? and class_id=? and deleted_at is null",
                Integer.class, scheduleId, classId) == 0) {
            throw new ResourceNotFoundException("Không tìm thấy buổi học trong lớp.");
        }
        List<Long> tietIds = scheduleId != null
                ? jdbc.queryForList("""
                        select u.program_period_id
                          from class_schedule cs
                          join course_delivery_session_units u on u.course_delivery_session_id = cs.course_delivery_session_id
                         where cs.id=? and cs.class_id=? and cs.deleted_at is null and u.deleted_at is null
                        """, Long.class, scheduleId, classId)
                : List.of();

        List<LuongNoiDung.MucHocLieu> ketQua = scheduleId == null
                ? luongNoiDung.hocLieuChoLop(classId, current.requireUserId(), current.requireRoleCode())
                : luongNoiDung.hocLieuChoBuoi(classId, tietIds, current.requireUserId(), current.requireRoleCode());

        Map<Long, Map<String, Object>> tepTheoTaiLieu = tepChoDocument(ketQua);
        List<Map<String, Object>> theoNoiDung = new ArrayList<>();
        List<Map<String, Object>> riengLop = new ArrayList<>();
        java.util.Set<String> seen = new java.util.HashSet<>();
        for (LuongNoiDung.MucHocLieu m : ketQua) {
            if (!seen.add(m.loaiNguon() + ":" + m.nguonId())) continue;
            Map<String, Object> row = new java.util.LinkedHashMap<>();
            row.put("id", m.id());
            row.put("loaiNguon", m.loaiNguon());
            row.put("nguonId", m.nguonId());
            row.put("tieuDe", m.tieuDe());
            row.put("thuTu", m.thuTu());
            row.put("chuongId", m.chuongId());
            row.put("chuongTen", m.chuongTen());
            row.put("chuongThuTu", m.chuongThuTu());
            row.put("baiId", m.baiId());
            row.put("baiTen", m.baiTen());
            row.put("baiThuTu", m.baiThuTu());
            if ("DOCUMENT".equals(m.loaiNguon())) {
                row.putAll(tepTheoTaiLieu.getOrDefault(m.nguonId(), Map.of()));
                String url=(String)row.get("fileUrl");
                if(url!=null && url.startsWith("/api/documents/")) {
                    row.put("fileUrl","/api/program-resources/"+m.id()+"/content."+DocumentUrls.extensionOf(url));
                }
            } else if ("VIDEO".equals(m.loaiNguon())) {
                List<String> urls = jdbc.queryForList(
                        "select video_url from videos where id=? and deleted_at is null", String.class, m.nguonId());
                row.put("fileUrl", urls.isEmpty() ? null : urls.get(0));
                row.put("docType", "VIDEO");
            }
            (m.riengLop() ? riengLop : theoNoiDung).add(row);
        }

        Map<String, Object> result = new java.util.LinkedHashMap<>();
        result.put("theoNoiDung", theoNoiDung);
        result.put("riengLop", riengLop);
        return ApiResponse.ok("Học liệu của lớp", result);
    }

    /** Đường mở file cho các mục loaiNguon=DOCUMENT — VIDEO thì trỏ thẳng link ngoài, còn lại qua cửa file đã gác quyền. */
    private Map<Long, Map<String, Object>> tepChoDocument(List<LuongNoiDung.MucHocLieu> ketQua) {
        List<Long> documentIds = ketQua.stream()
                .filter(m -> "DOCUMENT".equals(m.loaiNguon()))
                .map(LuongNoiDung.MucHocLieu::nguonId)
                .distinct().toList();
        if (documentIds.isEmpty()) return Map.of();
        List<Map<String, Object>> docs = jdbc.queryForList(
                "select id, doc_type, file_url, file_asset_id from documents where deleted_at is null and id in ("
                        + documentIds.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(","))
                        + ")");
        Map<Long, Map<String, Object>> ketQua2 = new java.util.HashMap<>();
        for (Map<String, Object> d : docs) {
            String docType = (String) d.get("doc_type");
            Object fileAssetId = d.get("file_asset_id");
            Map<String, Object> tep = new java.util.LinkedHashMap<>();
            tep.put("docType", docType);
            tep.put("fileUrl", "VIDEO".equals(docType) ? d.get("file_url")
                    : fileAssetId != null ? "/api/files/" + fileAssetId + "/download"
                    : DocumentUrls.contentUrl(((Number) d.get("id")).longValue(), docType, (String) d.get("file_url")));
            ketQua2.put(((Number) d.get("id")).longValue(), tep);
        }
        return ketQua2;
    }

    // ==================== Theo dõi ====================

    /**
     * Bảng theo dõi từng học sinh. Bắt buộc và tự chọn tách hẳn hai cột: phần bắt buộc cho ra
     * điểm trung bình, phần tự chọn chỉ đếm mức độ tự giác — không trộn vào điểm.
     *
     * <p>Điều kiện người nhận nằm trong <em>điều kiện nối</em> chứ không ở {@code where}: bài giao
     * riêng cho vài em không được tính vào mẫu số của những em khác, nhưng em chưa có bài nào vẫn
     * phải hiện ra trong bảng — đẩy xuống {@code where} là làm em ấy biến mất.
     *
     * <p>{@code counts_in_gradebook} chỉ chặn phần <em>điểm</em>: bài luyện tự do vẫn đếm vào số
     * bài đã làm, chỉ không kéo điểm trung bình.
     */
    @GetMapping("/progress")
    public ApiResponse<List<Map<String, Object>>> progress(@PathVariable Long classId) {
        requireTeacher(classId);
        return ApiResponse.ok("Theo dõi lớp", jdbc.queryForList("""
                select u.id student_id,u.full_name,u.username,
                       count(a.id) filter (where a.requirement='BAT_BUOC') required_total,
                       count(a.id) filter (where a.requirement='BAT_BUOC' and ap.submitted_at is not null) required_submitted,
                       round(avg(ap.score) filter (where a.requirement='BAT_BUOC' and ap.returned_at is not null
                                                     and a.counts_in_gradebook),2) required_avg_score,
                       count(a.id) filter (where a.requirement='TU_CHON') optional_total,
                       count(a.id) filter (where a.requirement='TU_CHON' and ap.submitted_at is not null) optional_submitted,
                       max(ap.submitted_at) last_submitted_at
                from class_students cs
                join users u on u.id=cs.student_id and u.deleted_at is null
                left join assignments a on a.class_id=cs.class_id and a.deleted_at is null
                                       and """ + NguoiNhan.NHAN_DUOC + """
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
