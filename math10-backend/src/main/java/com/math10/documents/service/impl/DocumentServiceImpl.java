package com.math10.documents.service.impl;

import com.math10.audit.service.AuditService;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.classes.repository.ClassDocumentRepository;
import com.math10.common.entity.ContentGroup;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.documents.dto.ContentGroupCounts;
import com.math10.configuration.security.CurrentUserService;
import com.math10.configuration.security.SecurityService;
import com.math10.documents.dto.DocumentOpenResponse;
import com.math10.documents.dto.DocumentResponse;
import com.math10.documents.dto.DocumentUpdateRequest;
import com.math10.documents.dto.LessonDocumentProgressResponse;
import com.math10.documents.dto.LessonDocumentQuestionRequest;
import com.math10.documents.dto.LessonDocumentQuestionResponse;
import com.math10.documents.dto.LessonDocumentQuizSubmitRequest;
import com.math10.documents.dto.LessonDocumentRequest;
import com.math10.documents.dto.LessonDocumentResponse;
import com.math10.documents.dto.LessonDocumentStudyRequest;
import com.math10.documents.dto.LessonDocumentUpdateRequest;
import com.math10.documents.dto.TextbookDetailResponse;
import com.math10.documents.dto.TextbookListResponse;
import com.math10.documents.dto.TextbookOpenResponse;
import com.math10.documents.entity.Document;
import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentPageMapping;
import com.math10.documents.entity.DocumentStatus;
import com.math10.documents.entity.DocumentType;
import com.math10.documents.entity.LessonDocument;
import com.math10.documents.entity.LessonDocumentProgress;
import com.math10.documents.entity.LessonDocumentQuestion;
import com.math10.documents.repository.DocumentPageMappingRepository;
import com.math10.documents.repository.DocumentRepository;
import com.math10.documents.repository.LessonDocumentProgressRepository;
import com.math10.documents.repository.LessonDocumentQuestionRepository;
import com.math10.documents.repository.LessonDocumentRepository;
import com.math10.documents.service.DocumentService;
import com.math10.documents.support.DocumentUrls;
import com.math10.common.storage.StorageService;
import com.math10.common.storage.StorageUrlSupport;
import com.math10.documents.service.PdfMarkdownService;
import com.math10.documents.service.PdfThumbnailService;
import com.math10.enrollments.entity.ClassStudent;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.lessons.entity.Lesson;
import java.io.IOException;
import com.math10.lessons.repository.LessonRepository;
import com.math10.subjects.entity.Subject;
import com.math10.subjects.repository.SubjectRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentServiceImpl implements DocumentService {

    private static final Set<String> ALLOWED_MIME_TYPES = Set.of(
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword"
    );
    private static final Set<String> ANSWERS = Set.of("A", "B", "C", "D");
    private static final List<DocumentType> TEXTBOOK_TYPES = List.of(DocumentType.SGK, DocumentType.SBT);
    private static final List<DocumentType> MATERIALS_EXCLUDED_TYPES =
            List.of(DocumentType.SGK, DocumentType.SBT, DocumentType.DE_THI);

    private final DocumentRepository documents;
    private final LessonDocumentRepository lessonDocuments;
    private final LessonDocumentQuestionRepository lessonDocumentQuestions;
    private final LessonDocumentProgressRepository lessonDocumentProgress;
    private final DocumentPageMappingRepository pageMappings;
    private final LessonRepository lessons;
    private final ClassDocumentRepository classDocuments;
    private final ClassStudentRepository classStudents;
    private final ChapterRepository chapters;
    private final SubjectRepository subjects;
    private final SecurityService securityService;
    private final CurrentUserService currentUserService;
    private final StorageService storageService;
    private final StorageUrlSupport storageUrls;
    private final PdfThumbnailService pdfThumbnailService;
    private final PdfMarkdownService pdfMarkdownService;
    private final AuditService audit;

    /**
     * Ghi nhật ký ngay tại tầng nghiệp vụ chứ không ở controller: cùng một phép đổi trạng thái
     * được gọi từ cả {@code AdminDocumentController} lẫn {@code TeacherDocumentController}, đặt ở
     * đây thì không có đường nào lọt.
     */
    private void ghiTrangThai(String action, Document doc, DocumentStatus truoc) {
        audit.record(action, "DOCUMENT", doc.getId(),
                "status=%s".formatted(truoc), "status=%s".formatted(doc.getStatus()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponse> listDocuments() {
        if ("TEACHER".equals(currentUserService.requireRoleCode())) {
            return documents.findLibraryForTeacher(currentUserService.requireUserId()).stream().map(this::map).toList();
        }
        // ADMIN chỉ quản lý kho tài liệu chung (ownerId=null); tài liệu riêng của giáo viên
        // thuộc phạm vi quản lý của chính giáo viên đó, không hiển thị lẫn ở đây.
        return documents.findByOwnerIdIsNullOrderByCreatedAtDesc().stream().map(this::map).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponse> listStudentDocuments() {
        return documents.findStudentVisibleDocuments(MATERIALS_EXCLUDED_TYPES).stream().map(this::map).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponse> listStudentExamDocuments() {
        return documents.findByDocTypeAndAudienceAndStatusNotOrderByCreatedAtDesc(
                        DocumentType.DE_THI, DocumentAudience.STUDENT_ALLOWED, DocumentStatus.HIDDEN)
                .stream().map(this::map).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponse> listMyDocuments() {
        return documents.findByOwnerIdOrderByCreatedAtDesc(currentUserService.requireUserId()).stream()
                .map(this::map)
                .toList();
    }

    @Override
    @Transactional
    public DocumentResponse upload(String title, DocumentType docType, DocumentAudience audience, Long gradeId, Long taxonomyNodeId, MultipartFile file, String videoUrl) {
        return uploadDocument(title, docType, audience, gradeId, null, taxonomyNodeId, file, videoUrl, null);
    }

    @Override
    @Transactional(readOnly = true)
    public List<DocumentResponse> listByTaxonomyNode(Long taxonomyNodeId) {
        return documents.findByTaxonomyNodeIdOrderByCreatedAtDesc(taxonomyNodeId).stream().map(this::map).toList();
    }

    @Override
    @Transactional
    public DocumentResponse attachToTaxonomyNode(Long documentId, Long taxonomyNodeId) {
        Document document = document(documentId);
        if (document.getOwnerId() != null) {
            throw new AccessDeniedException("Đây là tài liệu riêng của giáo viên, Admin không thể gắn vào cây phân loại");
        }
        document.setTaxonomyNodeId(taxonomyNodeId);
        return map(documents.save(document));
    }

    /**
     * Gán hoặc gỡ nhóm nội dung. {@code null} là "gỡ phân loại", nói ra bằng một lời gọi riêng.
     *
     * <p>Không nhét trường này vào {@code updateDocument}: thân PUT hiện chỉ mang tên/loại/phạm vi,
     * nên mỗi lần Admin đổi tên tài liệu là nhóm nội dung nhận null và bay mất — mất dữ liệu vì một
     * trường không được gửi lên. Đường đi riêng thì gỡ chỉ xảy ra khi có người thật sự bấm gỡ.
     */
    @Override
    @Transactional
    public DocumentResponse setContentGroup(Long documentId, ContentGroup contentGroup) {
        Document document = document(documentId);
        if (document.getOwnerId() != null) {
            throw new AccessDeniedException("Đây là tài liệu riêng của giáo viên, Admin không phân loại hộ được");
        }
        document.setContentGroup(contentGroup);
        return map(documents.save(document));
    }

    @Override
    @Transactional(readOnly = true)
    public ContentGroupCounts countsByContentGroup() {
        List<DocumentResponse> rows = listDocuments();
        Map<ContentGroup, Long> theoNhom = new HashMap<>();
        // Nêu đủ bốn nhóm kể cả nhóm rỗng: bộ lọc thiếu hẳn một dòng thì trông như nhóm đó không
        // tồn tại, còn "Kiểm tra 0" nói đúng rằng chưa ai xếp tài liệu nào vào đó.
        for (ContentGroup group : ContentGroup.values()) {
            theoNhom.put(group, rows.stream().filter(row -> row.contentGroup() == group).count());
        }
        return new ContentGroupCounts(theoNhom, rows.stream().filter(row -> row.contentGroup() == null).count());
    }

    @Override
    @Transactional(readOnly = true)
    public Map<Long, Integer> countsByTaxonomyNode() {
        Map<Long, Integer> counts = new HashMap<>();
        for (Object[] row : documents.countGroupedByTaxonomyNode()) {
            counts.put((Long) row[0], ((Number) row[1]).intValue());
        }
        return counts;
    }

    @Override
    @Transactional
    public DocumentResponse uploadMyDocument(String title, DocumentType docType, DocumentAudience audience, Long gradeId, Long chapterId, MultipartFile file, String videoUrl) {
        if (TEXTBOOK_TYPES.contains(docType)) {
            throw new BusinessException("Sách giáo khoa và sách bài tập do Admin quản lý");
        }
        return uploadDocument(title, docType, audience, gradeId, chapterId, null, file, videoUrl, currentUserService.requireUserId());
    }

    private DocumentResponse uploadDocument(String title, DocumentType docType, DocumentAudience audience, Long gradeId, Long chapterId, Long taxonomyNodeId, MultipartFile file, String videoUrl, Long ownerId) {
        String fileUrl;
        String thumbnailUrl = null;
        String resolvedTitle;

        if (docType == DocumentType.VIDEO) {
            if (videoUrl == null || videoUrl.isBlank() || !videoUrl.trim().matches("(?i)^https://(www\\.|m\\.|music\\.)?youtube\\.com/(watch\\?[^#]*v=[A-Za-z0-9_-]{11}.*|(?:embed|shorts|live)/[A-Za-z0-9_-]{11}.*)$|^https://youtu\\.be/[A-Za-z0-9_-]{11}.*$")) {
                throw new BusinessException("Link YouTube không hợp lệ. Hãy dùng link youtube.com hoặc youtu.be");
            }
            fileUrl = videoUrl.trim();
            resolvedTitle = title == null || title.isBlank() ? "Video" : title.trim();
        } else {
            if (file == null || file.isEmpty() || file.getOriginalFilename() == null) {
                throw new BusinessException("File tài liệu là bắt buộc");
            }
            String mime = Optional.ofNullable(file.getContentType()).orElse("application/octet-stream");
            if (!ALLOWED_MIME_TYPES.contains(mime)) {
                throw new BusinessException("Chỉ hỗ trợ PDF, DOC hoặc DOCX");
            }
            try {
                fileUrl = storageService.upload(file, "documents");
            } catch (IOException e) {
                throw new BusinessException("Upload thất bại: " + e.getMessage());
            }
            if ("application/pdf".equals(mime)) {
                try (var in = file.getInputStream()) {
                    byte[] png = pdfThumbnailService.renderFirstPagePng(in, 240);
                    thumbnailUrl = storageService.uploadBytes(png, "image/png", "math10-files/thumbnails", "png");
                } catch (Exception e) {
                    log.warn("Render thumbnail thất bại cho tài liệu {}: {}", title, e.getMessage());
                }
            }
            resolvedTitle = title == null || title.isBlank() ? file.getOriginalFilename() : title.trim();
        }

        Document document = new Document();
        document.setTitle(resolvedTitle);
        document.setDocType(docType);
        document.setAudience(audience);
        document.setGradeId(gradeId);
        document.setChapterId(chapterId);
        document.setTaxonomyNodeId(taxonomyNodeId);
        document.setOwnerId(ownerId);
        document.setFileUrl(fileUrl);
        document.setThumbnailUrl(thumbnailUrl);
        return map(documents.save(document));
    }

    @Override
    @Transactional
    public DocumentResponse updateMyDocument(Long id, DocumentUpdateRequest request) {
        Document document = ownedDocument(id);
        if (TEXTBOOK_TYPES.contains(request.docType())) {
            throw new BusinessException("Giáo viên không thể chuyển tài liệu thành sách giáo khoa");
        }
        document.setTitle(request.title().trim());
        document.setDocType(request.docType());
        document.setAudience(request.audience());
        document.setGradeId(request.gradeId());
        document.setChapterId(request.chapterId());
        return map(documents.save(document));
    }

    @Override
    @Transactional
    public DocumentResponse archiveMyDocument(Long id) {
        Document document = ownedDocument(id);
        DocumentStatus truoc = document.getStatus();
        document.setStatus(DocumentStatus.HIDDEN);
        DocumentResponse saved = map(documents.save(document));
        ghiTrangThai("ARCHIVE", document, truoc);
        return saved;
    }

    @Override
    @Transactional
    public DocumentResponse restoreMyDocument(Long id) {
        Document document = ownedDocument(id);
        DocumentStatus truoc = document.getStatus();
        document.setStatus(DocumentStatus.DRAFT);
        DocumentResponse saved = map(documents.save(document));
        ghiTrangThai("RESTORE", document, truoc);
        return saved;
    }

    private Document ownedDocument(Long id) {
        Document document = document(id);
        if (!currentUserService.requireUserId().equals(document.getOwnerId())) {
            throw new AccessDeniedException("Bạn không có quyền thay đổi tài liệu này");
        }
        return document;
    }

    @Override
    @Transactional
    public DocumentResponse updateDocument(Long id, DocumentUpdateRequest request) {
        Document document = document(id);
        if (document.getOwnerId() != null) {
            throw new AccessDeniedException("Đây là tài liệu riêng của giáo viên, Admin không thể chỉnh sửa");
        }
        document.setTitle(request.title().trim());
        document.setDocType(request.docType());
        document.setAudience(request.audience());
        document.setGradeId(request.gradeId());
        document.setChapterId(request.chapterId());
        if (request.subjectId() != null) {
            subject(request.subjectId());
            document.setSubject(subjects.getReferenceById(request.subjectId()));
        }
        if (request.status() != null) {
            document.setStatus(request.status());
        }
        if (request.totalPages() != null) {
            document.setTotalPages(request.totalPages());
        }
        if (request.basePageOffset() != null) {
            document.setBasePageOffset(request.basePageOffset());
        }
        return map(documents.save(document));
    }

    @Override
    @Transactional
    public void deleteDocument(Long id) {
        Document document = document(id);
        if (document.getOwnerId() != null) {
            throw new AccessDeniedException("Đây là tài liệu riêng của giáo viên, Admin không thể xóa");
        }
        audit.record("DELETE", "DOCUMENT", id,
                "title=%s,docType=%s,status=%s".formatted(document.getTitle(), document.getDocType(), document.getStatus()), null);
        document.markDeleted();
    }

    @Override
    @Transactional
    public DocumentResponse convertToMarkdown(Long id) {
        Document document = document(id);
        if (document.getOwnerId() != null) {
            throw new AccessDeniedException("Đây là tài liệu riêng của giáo viên, Admin không thể chuyển đổi");
        }
        if (document.getFileUrl() == null || !document.getFileUrl().toLowerCase(Locale.ROOT).endsWith(".pdf")) {
            throw new BusinessException("Chỉ hỗ trợ chuyển đổi file PDF sang Markdown");
        }
        try {
            byte[] pdfBytes = storageService.readObject(storageUrls.objectKeyFor(document.getFileUrl()));
            String markdown = pdfMarkdownService.extractMarkdown(new java.io.ByteArrayInputStream(pdfBytes));
            document.setContentMarkdown(markdown);
            return map(documents.save(document));
        } catch (BusinessException e) {
            throw e;
        } catch (IOException e) {
            throw new BusinessException("Chuyển đổi Markdown thất bại: " + e.getMessage());
        }
    }

    /**
     * Lưu Markdown do phía Admin tạo ra — dùng cho PDF scan, khi trình duyệt đã OCR xong
     * và gửi kết quả lên. Backend không tự OCR nên chỉ nhận và lưu nội dung.
     */
    @Override
    @Transactional
    public DocumentResponse saveMarkdown(Long id, String markdown) {
        Document document = document(id);
        if (document.getOwnerId() != null) {
            throw new AccessDeniedException("Đây là tài liệu riêng của giáo viên, Admin không thể sửa nội dung");
        }
        String content = markdown == null ? "" : markdown.strip();
        if (content.isEmpty()) {
            throw new BusinessException("Nội dung Markdown trống, không có gì để lưu");
        }
        document.setContentMarkdown(content);
        return map(documents.save(document));
    }

    /**
     * Byte file cho trình xem trong app. Đây là <b>cửa duy nhất</b> tới file trên R2: API không
     * trả URL R2 ra ngoài nữa, nên guard dưới đây là thứ thực sự chặn người không có quyền.
     */
    @Override
    @Transactional(readOnly = true)
    public byte[] readDocumentBytes(Long id) {
        Document document = document(id);
        checkCanRead(document);
        return fileBytes(document);
    }

    /**
     * Ảnh bìa cũng đi qua backend: để bucket R2 chuyển sang private được mà bìa không mất.
     * Cùng guard với file gốc — bìa là trang đầu của chính tài liệu đó.
     */
    @Override
    @Transactional(readOnly = true)
    public byte[] readDocumentThumbnailBytes(Long id) {
        Document document = document(id);
        checkCanRead(document);
        if (document.getThumbnailUrl() == null || document.getThumbnailUrl().isBlank()) {
            throw new ResourceNotFoundException("Tài liệu này chưa có ảnh bìa");
        }
        return storageService.readObject(storageUrls.objectKeyFor(document.getThumbnailUrl()));
    }

    /** Quyền đọc file phải khớp đúng quyền nhìn thấy tài liệu trong danh sách, không rộng hơn. */
    private void checkCanRead(Document document) {
        String role = currentUserService.requireRoleCode();
        if ("ADMIN".equals(role)) {
            return;
        }
        if ("TEACHER".equals(role)) {
            // Đúng điều kiện của findLibraryForTeacher: tài liệu của chính mình, hoặc kho chung
            // chưa bị ẩn. Thiếu vế này thì giáo viên A đoán id là đọc được tài liệu riêng của B.
            Long ownerId = document.getOwnerId();
            boolean mine = ownerId != null && ownerId.equals(currentUserService.requireUserId());
            if (!mine && !(ownerId == null && document.getStatus() != DocumentStatus.HIDDEN)) {
                throw new AccessDeniedException("Bạn không có quyền mở tài liệu này");
            }
            return;
        }
        // Học sinh: hai đường đọc hợp lệ — tài liệu vốn đã mở cho học sinh (đúng điều kiện của
        // findStudentVisibleDocuments), hoặc tài liệu giáo viên gắn vào lớp em đó học.
        // Tài liệu bị ẩn thì chặn ở cả hai đường; SGK/SBT còn phải đã xuất bản.
        boolean hidden = TEXTBOOK_TYPES.contains(document.getDocType())
                ? document.getStatus() != DocumentStatus.PUBLISHED
                : document.getStatus() == DocumentStatus.HIDDEN;
        if (hidden
                || (document.getAudience() != DocumentAudience.STUDENT_ALLOWED
                    && !attachedToStudentClass(document.getId()))) {
            throw new AccessDeniedException("Bạn không có quyền mở tài liệu này");
        }
    }

    /**
     * Tài liệu được gắn vào một lớp mà học sinh đang học thì em đó đọc được, kể cả khi
     * tài liệu gốc trong kho chung không đặt audience STUDENT_ALLOWED — quyền đến từ việc
     * giáo viên chủ động gắn nó vào lớp, không phải từ thuộc tính của tài liệu.
     */
    private boolean attachedToStudentClass(Long documentId) {
        List<Long> classIds = classStudents.findByStudentId(currentUserService.requireUserId())
                .stream().map(ClassStudent::getClassId).toList();
        return !classIds.isEmpty() && classDocuments.existsByDocumentIdAndClassIdIn(documentId, classIds);
    }

    /**
     * Byte PDF của tài liệu gắn trong bài học. Tài liệu ở đây không nhất thiết là
     * STUDENT_ALLOWED — học sinh được đọc vì đang học bài đó, nên dùng lại đúng guard của
     * {@link #openLessonDocument}. Khác {@code /open}, hàm này không ghi tiến độ để một
     * lần mở không bị đếm hai lượt.
     */
    @Override
    @Transactional(readOnly = true)
    public byte[] readLessonDocumentBytes(Long lessonId, Long id) {
        LessonDocument row = requireLessonDocument(lessonId, id);
        if ("STUDENT".equals(currentUserService.requireRoleCode())) {
            ensureStudentCanRead(lessonId, row);
        } else {
            checkLessonOwnership(lesson(lessonId));
        }
        return fileBytes(document(row.getDocumentId()));
    }

    private byte[] fileBytes(Document document) {
        if (document.getFileUrl() == null || document.getFileUrl().isBlank()) {
            throw new BusinessException("Tài liệu này không có file để xem");
        }
        return storageService.readObject(storageUrls.objectKeyFor(document.getFileUrl()));
    }

    @Override
    @Transactional(readOnly = true)
    public List<LessonDocumentResponse> listLessonDocuments(Long lessonId) {
        Lesson lesson = lesson(lessonId);
        String role = currentUserService.requireRoleCode();
        if ("STUDENT".equals(role)) {
            if (!lessons.studentCanAccess(lessonId, currentUserService.requireUserId())) {
                throw new AccessDeniedException("Bạn không có quyền xem tài liệu của bài học này");
            }
            return lessonDocuments.findByLessonIdOrderByDisplayOrderAsc(lesson.getId()).stream()
                    .map(row -> mapLessonDocument(row, false))
                    .filter(row -> row.audience() == DocumentAudience.STUDENT_ALLOWED)
                    .toList();
        }
        checkLessonOwnership(lesson);
        return lessonDocuments.findByLessonIdOrderByDisplayOrderAsc(lesson.getId()).stream()
                .map(this::mapLessonDocument)
                .toList();
    }

    @Override
    @Transactional
    public LessonDocumentResponse attachToLesson(Long lessonId, LessonDocumentRequest request) {
        Lesson lesson = lesson(lessonId);
        checkLessonOwnership(lesson);
        Document targetDocument = document(request.documentId());
        ensureDocumentAttachable(targetDocument);
        LessonDocument row = new LessonDocument();
        row.setLessonId(lessonId);
        row.setDocumentId(request.documentId());
        row.setRequired(request.required());
        row.setTeacherNote(request.teacherNote());
        row.setStartPage(normalizeStartPage(request.startPage()));
        row.setDisplayOrder(lessonDocuments.maxDisplayOrder(lessonId) + 1);
        return mapLessonDocument(lessonDocuments.save(row));
    }

    @Override
    @Transactional
    public LessonDocumentResponse updateLessonDocument(Long lessonId, Long id, LessonDocumentUpdateRequest request) {
        Lesson lesson = lesson(lessonId);
        checkLessonOwnership(lesson);
        LessonDocument row = requireLessonDocument(lessonId, id);
        row.setRequired(request.required());
        row.setTeacherNote(request.teacherNote());
        row.setStartPage(normalizeStartPage(request.startPage()));
        return mapLessonDocument(lessonDocuments.save(row));
    }

    @Override
    @Transactional
    public void removeLessonDocument(Long lessonId, Long id) {
        Lesson lesson = lesson(lessonId);
        checkLessonOwnership(lesson);
        requireLessonDocument(lessonId, id).markDeleted();
    }

    @Override
    @Transactional
    public LessonDocumentResponse move(Long lessonId, Long id, String direction) {
        Lesson lesson = lesson(lessonId);
        checkLessonOwnership(lesson);
        LessonDocument current = requireLessonDocument(lessonId, id);
        Optional<LessonDocument> swap = "UP".equals(direction)
                ? lessonDocuments.findFirstByLessonIdAndDisplayOrderLessThanOrderByDisplayOrderDesc(lessonId, current.getDisplayOrder())
                : lessonDocuments.findFirstByLessonIdAndDisplayOrderGreaterThanOrderByDisplayOrderAsc(lessonId, current.getDisplayOrder());
        if (swap.isEmpty()) {
            return mapLessonDocument(current);
        }
        LessonDocument other = swap.get();
        int currentOrder = current.getDisplayOrder();
        int otherOrder = other.getDisplayOrder();
        current.setDisplayOrder(-current.getId().intValue());
        lessonDocuments.saveAndFlush(current);
        other.setDisplayOrder(currentOrder);
        lessonDocuments.saveAndFlush(other);
        current.setDisplayOrder(otherOrder);
        lessonDocuments.saveAndFlush(current);
        return mapLessonDocument(current);
    }

    @Override
    @Transactional
    public DocumentOpenResponse openLessonDocument(Long lessonId, Long id) {
        Lesson lesson = lesson(lessonId);
        LessonDocument row = requireLessonDocument(lessonId, id);
        Document document = document(row.getDocumentId());
        String role = currentUserService.requireRoleCode();
        if ("STUDENT".equals(role)) {
            ensureStudentCanRead(lessonId, row);
            LessonDocumentProgress progress = findOrCreateDocumentProgress(id);
            LocalDateTime now = LocalDateTime.now();
            if (progress.getOpenedAt() == null) {
                progress.setOpenedAt(now);
            }
            progress.setLastOpenedAt(now);
            progress.setOpenCount(progress.getOpenCount() + 1);
            if (!"COMPLETED".equals(progress.getStatus())) {
                progress.setStatus("IN_PROGRESS");
            }
            lessonDocumentProgress.save(progress);
        } else {
            checkLessonOwnership(lesson);
        }
        return new DocumentOpenResponse(row.getId(), document.getTitle(), lessonContentUrl(row, document), row.getStartPage());
    }

    @Override
    @Transactional(readOnly = true)
    public List<LessonDocumentQuestionResponse> listQuestions(Long lessonId, Long lessonDocumentId) {
        LessonDocument row = requireLessonDocument(lessonId, lessonDocumentId);
        String role = currentUserService.requireRoleCode();
        if ("STUDENT".equals(role)) {
            ensureStudentCanRead(lessonId, row);
            return lessonDocumentQuestions.findByLessonDocumentIdOrderByDisplayOrderAsc(lessonDocumentId).stream()
                    .map(question -> mapQuestion(question, false))
                    .toList();
        }
        checkLessonOwnership(lesson(lessonId));
        return lessonDocumentQuestions.findByLessonDocumentIdOrderByDisplayOrderAsc(lessonDocumentId).stream()
                .map(question -> mapQuestion(question, true))
                .toList();
    }

    @Override
    @Transactional
    public LessonDocumentQuestionResponse addQuestion(Long lessonId, Long lessonDocumentId, LessonDocumentQuestionRequest request) {
        requireLessonDocument(lessonId, lessonDocumentId);
        checkLessonOwnership(lesson(lessonId));
        String correct = request.correctOption().trim().toUpperCase(Locale.ROOT);
        if (!ANSWERS.contains(correct)) {
            throw new BusinessException("Đáp án đúng phải là A, B, C hoặc D");
        }
        LessonDocumentQuestion question = new LessonDocumentQuestion();
        question.setLessonDocumentId(lessonDocumentId);
        question.setQuestionText(request.questionText().trim());
        question.setOptionA(request.optionA().trim());
        question.setOptionB(request.optionB().trim());
        question.setOptionC(request.optionC().trim());
        question.setOptionD(request.optionD().trim());
        question.setCorrectOption(correct);
        question.setExplanation(request.explanation());
        question.setDisplayOrder(lessonDocumentQuestions.maxDisplayOrder(lessonDocumentId) + 1);
        return mapQuestion(lessonDocumentQuestions.save(question), true);
    }

    @Override
    @Transactional
    public void deleteQuestion(Long lessonId, Long lessonDocumentId, Long questionId) {
        requireLessonDocument(lessonId, lessonDocumentId);
        checkLessonOwnership(lesson(lessonId));
        LessonDocumentQuestion question = lessonDocumentQuestions.findById(questionId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy câu hỏi"));
        if (!question.getLessonDocumentId().equals(lessonDocumentId)) {
            throw new AccessDeniedException("Câu hỏi không thuộc tài liệu này");
        }
        question.markDeleted();
    }

    @Override
    @Transactional
    public LessonDocumentProgressResponse recordStudy(Long lessonId, Long lessonDocumentId, LessonDocumentStudyRequest request) {
        LessonDocument row = requireLessonDocument(lessonId, lessonDocumentId);
        ensureStudentCanRead(lessonId, row);
        LessonDocumentProgress progress = findOrCreateDocumentProgress(lessonDocumentId);
        int seconds = Math.max(0, Math.min(300, request.seconds() == null ? 0 : request.seconds()));
        progress.setTotalSeconds(progress.getTotalSeconds() + seconds);
        if (!"COMPLETED".equals(progress.getStatus())) {
            progress.setStatus("IN_PROGRESS");
        }
        return mapProgress(lessonDocumentProgress.save(progress));
    }

    @Override
    @Transactional
    public LessonDocumentProgressResponse submitQuiz(Long lessonId, Long lessonDocumentId, LessonDocumentQuizSubmitRequest request) {
        LessonDocument row = requireLessonDocument(lessonId, lessonDocumentId);
        ensureStudentCanRead(lessonId, row);
        List<LessonDocumentQuestion> questions = lessonDocumentQuestions.findByLessonDocumentIdOrderByDisplayOrderAsc(lessonDocumentId);
        if (questions.isEmpty()) {
            throw new BusinessException("Tài liệu này chưa có câu hỏi kiểm tra");
        }
        Map<Long, String> answers = request.answers() == null ? Map.of() : request.answers();
        long correct = questions.stream()
                .filter(question -> question.getCorrectOption().equalsIgnoreCase(answers.getOrDefault(question.getId(), "")))
                .count();
        int score = Math.round((correct * 100f) / questions.size());
        LessonDocumentProgress progress = findOrCreateDocumentProgress(lessonDocumentId);
        progress.setQuizScore(score);
        if (score >= 70) {
            progress.setStatus("COMPLETED");
            progress.setCompletedAt(LocalDateTime.now());
        } else {
            progress.setStatus("NEEDS_REVIEW");
            progress.setCompletedAt(null);
        }
        return mapProgress(lessonDocumentProgress.save(progress));
    }

    // ==================== TEXTBOOK (SGK/SBT) ====================

    @Override
    @Transactional
    public TextbookListResponse uploadTextbook(String title, DocumentType docType, DocumentAudience audience,
                                              Long gradeId, Long subjectId, Integer basePageOffset, MultipartFile file) {
        if (file == null || file.isEmpty() || file.getOriginalFilename() == null) {
            throw new BusinessException("File tài liệu là bắt buộc");
        }
        String mime = Optional.ofNullable(file.getContentType()).orElse("application/octet-stream");
        if (!ALLOWED_MIME_TYPES.contains(mime)) {
            throw new BusinessException("Chỉ hỗ trợ PDF, DOC hoặc DOCX");
        }
        if (!TEXTBOOK_TYPES.contains(docType)) {
            throw new BusinessException("Chỉ SGK và SBT được phép upload qua luồng sách giáo khoa");
        }
        if (!"application/pdf".equals(mime)) {
            throw new BusinessException("Sách giáo khoa chỉ hỗ trợ file PDF");
        }
        long sizeMb = file.getSize() / (1024L * 1024L);
        if (sizeMb > 500) {
            throw new BusinessException("File vượt 500MB (hiện " + sizeMb + "MB). Vui lòng nén PDF hoặc chia thành nhiều phần.");
        }

        String fileUrl;
        String thumbnailUrl;
        try {
            fileUrl = storageService.upload(file, "textbooks");
        } catch (IOException e) {
            throw new BusinessException("Upload thất bại: " + e.getMessage());
        }
        try (var in = file.getInputStream()) {
            byte[] png = pdfThumbnailService.renderFirstPagePng(in, 240);
            thumbnailUrl = storageService.uploadBytes(png, "image/png", "math10-files/thumbnails", "png");
        } catch (Exception e) {
            log.warn("Render thumbnail thất bại cho sách {}: {}", title, e.getMessage());
            thumbnailUrl = null;
        }

        Document textbook = new Document();
        textbook.setTitle(title == null || title.isBlank() ? file.getOriginalFilename() : title.trim());
        textbook.setDocType(docType);
        textbook.setAudience(audience);
        textbook.setGradeId(gradeId);
        if (subjectId != null) {
            textbook.setSubject(subjects.getReferenceById(subjectId));
        }
        textbook.setStatus(DocumentStatus.PUBLISHED);
        textbook.setBasePageOffset(basePageOffset != null ? basePageOffset : 1);
        textbook.setFileUrl(fileUrl);
        textbook.setThumbnailUrl(thumbnailUrl);
        return mapTextbook(documents.save(textbook));
    }

    @Override
    @Transactional(readOnly = true)
    public List<TextbookListResponse> listTextbooks(Long gradeId, Long subjectId) {
        List<Document> results;
        if (gradeId != null && subjectId != null) {
            results = documents.findByDocTypeInAndStatusAndGradeIdAndSubjectIdOrderByCreatedAtDesc(
                    TEXTBOOK_TYPES, DocumentStatus.PUBLISHED, gradeId, subjectId);
        } else if (gradeId != null) {
            results = documents.findByDocTypeInAndStatusAndGradeIdOrderByCreatedAtDesc(
                    TEXTBOOK_TYPES, DocumentStatus.PUBLISHED, gradeId);
        } else if (subjectId != null) {
            results = documents.findByDocTypeInAndStatusAndSubjectIdOrderByCreatedAtDesc(
                    TEXTBOOK_TYPES, DocumentStatus.PUBLISHED, subjectId);
        } else {
            results = documents.findByDocTypeInAndStatusOrderByCreatedAtDesc(TEXTBOOK_TYPES, DocumentStatus.PUBLISHED);
        }
        return results.stream().map(this::mapTextbook).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<TextbookListResponse> listAllTextbooks() {
        return documents.findAllTextbooks(TEXTBOOK_TYPES).stream().map(this::mapTextbook).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public TextbookDetailResponse getTextbook(Long id) {
        Document doc = document(id);
        if (!TEXTBOOK_TYPES.contains(doc.getDocType())) {
            throw new ResourceNotFoundException("Không tìm thấy sách giáo khoa");
        }
        List<DocumentPageMapping> mappings = pageMappings.findByDocumentIdOrderByPdfPageNumberAsc(id);
        List<TextbookDetailResponse.PageMappingEntry> entries = mappings.stream()
                .map(m -> new TextbookDetailResponse.PageMappingEntry(
                        m.getPdfPageNumber(),
                        m.getBookPageLabel(),
                        m.getPageType() != null ? m.getPageType().name() : "CONTENT",
                        m.getChapterTitle(),
                        m.getLessonTitle()))
                .toList();
        return new TextbookDetailResponse(
                doc.getId(),
                doc.getTitle(),
                doc.getDocType().name(),
                doc.getAudience().name(),
                doc.getGradeId(),
                doc.getSubject() != null ? doc.getSubject().getId() : null,
                doc.getStatus().name(),
                doc.getTotalPages(),
                doc.getBasePageOffset(),
                contentUrl(doc),
                entries
        );
    }

    @Override
    @Transactional(readOnly = true)
    public TextbookOpenResponse openTextbook(Long id, Integer bookPage) {
        Document doc = document(id);
        if (!TEXTBOOK_TYPES.contains(doc.getDocType())) {
            throw new ResourceNotFoundException("Không tìm thấy sách giáo khoa");
        }
        if (doc.getStatus() != DocumentStatus.PUBLISHED) {
            throw new AccessDeniedException("Sách này chưa được xuất bản");
        }
        String role = currentUserService.requireRoleCode();
        if ("STUDENT".equals(role) && doc.getAudience() != DocumentAudience.STUDENT_ALLOWED) {
            throw new AccessDeniedException("Bạn không có quyền đọc sách này");
        }

        int pdfPage = resolvePdfPage(id, bookPage != null ? bookPage : 1, doc.getBasePageOffset());
        return new TextbookOpenResponse(doc.getId(), doc.getTitle(), contentUrl(doc), pdfPage, doc.getTotalPages());
    }

    @Override
    @Transactional
    public TextbookListResponse updateTextbook(Long id, DocumentUpdateRequest request) {
        Document doc = document(id);
        doc.setTitle(request.title().trim());
        doc.setDocType(request.docType());
        doc.setAudience(request.audience());
        doc.setGradeId(request.gradeId());
        if (request.subjectId() != null) {
            doc.setSubject(subjects.getReferenceById(request.subjectId()));
        }
        if (request.status() != null) {
            doc.setStatus(request.status());
        }
        if (request.totalPages() != null) {
            doc.setTotalPages(request.totalPages());
        }
        if (request.basePageOffset() != null) {
            doc.setBasePageOffset(request.basePageOffset());
        }
        return mapTextbook(documents.save(doc));
    }

    @Override
    @Transactional
    public TextbookListResponse setPageOffset(Long id, Integer pdfPageForBookPageOne) {
        Document doc = document(id);
        if (!TEXTBOOK_TYPES.contains(doc.getDocType())) {
            throw new ResourceNotFoundException("Không tìm thấy sách giáo khoa");
        }
        if (pdfPageForBookPageOne == null || pdfPageForBookPageOne < 1) {
            throw new BusinessException("PDF page cho trang sách 1 phải >= 1");
        }
        doc.setBasePageOffset(pdfPageForBookPageOne);
        return mapTextbook(documents.save(doc));
    }

    @Override
    @Transactional
    public TextbookListResponse publishTextbook(Long id) {
        Document doc = document(id);
        if (!TEXTBOOK_TYPES.contains(doc.getDocType())) {
            throw new ResourceNotFoundException("Không tìm thấy sách giáo khoa");
        }
        DocumentStatus truoc = doc.getStatus();
        doc.setStatus(DocumentStatus.PUBLISHED);
        TextbookListResponse saved = mapTextbook(documents.save(doc));
        ghiTrangThai("PUBLISH", doc, truoc);
        return saved;
    }

    @Override
    @Transactional
    public TextbookListResponse hideTextbook(Long id) {
        Document doc = document(id);
        if (!TEXTBOOK_TYPES.contains(doc.getDocType())) {
            throw new ResourceNotFoundException("Không tìm thấy sách giáo khoa");
        }
        DocumentStatus truoc = doc.getStatus();
        doc.setStatus(DocumentStatus.HIDDEN);
        TextbookListResponse saved = mapTextbook(documents.save(doc));
        ghiTrangThai("HIDE", doc, truoc);
        return saved;
    }

    @Override
    @Transactional
    public Map<String, Integer> backfillThumbnails() {
        List<Document> missing = documents.findByThumbnailUrlIsNull();
        int processed = 0;
        for (Document doc : missing) {
            if (doc.getFileUrl() == null || !doc.getFileUrl().toLowerCase().endsWith(".pdf")) {
                continue;
            }
            try {
                byte[] pdfBytes = storageService.readObject(storageUrls.objectKeyFor(doc.getFileUrl()));
                byte[] png = pdfThumbnailService.renderFirstPagePng(new java.io.ByteArrayInputStream(pdfBytes), 240);
                String thumbnailUrl = storageService.uploadBytes(png, "image/png", "math10-files/thumbnails", "png");
                doc.setThumbnailUrl(thumbnailUrl);
                documents.save(doc);
                processed++;
                log.info("Thumbnail backfill OK: doc={}", doc.getId());
            } catch (Exception e) {
                log.warn("Thumbnail backfill FAILED for doc {}: {}", doc.getId(), e.getMessage());
            }
        }
        log.info("Thumbnail backfill done: processed={}/total={}", processed, missing.size());
        return Map.of("processed", processed, "total", missing.size());
    }

    private int resolvePdfPage(Long documentId, int bookPage, int basePageOffset) {
        Optional<DocumentPageMapping> exactMapping = pageMappings.findByDocumentIdAndPdfPageNumber(
                documentId, basePageOffset + bookPage - 1);
        if (exactMapping.isPresent()) {
            return basePageOffset + bookPage - 1;
        }
        Optional<DocumentPageMapping> lastBefore = pageMappings.findLastMappingBeforePdfPage(
                documentId, basePageOffset + bookPage - 1);
        if (lastBefore.isPresent() && lastBefore.get().getPdfPageNumber() >= basePageOffset) {
            return basePageOffset + bookPage - 1;
        }
        return basePageOffset + bookPage - 1;
    }

    private Lesson lesson(Long id) {
        return lessons.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học"));
    }

    private Document document(Long id) {
        return documents.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu"));
    }

    private Subject subject(Long id) {
        return subjects.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy môn học"));
    }

    private LessonDocument requireLessonDocument(Long lessonId, Long id) {
        return lessonDocuments.findByIdAndLessonId(id, lessonId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu trong bài học"));
    }

    private void ensureDocumentAttachable(Document document) {
        if ("TEACHER".equals(currentUserService.requireRoleCode())) {
            Long ownerId = document.getOwnerId();
            if (ownerId != null && !ownerId.equals(currentUserService.requireUserId())) {
                throw new AccessDeniedException("Chỉ được gắn tài liệu dùng chung hoặc tài liệu của chính mình");
            }
        }
    }

    private void checkLessonOwnership(Lesson lesson) {
        var chapter = chapters.findById(lesson.getChapterId())
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương"));
        securityService.checkCourseOwnership(chapter.getCourseId());
    }

    private void ensureStudentCanRead(Long lessonId, LessonDocument row) {
        if (!lessons.studentCanAccess(lessonId, currentUserService.requireUserId())) {
            throw new AccessDeniedException("Bạn không có quyền xem tài liệu của bài học này");
        }
        if (document(row.getDocumentId()).getAudience() != DocumentAudience.STUDENT_ALLOWED) {
            throw new AccessDeniedException("Bạn không có quyền mở tài liệu này");
        }
    }

    private LessonDocumentProgress findOrCreateDocumentProgress(Long lessonDocumentId) {
        Long studentId = currentUserService.requireUserId();
        return lessonDocumentProgress.findByLessonDocumentIdAndStudentId(lessonDocumentId, studentId)
                .orElseGet(() -> {
                    LessonDocumentProgress progress = new LessonDocumentProgress();
                    LocalDateTime now = LocalDateTime.now();
                    progress.setLessonDocumentId(lessonDocumentId);
                    progress.setStudentId(studentId);
                    progress.setOpenedAt(now);
                    progress.setLastOpenedAt(now);
                    progress.setStatus("IN_PROGRESS");
                    return progress;
                });
    }

    private Integer normalizeStartPage(Integer startPage) {
        return startPage == null || startPage < 1 ? null : startPage;
    }

    /** @see DocumentUrls — API không trả URL R2 thô, mọi byte đi qua endpoint có xác thực. */
    private String contentUrl(Document document) {
        return DocumentUrls.contentUrl(document.getId(),
                document.getDocType() != null ? document.getDocType().name() : null,
                document.getFileUrl());
    }

    private String thumbnailUrl(Document document) {
        return DocumentUrls.thumbnailUrl(document.getId(), document.getThumbnailUrl());
    }

    private DocumentResponse map(Document document) {
        return new DocumentResponse(
                document.getId(),
                document.getTitle(),
                document.getDocType(),
                document.getAudience(),
                contentUrl(document),
                document.getGradeId(),
                document.getChapterId(),
                document.getStatus(),
                document.getSubject() != null ? document.getSubject().getId() : null,
                document.getTotalPages(),
                document.getBasePageOffset(),
                document.getCreatedAt(),
                thumbnailUrl(document),
                document.getFolderId(),
                document.getContentMarkdown(),
                document.getTaxonomyNodeId(),
                document.getContentGroup()
        );
    }

    private TextbookListResponse mapTextbook(Document document) {
        return new TextbookListResponse(
                document.getId(),
                document.getTitle(),
                document.getDocType(),
                document.getAudience(),
                document.getGradeId(),
                document.getSubject() != null ? document.getSubject().getId() : null,
                document.getStatus(),
                document.getTotalPages(),
                document.getBasePageOffset(),
                contentUrl(document),
                thumbnailUrl(document),
                document.getCreatedAt()
        );
    }

    private LessonDocumentResponse mapLessonDocument(LessonDocument row) {
        return mapLessonDocument(row, true);
    }

    /**
     * Tài liệu trong bài học đọc qua endpoint của bài học, vì quyền đến từ việc đang học bài đó
     * chứ không từ audience của tài liệu — dùng {@code /api/documents} sẽ chặn nhầm học sinh.
     */
    private String lessonContentUrl(LessonDocument row, Document document) {
        return DocumentUrls.lessonContentUrl(row.getLessonId(), row.getId(),
                document.getDocType() != null ? document.getDocType().name() : null,
                document.getFileUrl());
    }

    private LessonDocumentResponse mapLessonDocument(LessonDocument row, boolean exposeFileUrl) {
        Document document = document(row.getDocumentId());
        return new LessonDocumentResponse(
                row.getId(),
                row.getLessonId(),
                document.getId(),
                document.getTitle(),
                document.getDocType(),
                document.getAudience(),
                exposeFileUrl ? lessonContentUrl(row, document) : "",
                row.isRequired(),
                row.getTeacherNote(),
                row.getStartPage(),
                row.getDisplayOrder()
        );
    }

    private LessonDocumentQuestionResponse mapQuestion(LessonDocumentQuestion question, boolean exposeCorrectAnswer) {
        return new LessonDocumentQuestionResponse(
                question.getId(),
                question.getLessonDocumentId(),
                question.getQuestionText(),
                question.getOptionA(),
                question.getOptionB(),
                question.getOptionC(),
                question.getOptionD(),
                exposeCorrectAnswer ? question.getCorrectOption() : null,
                exposeCorrectAnswer ? question.getExplanation() : null,
                question.getDisplayOrder()
        );
    }

    private LessonDocumentProgressResponse mapProgress(LessonDocumentProgress progress) {
        return new LessonDocumentProgressResponse(
                progress.getId(),
                progress.getLessonDocumentId(),
                progress.getStudentId(),
                progress.getStatus(),
                progress.getOpenedAt(),
                progress.getLastOpenedAt(),
                progress.getOpenCount(),
                progress.getTotalSeconds(),
                progress.getQuizScore(),
                progress.getCompletedAt()
        );
    }
}
