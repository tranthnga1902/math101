package com.math10.documents.service.impl;

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
import com.math10.documents.service.TextbookMappingProgressService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class TextbookMappingProgressServiceImpl implements TextbookMappingProgressService {

    /** Ngưỡng ring buffer cho history: giữ tối đa 100 entry gần nhất mỗi (user, document). */
    static final int HISTORY_RING_LIMIT = 100;

    private final TextbookMappingProgressRepository progressRepo;
    private final TextbookMappingHistoryRepository historyRepo;
    private final DocumentRepository documents;
    private final CurrentUserService currentUserService;

    @Override
    @Transactional(readOnly = true)
    public TextbookMappingProgressResponse getProgress(Long documentId) {
        Long userId = currentUserService.requireUserId();
        validateTextbook(documentId);
        return progressRepo.findByUserIdAndDocumentId(userId, documentId)
                .map(this::toResponse)
                .orElseGet(() -> empty(documentId));
    }

    @Override
    @Transactional
    public TextbookMappingProgressResponse saveProgress(Long documentId, TextbookMappingProgressRequest request) {
        Long userId = currentUserService.requireUserId();
        Document doc = validateTextbook(documentId);
        validateInput(request, doc);

        TextbookMappingProgress row = progressRepo.findByUserIdAndDocumentId(userId, documentId)
                .orElseGet(() -> {
                    TextbookMappingProgress created = new TextbookMappingProgress();
                    created.setUserId(userId);
                    created.setDocumentId(documentId);
                    return created;
                });

        row.setPdfPage(request.pdfPage());
        row.setPdfAnchor(request.pdfAnchor());
        row.setBookAnchor(request.bookAnchor());
        row.setZoom(request.zoom() != null ? request.zoom() : 100);
        row.setThumbPage(request.thumbPage() != null ? request.thumbPage() : 1);
        TextbookMappingProgress saved = progressRepo.save(row);
        return toResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public TextbookMappingHistoryResponse getHistory(Long documentId) {
        Long userId = currentUserService.requireUserId();
        validateTextbook(documentId);
        // Lấy tối đa đúng ngưỡng ring buffer để client không bao giờ nhận quá nhiều.
        Pageable limit = PageRequest.of(0, HISTORY_RING_LIMIT);
        List<TextbookMappingHistory> rows = historyRepo.findStackOrdered(userId, documentId, limit);
        List<TextbookMappingHistoryEntry> entries = rows.stream().map(this::toEntry).toList();
        return new TextbookMappingHistoryResponse(documentId, entries, LocalDateTime.now());
    }

    @Override
    @Transactional
    public TextbookMappingHistoryResponse appendHistory(Long documentId, Integer pdfPage,
                                                        Integer pdfAnchor, Integer bookAnchor, String action) {
        Long userId = currentUserService.requireUserId();
        Document doc = validateTextbook(documentId);
        if (pdfPage == null || pdfPage < 1 || pdfPage > (doc.getTotalPages() != null ? doc.getTotalPages() : Integer.MAX_VALUE)) {
            throw new BusinessException("Trang PDF không hợp lệ");
        }
        MappingHistoryAction act;
        try {
            act = MappingHistoryAction.valueOf(action == null ? "GOTO" : action.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BusinessException("Hành động lịch sử không hợp lệ (chỉ GOTO|PREV|NEXT)");
        }

        TextbookMappingHistory row = new TextbookMappingHistory();
        row.setUserId(userId);
        row.setDocumentId(documentId);
        row.setPdfPage(pdfPage);
        row.setPdfAnchor(pdfAnchor == null ? 1 : pdfAnchor);
        row.setBookAnchor(bookAnchor == null ? 1 : bookAnchor);
        row.setAction(act);
        row.setCreatedAt(LocalDateTime.now());
        historyRepo.save(row);

        trimRingBuffer(userId, documentId);
        return getHistory(documentId);
    }

    @Override
    @Transactional(readOnly = true)
    public TextbookMappingHistoryEntry findRelative(Long documentId, String direction, Long currentHistoryId) {
        Long userId = currentUserService.requireUserId();
        validateTextbook(documentId);
        if (currentHistoryId == null) {
            throw new BusinessException("Thiếu currentHistoryId để tra cứu lịch sử tương đối");
        }
        Pageable limit = PageRequest.of(0, HISTORY_RING_LIMIT);
        List<TextbookMappingHistory> rows = historyRepo.findStackOrdered(userId, documentId, limit);
        for (int i = 0; i < rows.size(); i++) {
            if (!rows.get(i).getId().equals(currentHistoryId)) continue;
            int target = "PREV".equalsIgnoreCase(direction) ? i - 1 : i + 1;
            if (target < 0 || target >= rows.size()) return null;
            return toEntry(rows.get(target));
        }
        throw new ResourceNotFoundException("Không tìm thấy entry lịch sử");
    }

    // ============== helpers ==============

    private void trimRingBuffer(Long userId, Long documentId) {
        long total = historyRepo.countByUserIdAndDocumentId(userId, documentId);
        if (total <= HISTORY_RING_LIMIT) return;
        int excess = (int) (total - HISTORY_RING_LIMIT);
        Pageable slice = PageRequest.of(0, excess);
        List<Long> oldestIds = historyRepo.findOldestIds(userId, documentId, slice);
        if (!oldestIds.isEmpty()) {
            historyRepo.deleteAllByIdInBatch(new HashSet<>(oldestIds));
            log.debug("Trimmed {} history entries for user={} document={}", oldestIds.size(), userId, documentId);
        }
    }

    private Document validateTextbook(Long documentId) {
        Document doc = documents.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy tài liệu"));
        if (doc.getDocType() != DocumentType.SGK && doc.getDocType() != DocumentType.SBT) {
            throw new ResourceNotFoundException("Tài liệu này không phải sách giáo khoa");
        }
        if (doc.getStatus() == DocumentStatus.HIDDEN) {
            throw new BusinessException("Sách đang bị ẩn, không thể lưu tiến độ");
        }
        return doc;
    }

    private void validateInput(TextbookMappingProgressRequest request, Document doc) {
        if (request == null || request.pdfPage() == null || request.pdfAnchor() == null || request.bookAnchor() == null) {
            throw new BusinessException("Thiếu pdfPage/pdfAnchor/bookAnchor");
        }
        if (request.pdfPage() < 1) {
            throw new BusinessException("pdfPage phải >= 1");
        }
        if (request.pdfAnchor() < 1 || request.bookAnchor() < 1) {
            throw new BusinessException("Mốc trang phải >= 1");
        }
        if (doc.getTotalPages() != null && request.pdfPage() > doc.getTotalPages()) {
            throw new BusinessException("pdfPage vượt tổng số trang của sách");
        }
        int zoom = request.zoom() == null ? 100 : request.zoom();
        if (zoom < 60 || zoom > 150) {
            throw new BusinessException("zoom phải trong khoảng 60–150");
        }
    }

    private TextbookMappingProgressResponse toResponse(TextbookMappingProgress row) {
        return new TextbookMappingProgressResponse(
                row.getDocumentId(),
                row.getPdfPage(),
                row.getPdfAnchor(),
                row.getBookAnchor(),
                row.getZoom(),
                row.getThumbPage(),
                row.getUpdatedAt(),
                true
        );
    }

    private TextbookMappingProgressResponse empty(Long documentId) {
        return new TextbookMappingProgressResponse(
                documentId, null, null, null, 100, 1, null, false
        );
    }

    private TextbookMappingHistoryEntry toEntry(TextbookMappingHistory row) {
        return new TextbookMappingHistoryEntry(
                row.getId(),
                row.getPdfPage(),
                row.getPdfAnchor(),
                row.getBookAnchor(),
                row.getAction() != null ? row.getAction().name() : "GOTO",
                row.getCreatedAt()
        );
    }

}
