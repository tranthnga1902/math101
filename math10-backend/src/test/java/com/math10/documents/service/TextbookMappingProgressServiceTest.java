package com.math10.documents.service;

import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.CurrentUserService;
import com.math10.documents.dto.TextbookMappingHistoryEntry;
import com.math10.documents.dto.TextbookMappingHistoryResponse;
import com.math10.documents.dto.TextbookMappingProgressRequest;
import com.math10.documents.dto.TextbookMappingProgressResponse;
import com.math10.documents.entity.Document;
import com.math10.documents.entity.DocumentStatus;
import com.math10.documents.entity.DocumentType;
import com.math10.documents.entity.MappingHistoryAction;
import com.math10.documents.entity.TextbookMappingHistory;
import com.math10.documents.entity.TextbookMappingProgress;
import com.math10.documents.repository.DocumentRepository;
import com.math10.documents.repository.TextbookMappingHistoryRepository;
import com.math10.documents.repository.TextbookMappingProgressRepository;
import com.math10.documents.service.impl.TextbookMappingProgressServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TextbookMappingProgressServiceTest {

    @Mock TextbookMappingProgressRepository progressRepo;
    @Mock TextbookMappingHistoryRepository historyRepo;
    @Mock DocumentRepository documentRepo;
    @Mock CurrentUserService currentUserService;

    TextbookMappingProgressServiceImpl service;
    Document textbook;

    @BeforeEach
    void setUp() {
        service = new TextbookMappingProgressServiceImpl(progressRepo, historyRepo, documentRepo, currentUserService);
        textbook = new Document();
        textbook.setId(100L);
        textbook.setDocType(DocumentType.SGK);
        textbook.setStatus(DocumentStatus.PUBLISHED);
        textbook.setBasePageOffset(1);
        textbook.setTotalPages(50);
    }

    @Test
    void returnsEmptyWhenNoProgressExists() {
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));
        when(progressRepo.findByUserIdAndDocumentId(7L, 100L)).thenReturn(Optional.empty());

        TextbookMappingProgressResponse resp = service.getProgress(100L);

        assertThat(resp.exists()).isFalse();
        assertThat(resp.documentId()).isEqualTo(100L);
        assertThat(resp.zoom()).isEqualTo(100);
    }

    @Test
    void savesProgressUpsertingExistingRow() {
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));

        TextbookMappingProgress existing = new TextbookMappingProgress();
        existing.setId(1L);
        existing.setUserId(7L);
        existing.setDocumentId(100L);
        existing.setPdfPage(5);
        existing.setPdfAnchor(5);
        existing.setBookAnchor(1);
        when(progressRepo.findByUserIdAndDocumentId(7L, 100L)).thenReturn(Optional.of(existing));
        when(progressRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));

        TextbookMappingProgressRequest req = new TextbookMappingProgressRequest(10, 10, 1, 120, 1);
        TextbookMappingProgressResponse resp = service.saveProgress(100L, req);

        assertThat(resp.exists()).isTrue();
        assertThat(resp.pdfPage()).isEqualTo(10);
        assertThat(resp.zoom()).isEqualTo(120);
        verify(progressRepo, times(1)).save(any(TextbookMappingProgress.class));
    }

    @Test
    void rejectsInvalidZoom() {
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));
        when(progressRepo.findByUserIdAndDocumentId(7L, 100L)).thenReturn(Optional.of(new TextbookMappingProgress()));

        TextbookMappingProgressRequest bad = new TextbookMappingProgressRequest(10, 10, 1, 200, 1);
        assertThatThrownBy(() -> service.saveProgress(100L, bad))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("zoom");
    }

    @Test
    void rejectsPdfPageExceedingTotal() {
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));
        when(progressRepo.findByUserIdAndDocumentId(7L, 100L)).thenReturn(Optional.of(new TextbookMappingProgress()));

        TextbookMappingProgressRequest bad = new TextbookMappingProgressRequest(999, 10, 1, 100, 1);
        assertThatThrownBy(() -> service.saveProgress(100L, bad))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void rejectsNonTextbookDocument() {
        Document wrong = new Document();
        wrong.setId(200L);
        wrong.setDocType(DocumentType.KHBD);
        wrong.setStatus(DocumentStatus.PUBLISHED);
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(200L)).thenReturn(Optional.of(wrong));

        assertThatThrownBy(() -> service.getProgress(200L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void appendsHistoryEntryAndTrimsRingBuffer() {
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));

        // mô phỏng đã có 100 entry → sẽ bị trim 1 entry cũ
        when(historyRepo.countByUserIdAndDocumentId(eq(7L), eq(100L))).thenReturn(101L);
        List<Long> oldestIds = new ArrayList<>();
        oldestIds.add(99L);
        when(historyRepo.findOldestIds(eq(7L), eq(100L), any(Pageable.class))).thenReturn(oldestIds);

        // sau khi trim, getHistory() sẽ trả danh sách gồm 100 entry (giả lập)
        List<TextbookMappingHistory> persisted = new ArrayList<>();
        for (int i = 0; i < 100; i++) {
            TextbookMappingHistory h = new TextbookMappingHistory();
            h.setId(1000L + i);
            h.setUserId(7L);
            h.setDocumentId(100L);
            h.setPdfPage(1 + i);
            h.setPdfAnchor(1);
            h.setBookAnchor(1);
            h.setAction(MappingHistoryAction.GOTO);
            h.setCreatedAt(LocalDateTime.now().minusMinutes(100 - i));
            persisted.add(h);
        }
        when(historyRepo.findStackOrdered(eq(7L), eq(100L), any(Pageable.class))).thenReturn(persisted);

        TextbookMappingHistoryResponse resp = service.appendHistory(100L, 50, 1, 1, "GOTO");

        ArgumentCaptor<TextbookMappingHistory> captor = ArgumentCaptor.forClass(TextbookMappingHistory.class);
        verify(historyRepo).save(captor.capture());
        assertThat(captor.getValue().getAction()).isEqualTo(MappingHistoryAction.GOTO);
        assertThat(captor.getValue().getPdfPage()).isEqualTo(50);

        // ring buffer đã cắt 1 entry
        verify(historyRepo, times(1)).deleteAllByIdInBatch(any());

        assertThat(resp.documentId()).isEqualTo(100L);
        assertThat(resp.entries()).hasSize(100);
    }

    @Test
    void appendsHistoryWithoutTrimmingWhenUnderLimit() {
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));
        when(historyRepo.countByUserIdAndDocumentId(eq(7L), eq(100L))).thenReturn(10L);
        when(historyRepo.findStackOrdered(eq(7L), eq(100L), any(Pageable.class))).thenReturn(new ArrayList<>());

        service.appendHistory(100L, 5, 1, 1, "PREV");

        verify(historyRepo, never()).deleteAllByIdInBatch(any());
    }

    @Test
    void rejectsInvalidActionLabel() {
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));

        assertThatThrownBy(() -> service.appendHistory(100L, 5, 1, 1, "INVALID"))
                .isInstanceOf(BusinessException.class);
    }

    @Test
    void findRelativeReturnsPrevEntry() {
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));

        TextbookMappingHistory a = entry(11L, 5);
        TextbookMappingHistory b = entry(22L, 9);
        TextbookMappingHistory c = entry(33L, 13);
        when(historyRepo.findStackOrdered(eq(7L), eq(100L), any(Pageable.class)))
                .thenReturn(List.of(a, b, c));

        TextbookMappingHistoryEntry prev = service.findRelative(100L, "PREV", 22L);
        assertThat(prev).isNotNull();
        assertThat(prev.pdfPage()).isEqualTo(5);

        TextbookMappingHistoryEntry next = service.findRelative(100L, "NEXT", 22L);
        assertThat(next).isNotNull();
        assertThat(next.pdfPage()).isEqualTo(13);

        TextbookMappingHistoryEntry none = service.findRelative(100L, "PREV", 11L);
        assertThat(none).isNull();

        TextbookMappingHistoryEntry alsoNone = service.findRelative(100L, "NEXT", 33L);
        assertThat(alsoNone).isNull();
    }

    @Test
    void rejectsHiddenTextbook() {
        textbook.setStatus(DocumentStatus.HIDDEN);
        when(currentUserService.requireUserId()).thenReturn(7L);
        when(documentRepo.findById(100L)).thenReturn(Optional.of(textbook));

        assertThatThrownBy(() -> service.getProgress(100L))
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("ẩn");
    }

    private TextbookMappingHistory entry(long id, int pdfPage) {
        TextbookMappingHistory row = new TextbookMappingHistory();
        row.setId(id);
        row.setUserId(7L);
        row.setDocumentId(100L);
        row.setPdfPage(pdfPage);
        row.setPdfAnchor(1);
        row.setBookAnchor(1);
        row.setAction(MappingHistoryAction.GOTO);
        row.setCreatedAt(LocalDateTime.now());
        return row;
    }
}
