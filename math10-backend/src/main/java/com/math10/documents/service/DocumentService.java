package com.math10.documents.service;

import com.math10.common.entity.ContentGroup;
import com.math10.documents.dto.ContentGroupCounts;
import com.math10.documents.dto.DocumentOpenResponse;
import com.math10.documents.dto.DocumentResponse;
import com.math10.documents.dto.DocumentUpdateRequest;
import com.math10.documents.dto.LessonDocumentProgressResponse;
import com.math10.documents.dto.LessonDocumentQuestionRequest;
import com.math10.documents.dto.LessonDocumentQuestionResponse;
import com.math10.documents.dto.LessonDocumentQuizSubmitRequest;
import com.math10.documents.dto.LessonDocumentRequest;
import com.math10.documents.dto.LessonDocumentStudyRequest;
import com.math10.documents.dto.LessonDocumentResponse;
import com.math10.documents.dto.LessonDocumentUpdateRequest;
import com.math10.documents.dto.TextbookDetailResponse;
import com.math10.documents.dto.TextbookListResponse;
import com.math10.documents.dto.TextbookOpenResponse;
import com.math10.documents.entity.DocumentAudience;
import com.math10.documents.entity.DocumentType;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

public interface DocumentService {
    List<DocumentResponse> listDocuments();
    List<DocumentResponse> listStudentDocuments();
    List<DocumentResponse> listStudentExamDocuments();
    DocumentResponse upload(String title, DocumentType docType, DocumentAudience audience, Long gradeId, Long taxonomyNodeId, MultipartFile file, String videoUrl);
    List<DocumentResponse> listByTaxonomyNode(Long taxonomyNodeId);
    DocumentResponse attachToTaxonomyNode(Long documentId, Long taxonomyNodeId);
    Map<Long, Integer> countsByTaxonomyNode();
    DocumentResponse setContentGroup(Long documentId, ContentGroup contentGroup);
    ContentGroupCounts countsByContentGroup();
    List<DocumentResponse> listMyDocuments();
    DocumentResponse uploadMyDocument(String title, DocumentType docType, DocumentAudience audience, Long gradeId, Long chapterId, MultipartFile file, String videoUrl);
    DocumentResponse updateMyDocument(Long id, DocumentUpdateRequest request);
    DocumentResponse archiveMyDocument(Long id);
    DocumentResponse restoreMyDocument(Long id);
    DocumentResponse updateDocument(Long id, DocumentUpdateRequest request);
    void deleteDocument(Long id);
    DocumentResponse convertToMarkdown(Long id);
    DocumentResponse saveMarkdown(Long id, String markdown);
    byte[] readDocumentBytes(Long id);
    byte[] readDocumentThumbnailBytes(Long id);
    byte[] readLessonDocumentBytes(Long lessonId, Long id);
    /** PDF để xem trong app: PDF trả nguyên, Word/Excel/PowerPoint đổi sang PDF. */
    byte[] readDocumentPreviewPdf(Long id);
    byte[] readLessonDocumentPreviewPdf(Long lessonId, Long id);
    /** Đường dẫn khởi chạy gói SCORM/xAPI (kèm token), sau khi kiểm quyền đọc. */
    String launchDocumentPackage(Long id);
    String launchLessonDocumentPackage(Long lessonId, Long id);
    List<LessonDocumentResponse> listLessonDocuments(Long lessonId);
    LessonDocumentResponse attachToLesson(Long lessonId, LessonDocumentRequest request);
    LessonDocumentResponse updateLessonDocument(Long lessonId, Long id, LessonDocumentUpdateRequest request);
    void removeLessonDocument(Long lessonId, Long id);
    LessonDocumentResponse move(Long lessonId, Long id, String direction);
    DocumentOpenResponse openLessonDocument(Long lessonId, Long id);
    List<LessonDocumentQuestionResponse> listQuestions(Long lessonId, Long lessonDocumentId);
    LessonDocumentQuestionResponse addQuestion(Long lessonId, Long lessonDocumentId, LessonDocumentQuestionRequest request);
    void deleteQuestion(Long lessonId, Long lessonDocumentId, Long questionId);
    LessonDocumentProgressResponse recordStudy(Long lessonId, Long lessonDocumentId, LessonDocumentStudyRequest request);
    LessonDocumentProgressResponse submitQuiz(Long lessonId, Long lessonDocumentId, LessonDocumentQuizSubmitRequest request);

    // --- Textbook (SGK/SBT) ---
    TextbookListResponse uploadTextbook(String title, DocumentType docType, DocumentAudience audience,
                                       Long gradeId, Long subjectId, Integer basePageOffset, MultipartFile file);
    List<TextbookListResponse> listTextbooks(Long gradeId, Long subjectId);
    List<TextbookListResponse> listAllTextbooks();
    TextbookDetailResponse getTextbook(Long id);
    TextbookOpenResponse openTextbook(Long id, Integer bookPage);
    TextbookListResponse updateTextbook(Long id, DocumentUpdateRequest request);
    TextbookListResponse publishTextbook(Long id);
    TextbookListResponse hideTextbook(Long id);

    Map<String, Integer> backfillThumbnails();
}
