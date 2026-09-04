package com.math10.chapters.service.impl;

import com.math10.chapters.dto.ChapterRequest;
import com.math10.chapters.dto.ChapterResponse;
import com.math10.chapters.entity.Chapter;
import com.math10.chapters.repository.ChapterRepository;
import com.math10.chapters.service.ChapterService;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.configuration.security.SecurityService;
import com.math10.courses.dto.request.ReorderRequest;
import com.math10.programs.support.CatCanhCay;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ChapterServiceImpl implements ChapterService {

    private final ChapterRepository chapterRepository;
    private final SecurityService securityService;
    private final CatCanhCay catCanhCay;

    @Override
    @Transactional(readOnly = true)
    public List<ChapterResponse> findByCourse(Long courseId) {
        securityService.checkCourseOwnership(courseId);
        return chapterRepository.findByCourseIdOrderByOrderIndexAsc(courseId).stream().map(this::toResponse).toList();
    }

    @Override
    @Transactional
    public ChapterResponse create(ChapterRequest request) {
        securityService.checkCourseOwnership(request.courseId());
        Chapter chapter = new Chapter();
        apply(request, chapter);
        return toResponse(chapterRepository.save(chapter));
    }

    @Override
    @Transactional
    public ChapterResponse update(Long id, ChapterRequest request) {
        Chapter chapter = findEntity(id);
        securityService.checkCourseOwnership(chapter.getCourseId());
        apply(request, chapter);
        return toResponse(chapter);
    }

    @Override
    @Transactional
    public void softDelete(Long id) {
        Chapter chapter = findEntity(id);
        securityService.checkCourseOwnership(chapter.getCourseId());
        catCanhCay.duoiChuong(id);
        chapter.markDeleted();
    }

    /**
     * Đánh số lại thứ tự các chương trong <b>một</b> chương trình.
     *
     * <p>Bản cũ nhận một danh sách id trần rồi đánh số 1..n bất kể chúng thuộc đâu: trộn id của hai
     * chương trình thì cả hai cùng bị đánh số lại, mà lượt gọi vẫn trả 200 và không nói gì. Danh
     * sách thiếu id thì đụng chỉ mục duy nhất và nổ ra 500, người gọi không biết mình gửi thiếu.
     *
     * <p>Nên ba câu hỏi phải trả lời <em>trước</em> khi ghi một dòng nào: cùng một cha không, có id
     * lặp không, đã đủ chưa. Kiểm xong mới tới hai lượt ghi — lượt âm để né chỉ mục duy nhất, lượt
     * dương để chốt số thật.
     */
    @Override
    @Transactional
    public void reorder(ReorderRequest request) {
        List<Chapter> chuong = request.ids().stream().map(this::findEntity).toList();
        if (chuong.isEmpty()) {
            throw new BusinessException("Danh sách sắp xếp không được rỗng");
        }
        Long chuongTrinh = chuong.get(0).getCourseId();
        if (chuong.stream().anyMatch(x -> !chuongTrinh.equals(x.getCourseId()))) {
            throw new BusinessException("Chỉ sắp xếp được các chương trong cùng một chương trình");
        }
        securityService.checkCourseOwnership(chuongTrinh);

        Set<Long> gui = new LinkedHashSet<>(request.ids());
        if (gui.size() != request.ids().size()) {
            throw new BusinessException("Danh sách sắp xếp có id lặp lại");
        }
        long dangSong = chapterRepository.findByCourseIdOrderByOrderIndexAsc(chuongTrinh).size();
        if (dangSong != gui.size()) {
            throw new BusinessException("Phải gửi đủ %d chương của chương trình, đang thiếu %d"
                    .formatted(dangSong, dangSong - gui.size()));
        }

        for (int i = 0; i < chuong.size(); i++) {
            chuong.get(i).setOrderIndex(-(i + 1));
        }
        chapterRepository.flush();
        for (int i = 0; i < chuong.size(); i++) {
            chuong.get(i).setOrderIndex(i + 1);
        }
    }

    private Chapter findEntity(Long id) {
        return chapterRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy chương: " + id));
    }

    private void apply(ChapterRequest request, Chapter chapter) {
        chapter.setCourseId(request.courseId());
        chapter.setTitle(request.title());
        chapter.setOrderIndex(request.orderIndex());
        chapter.setStatus(request.status());
    }

    private ChapterResponse toResponse(Chapter chapter) {
        return new ChapterResponse(chapter.getId(), chapter.getCourseId(), chapter.getTitle(), chapter.getOrderIndex(), chapter.getStatus());
    }
}
