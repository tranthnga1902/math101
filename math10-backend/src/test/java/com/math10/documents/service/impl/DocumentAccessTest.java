package com.math10.documents.service.impl;

import com.math10.chapters.repository.ChapterRepository;
import com.math10.classes.repository.ClassDocumentRepository;
import com.math10.common.storage.StorageService;
import com.math10.common.storage.StorageUrlSupport;
import com.math10.configuration.security.CurrentUserService;
import com.math10.configuration.security.SecurityService;
import com.math10.documents.dto.DocumentResponse;
import com.math10.documents.entity.Document;
import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentStatus;
import com.math10.documents.entity.DocumentType;
import com.math10.documents.repository.DocumentPageMappingRepository;
import com.math10.documents.repository.DocumentRepository;
import com.math10.documents.repository.LessonDocumentProgressRepository;
import com.math10.documents.repository.LessonDocumentQuestionRepository;
import com.math10.documents.repository.LessonDocumentRepository;
import com.math10.documents.service.PdfMarkdownService;
import com.math10.documents.service.PdfThumbnailService;
import com.math10.enrollments.entity.ClassStudent;
import com.math10.enrollments.repository.ClassStudentRepository;
import com.math10.lessons.repository.LessonRepository;
import com.math10.subjects.repository.SubjectRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Ma trận quyền đọc file tài liệu.
 *
 * <p>Sau khi API thôi trả URL R2 thô, {@code readDocumentBytes} là <b>cửa duy nhất</b> tới file
 * trên R2 — nên đây là chỗ duy nhất chặn được người không có quyền. Mỗi ca "bị chặn" dưới đây
 * còn khẳng định thêm một điều: {@code storageService} không hề bị gọi, tức là không có byte nào
 * rời khỏi R2 trước khi guard chạy.
 *
 * <p>Điều kiện ở đây phải khớp <i>đúng</i> điều kiện của các truy vấn danh sách
 * ({@code findLibraryForTeacher}, {@code findStudentVisibleDocuments}) — rộng hơn là hở, hẹp hơn
 * là chặn nhầm người đang nhìn thấy tài liệu trong danh sách.
 */
@ExtendWith(MockitoExtension.class)
class DocumentAccessTest {

    private static final String R2_URL = "https://files.example.com/documents/abc-123.pdf";
    private static final String OBJECT_KEY = "documents/abc-123.pdf";
    private static final byte[] BYTES = "%PDF-1.7".getBytes();

    private static final long ME = 7L;
    private static final long GIAO_VIEN_KHAC = 8L;

    @Mock DocumentRepository documents;
    @Mock LessonDocumentRepository lessonDocuments;
    @Mock LessonDocumentQuestionRepository lessonDocumentQuestions;
    @Mock LessonDocumentProgressRepository lessonDocumentProgress;
    @Mock DocumentPageMappingRepository pageMappings;
    @Mock LessonRepository lessons;
    @Mock ClassDocumentRepository classDocuments;
    @Mock ClassStudentRepository classStudents;
    @Mock ChapterRepository chapters;
    @Mock SubjectRepository subjects;
    @Mock SecurityService securityService;
    @Mock CurrentUserService currentUserService;
    @Mock StorageService storageService;
    @Mock StorageUrlSupport storageUrls;
    @Mock PdfThumbnailService pdfThumbnailService;
    @Mock PdfMarkdownService pdfMarkdownService;

    @InjectMocks DocumentServiceImpl service;

    // --- ADMIN ---------------------------------------------------------------

    @Test
    void adminDocDuocCaTaiLieuRiengCuaGiaoVien() {
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.TEACHER_ONLY,
                DocumentStatus.HIDDEN, GIAO_VIEN_KHAC));
        asRole("ADMIN");
        stubStorage();

        assertThat(service.readDocumentBytes(1L)).isEqualTo(BYTES);
    }

    // --- TEACHER -------------------------------------------------------------

    @Test
    void giaoVienDocDuocTaiLieuCuaChinhMinh() {
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.TEACHER_ONLY,
                DocumentStatus.DRAFT, ME));
        asRole("TEACHER");
        when(currentUserService.requireUserId()).thenReturn(ME);
        stubStorage();

        assertThat(service.readDocumentBytes(1L)).isEqualTo(BYTES);
    }

    @Test
    void giaoVienKhongDocDuocTaiLieuRiengCuaGiaoVienKhac() {
        // IDOR: trước đây đoán id là đọc được file riêng của đồng nghiệp.
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.TEACHER_ONLY,
                DocumentStatus.PUBLISHED, GIAO_VIEN_KHAC));
        asRole("TEACHER");
        when(currentUserService.requireUserId()).thenReturn(ME);

        assertDenied(1L);
    }

    @Test
    void giaoVienDocDuocTaiLieuKhoChungChuaAn() {
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.TEACHER_ONLY,
                DocumentStatus.PUBLISHED, null));
        asRole("TEACHER");
        stubStorage();

        assertThat(service.readDocumentBytes(1L)).isEqualTo(BYTES);
    }

    @Test
    void giaoVienKhongDocDuocTaiLieuKhoChungDaAn() {
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.TEACHER_ONLY,
                DocumentStatus.HIDDEN, null));
        asRole("TEACHER");

        assertDenied(1L);
    }

    // --- STUDENT -------------------------------------------------------------

    @Test
    void hocSinhDocDuocTaiLieuDaMoChoHocSinh() {
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.STUDENT_ALLOWED,
                DocumentStatus.PUBLISHED, null));
        asRole("STUDENT");
        stubStorage();

        assertThat(service.readDocumentBytes(1L)).isEqualTo(BYTES);
    }

    @Test
    void hocSinhKhongDocDuocTaiLieuDaAn() {
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.STUDENT_ALLOWED,
                DocumentStatus.HIDDEN, null));
        asRole("STUDENT");

        assertDenied(1L);
    }

    @Test
    void hocSinhKhongDocDuocTaiLieuChiDanhChoGiaoVien() {
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.TEACHER_ONLY,
                DocumentStatus.PUBLISHED, null));
        asRole("STUDENT");
        when(currentUserService.requireUserId()).thenReturn(ME);
        when(classStudents.findByStudentId(ME)).thenReturn(List.of());

        assertDenied(1L);
    }

    @Test
    void hocSinhDocDuocTaiLieuGiaoVienGanVaoLopMinh() {
        // Quyền đến từ việc giáo viên chủ động gắn tài liệu vào lớp, không từ audience.
        stubDocument(doc(1L, DocumentType.KHBD, DocumentAudience.TEACHER_ONLY,
                DocumentStatus.PUBLISHED, GIAO_VIEN_KHAC));
        asRole("STUDENT");
        when(currentUserService.requireUserId()).thenReturn(ME);
        when(classStudents.findByStudentId(ME)).thenReturn(List.of(classStudent(21L)));
        when(classDocuments.existsByDocumentIdAndClassIdIn(1L, List.of(21L))).thenReturn(true);
        stubStorage();

        assertThat(service.readDocumentBytes(1L)).isEqualTo(BYTES);
    }

    @Test
    void hocSinhKhongDocDuocSgkChuaXuatBan() {
        // SGK/SBT khắt khe hơn: phải PUBLISHED, DRAFT cũng không được.
        stubDocument(doc(1L, DocumentType.SGK, DocumentAudience.STUDENT_ALLOWED,
                DocumentStatus.DRAFT, null));
        asRole("STUDENT");

        assertDenied(1L);
    }

    // --- Ảnh bìa -------------------------------------------------------------

    @Test
    void anhBiaDungCungGuardVoiFileGoc() {
        // Bìa là trang đầu của chính tài liệu đó — hở ở đây là hở luôn nội dung.
        Document document = doc(1L, DocumentType.KHBD, DocumentAudience.TEACHER_ONLY,
                DocumentStatus.PUBLISHED, null);
        document.setThumbnailUrl("https://files.example.com/thumbs/1.png");
        stubDocument(document);
        asRole("STUDENT");
        when(currentUserService.requireUserId()).thenReturn(ME);
        when(classStudents.findByStudentId(ME)).thenReturn(List.of());

        assertThatThrownBy(() -> service.readDocumentThumbnailBytes(1L))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(storageService);
    }

    // --- Không rò URL R2 ra danh sách ---------------------------------------

    @Test
    void danhSachTaiLieuHocSinhKhongLoUrlR2() {
        // Chặn tái phát: chỉ cần map() trả lại fileUrl thô là trình duyệt mở thẳng được,
        // và toàn bộ ma trận quyền ở trên thành vô nghĩa.
        when(documents.findStudentVisibleDocuments(anyList()))
                .thenReturn(List.of(doc(1L, DocumentType.KHBD, DocumentAudience.STUDENT_ALLOWED,
                        DocumentStatus.PUBLISHED, null)));

        List<DocumentResponse> rows = service.listStudentDocuments();

        assertThat(rows).singleElement()
                .satisfies(row -> assertThat(row.fileUrl()).isEqualTo("/api/documents/1/content.pdf"));
        assertThat(rows.get(0).fileUrl()).doesNotContain("files.example.com");
    }

    // --- helpers -------------------------------------------------------------

    private Document doc(Long id, DocumentType type, DocumentAudience audience,
                         DocumentStatus status, Long ownerId) {
        Document document = new Document();
        document.setId(id);
        document.setTitle("Tài liệu " + id);
        document.setDocType(type);
        document.setAudience(audience);
        document.setStatus(status);
        document.setOwnerId(ownerId);
        document.setFileUrl(R2_URL);
        return document;
    }

    private ClassStudent classStudent(Long classId) {
        ClassStudent row = new ClassStudent();
        row.setClassId(classId);
        row.setStudentId(ME);
        return row;
    }

    private void stubDocument(Document document) {
        when(documents.findById(document.getId())).thenReturn(Optional.of(document));
    }

    private void asRole(String role) {
        when(currentUserService.requireRoleCode()).thenReturn(role);
    }

    private void stubStorage() {
        when(storageUrls.objectKeyFor(R2_URL)).thenReturn(OBJECT_KEY);
        when(storageService.readObject(OBJECT_KEY)).thenReturn(BYTES);
    }

    /** Bị chặn thì không được có byte nào rời khỏi R2 — guard phải chạy trước khi đọc file. */
    private void assertDenied(Long documentId) {
        assertThatThrownBy(() -> service.readDocumentBytes(documentId))
                .isInstanceOf(AccessDeniedException.class);
        verifyNoInteractions(storageService);
    }
}
