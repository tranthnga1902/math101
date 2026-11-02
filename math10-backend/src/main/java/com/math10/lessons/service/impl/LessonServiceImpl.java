package com.math10.lessons.service.impl;

import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.lessons.dto.LessonRequest;
import com.math10.lessons.dto.LessonResponse;
import com.math10.lessons.entity.Lesson;
import com.math10.lessons.repository.LessonRepository;
import com.math10.lessons.service.LessonService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.configuration.security.SecurityService;
import com.math10.programs.support.CatCanhCay;

@Service
@RequiredArgsConstructor
public class LessonServiceImpl implements LessonService {

    private final LessonRepository lessonRepository;
    private final ChapterRepository chapterRepository;
    private final SecurityService securityService;
    private final CatCanhCay catCanhCay;

    @Override
    @Transactional(readOnly = true)
    public List<LessonResponse> findByChapter(Long chapterId) {
        checkChapter(chapterId);
        return lessonRepository.findByChapterIdOrderByOrderIndexAsc(chapterId).stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LessonResponse findById(Long id) {
        Lesson lesson = lessonRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học: " + id));
        return toResponse(lesson);
    }

    @Override
    @Transactional(readOnly = true)
    public LessonResponse findPublishedByPublicCode(String publicCode) {
        Lesson lesson = lessonRepository.findByPublicCode(publicCode)
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài public: " + publicCode));
        // Xuất bản theo cả chương trình, không theo từng bài
        if (!chapterRepository.chuongTrinhDaXuatBan(lesson.getChapterId())) {
            throw new ResourceNotFoundException("Bài chưa được xuất bản");
        }
        return toResponse(lesson);
    }

    @Override
    @Transactional
    public LessonResponse create(LessonRequest request) {
        checkChapter(request.chapterId());
        ensurePublicCodeAvailable(normalizePublicCode(request.publicCode()));
        Lesson lesson = new Lesson();
        apply(request, lesson);
        return toResponse(lessonRepository.save(lesson));
    }

    @Override
    @Transactional
    public LessonResponse update(Long id, LessonRequest request) {
        Lesson lesson = findEntity(id);
        checkChapter(lesson.getChapterId());
        checkChapter(request.chapterId());
        String publicCode = normalizePublicCode(request.publicCode());
        if (publicCode != null && !publicCode.equals(lesson.getPublicCode())) {
            ensurePublicCodeAvailable(publicCode);
        }
        apply(request, lesson);
        return toResponse(lesson);
    }

    @Override
    @Transactional
    public void softDelete(Long id) {
        Lesson lesson = findEntity(id);
        checkChapter(lesson.getChapterId());
        catCanhCay.duoiBai(id);
        lesson.markDeleted();
    }

    /**
     * Đánh số lại thứ tự các bài trong <b>một</b> chương. Cùng lý do và cùng thứ tự kiểm như
     * {@code ChapterServiceImpl#reorder}: hỏi đủ ba câu — cùng cha, không lặp, không thiếu — rồi
     * mới ghi, để một lượt gọi sai không kịp đụng vào số thứ tự của ai.
     */
    @Override
    @Transactional
    public void reorder(ReorderRequest request) {
        List<Lesson> bai = request.ids().stream().map(this::findEntity).toList();
        if (bai.isEmpty()) {
            throw new BusinessException("Danh sách sắp xếp không được rỗng");
        }
        Long chuong = bai.get(0).getChapterId();
        if (bai.stream().anyMatch(x -> !chuong.equals(x.getChapterId()))) {
            throw new BusinessException("Chỉ sắp xếp được các bài trong cùng một chương");
        }
        checkChapter(chuong);

        Set<Long> gui = new LinkedHashSet<>(request.ids());
        if (gui.size() != request.ids().size()) {
            throw new BusinessException("Danh sách sắp xếp có id lặp lại");
        }
        long dangSong = lessonRepository.findByChapterIdOrderByOrderIndexAsc(chuong).size();
        if (dangSong != gui.size()) {
            throw new BusinessException("Phải gửi đủ %d bài của chương, đang thiếu %d"
                    .formatted(dangSong, dangSong - gui.size()));
        }

        for (int i = 0; i < bai.size(); i++) {
            bai.get(i).setOrderIndex(-(i + 1));
        }
        lessonRepository.flush();
        for (int i = 0; i < bai.size(); i++) {
            bai.get(i).setOrderIndex(i + 1);
        }
    }

    private Lesson findEntity(Long id) {
        return lessonRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy bài học: " + id));
    }
    private void checkChapter(Long chapterId){var chapter=chapterRepository.findById(chapterId).orElseThrow(()->new ResourceNotFoundException("Không tìm thấy chương: "+chapterId));securityService.checkCourseOwnership(chapter.getCourseId());}

    private String normalizePublicCode(String publicCode) {
        return publicCode == null || publicCode.isBlank() ? null : publicCode;
    }

    private void ensurePublicCodeAvailable(String publicCode) {
        if (publicCode != null && lessonRepository.existsByPublicCode(publicCode)) {
            throw new BusinessException("Public code đã tồn tại");
        }
    }

    private void apply(LessonRequest request, Lesson lesson) {
        lesson.setChapterId(request.chapterId());
        lesson.setTitle(request.title());
        lesson.setPublicCode(normalizePublicCode(request.publicCode()));
        lesson.setSummary(request.summary());
        lesson.setContentHtml(request.contentHtml());
        lesson.setOrderIndex(request.orderIndex());
        lesson.setStatus(request.status());
    }

    private LessonResponse toResponse(Lesson lesson) {
        return new LessonResponse(lesson.getId(), lesson.getChapterId(), lesson.getTitle(), lesson.getPublicCode(), lesson.getSummary(), lesson.getContentHtml(), lesson.getOrderIndex(), lesson.getStatus());
    }
}
