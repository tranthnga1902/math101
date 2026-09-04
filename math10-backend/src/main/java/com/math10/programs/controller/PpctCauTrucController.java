package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.entity.PublishStatus;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.programs.PpctCauTrucParser;
import com.math10.programs.PpctCauTrucParser.BaiHoc;
import com.math10.programs.PpctCauTrucParser.ChuongVaBai;
import com.math10.programs.PpctExtractor;
import com.math10.programs.PpctDocxReader;
import com.math10.programs.PpctSuyMach;
import com.math10.programs.PpctConfigLoader;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.*;

/**
 * Auto-import cấu trúc Chương → Bài từ file PPCT PDF.
 *
 * <p>Luồng 2 bước:
 * <ol>
 *   <li>{@code POST …/preview} — upload PDF, trả danh sách chương/bài đã parse để admin kiểm tra.</li>
 *   <li>{@code POST …/confirm} — admin gửi lại danh sách (có thể đã chỉnh), server upsert vào DB.</li>
 * </ol>
 *
 * <p><b>Upsert by title:</b> chapter upsert theo {@code (course_id, title trim)}, lesson upsert theo
 * {@code (chapter_id, title trim)}. Không xóa chapter/lesson cũ không có trong file —
 * import lại file đã sửa chỉ thêm/cập nhật, không phá dữ liệu đã có.
 *
 * <p>Không dùng {@code ChapterService}/{@code LessonService} để tránh {@code checkCourseOwnership}
 * kiểm TEACHER (import chỉ dành cho ADMIN), và để batch upsert không kích vào unique constraint
 * {@code uq_chapters_order} (reorder 2 lượt theo kiểu service là không cần thiết ở đây).
 */
@RestController
@RequiredArgsConstructor
@RequestMapping("/api/admin/programs/{programId}/cau-truc")
@PreAuthorize("hasRole('ADMIN')")
public class PpctCauTrucController {

    private final JdbcTemplate jdbc;
    private final PpctConfigLoader configLoader;

    // ==================== Preview ====================

    /**
     * Upload file PPCT (PDF, .docx, .xlsx, .xls) → trả preview chương/bài để admin kiểm tra.
     * Không ghi gì vào DB.
     */
    @PostMapping("/preview")
    public ApiResponse<List<ChuongVaBai>> preview(@PathVariable Long programId,
            @RequestParam("file") MultipartFile file) throws IOException {
        kiemTra(programId);
        if (file == null || file.isEmpty()) return ApiResponse.ok("File rỗng", List.of());

        String ten = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase(java.util.Locale.ROOT);
        byte[] bytes = file.getBytes();

        List<PpctExtractor.HangTho> hang;

        if (ten.endsWith(".pdf")) {
            hang = PpctExtractor.tach(bytes);
            if (hang.isEmpty()) {
                return ApiResponse.ok("Tệp không rút được bảng. Hãy dùng PDF gốc có chữ chọn được.", List.of());
            }
        } else if (ten.endsWith(".docx")) {
            try {
                List<com.math10.programs.dto.PpctDtos.Dong> dong = PpctDocxReader.doc(bytes);
                hang = dong.stream()
                        .map(d -> new PpctExtractor.HangTho(d.tuan(), d.soTiet(), d.tieuDe()))
                        .toList();
            } catch (BusinessException e) {
                return ApiResponse.ok(e.getMessage(), List.of());
            }
        } else if (ten.endsWith(".xlsx") || ten.endsWith(".xls")) {
            // .xlsx/.xls: PpctExcelReader trả List<Dong>; chuyển về HangTho
            try {
                List<com.math10.programs.dto.PpctDtos.Dong> dong = com.math10.programs.PpctExcelReader.doc(bytes);
                hang = dong.stream()
                        .map(d -> new PpctExtractor.HangTho(d.tuan(), d.soTiet(), d.tieuDe()))
                        .toList();
                if (hang.isEmpty()) return ApiResponse.ok("Không tìm thấy dữ liệu hợp lệ trong file Excel", List.of());
            } catch (com.math10.common.exception.BusinessException e) {
                return ApiResponse.ok(e.getMessage(), List.of());
            }
        } else {
            return ApiResponse.ok("Chỉ hỗ trợ file PPCT PDF, .docx, .xlsx hoặc .xls", List.of());
        }

        // Suy mạch từ từ khóa DB
        List<PpctSuyMach.TuKhoa> tuKhoa = configLoader.tuKhoa(programId).stream()
                .map(tk -> new PpctSuyMach.TuKhoa(tk.maMach(), tk.tuKhoa())).toList();
        List<PpctSuyMach.TietDoan> doan = PpctSuyMach.suy(hang, tuKhoa);

        List<String> maMachList = doan.stream().map(PpctSuyMach.TietDoan::maMach).toList();
        List<ChuongVaBai> cau = PpctCauTrucParser.phanTich(hang, maMachList);
        return ApiResponse.ok("Đã phân tích " + cau.size() + " chương", cau);
    }

    // ==================== Confirm ====================

    /**
     * Nhận danh sách chương/bài (có thể đã chỉnh sửa bởi admin), upsert vào {@code chapters}
     * và {@code lessons} theo khóa tiêu đề.
     */
    @PostMapping("/confirm")
    @Transactional
    public ApiResponse<Map<String, Object>> confirm(@PathVariable Long programId,
            @RequestBody List<ChuongVaBai> ds) {
        kiemTra(programId);
        if (ds == null || ds.isEmpty()) throw new BusinessException("Danh sách chương không được rỗng");

        int soTaoMoiChuong = 0, soCapNhatChuong = 0;
        int soTaoMoiBai = 0, soCapNhatBai = 0;

        for (ChuongVaBai c : ds) {
            String tenChuong = c.tenChuong().trim();
            if (tenChuong.isBlank()) continue;

            // Upsert chapter by (course_id, title)
            Long chapterId = upsertChapter(programId, tenChuong, c.thuTu());
            boolean laMoiChuong = chapterId < 0;
            chapterId = Math.abs(chapterId);
            if (laMoiChuong) soTaoMoiChuong++; else soCapNhatChuong++;

            // Upsert lessons
            if (c.bai() == null) continue;
            for (BaiHoc b : c.bai()) {
                String tenBai = b.tenBai().trim();
                if (tenBai.isBlank()) continue;
                boolean laMoiBai = upsertLesson(chapterId, tenBai, b.thuTu());
                if (laMoiBai) soTaoMoiBai++; else soCapNhatBai++;
            }
        }

        // Fix tất cả order_index âm (tạm thời trong upsert) về dương — cuối transaction để né unique constraint
        fixOrderIndex(programId);

        return ApiResponse.ok("Đã import cấu trúc", Map.of(
                "soTaoMoiChuong", soTaoMoiChuong,
                "soCapNhatChuong", soCapNhatChuong,
                "soTaoMoiBai", soTaoMoiBai,
                "soCapNhatBai", soCapNhatBai,
                "tongChuong", ds.size(),
                "tongBai", ds.stream().mapToInt(c -> c.bai() == null ? 0 : c.bai().size()).sum()
        ));
    }

    // ==================== Internal ====================

    /**
     * Upsert chapter by (course_id, title). Trả {@code -id} nếu tạo mới, {@code +id} nếu đã có.
     * Dùng convention âm/dương thay vì record để tránh tạo thêm class nội bộ.
     */
    private Long upsertChapter(Long courseId, String title, int orderIndex) {
        List<Long> cu = jdbc.queryForList(
                "select id from chapters where course_id=? and lower(trim(title))=lower(trim(?)) and deleted_at is null",
                Long.class, courseId, title);
        if (!cu.isEmpty()) {
            // Cập nhật order_index nếu thay đổi — dùng trick âm để né unique constraint uq_chapters_order
            Long id = cu.get(0);
            jdbc.update("update chapters set order_index=-(?) ,updated_at=now() where id=?", orderIndex, id);
            // Flush ngay để chốt — sau vòng lặp sẽ fix hết về dương
            return id; // dương = đã tồn tại
        }
        // Tạo mới — orderIndex âm trước để né conflict với chapter hiện có cùng order
        Long id = jdbc.queryForObject("""
                insert into chapters(course_id,title,order_index,status,created_at,updated_at)
                values(?,?,?,?,now(),now()) returning id""",
                Long.class, courseId, title, -orderIndex, PublishStatus.DRAFT.name());
        return -id; // âm = tạo mới
    }

    /**
     * Upsert lesson by (chapter_id, title). Trả {@code true} nếu tạo mới.
     */
    private boolean upsertLesson(Long chapterId, String title, int orderIndex) {
        List<Long> cu = jdbc.queryForList(
                "select id from lessons where chapter_id=? and lower(trim(title))=lower(trim(?)) and deleted_at is null",
                Long.class, chapterId, title);
        if (!cu.isEmpty()) {
            Long id = cu.get(0);
            jdbc.update("update lessons set order_index=-(?),updated_at=now() where id=?", orderIndex, id);
            return false;
        }
        jdbc.update("""
                insert into lessons(chapter_id,title,order_index,status,created_at,updated_at)
                values(?,?,?,?,now(),now())""",
                chapterId, title, -orderIndex, PublishStatus.DRAFT.name());
        return true;
    }

    /**
     * Sau khi upsert toàn bộ, fix lại tất cả order_index âm về dương.
     * Gọi cuối transaction để unique constraint {@code uq_chapters_order} và
     * {@code uq_lessons_order} không bị kích trong quá trình upsert.
     */
    /** Fix lại order_index âm về dương sau khi upsert xong. */
    private void fixOrderIndex(Long courseId) {
        // Fix chapters
        jdbc.update("""
                update chapters set order_index=-order_index, updated_at=now()
                where course_id=? and order_index < 0 and deleted_at is null""", courseId);
        // Fix lessons của các chapters thuộc course này
        jdbc.update("""
                update lessons set order_index=-order_index, updated_at=now()
                where chapter_id in (
                    select id from chapters where course_id=? and deleted_at is null
                ) and order_index < 0 and deleted_at is null""", courseId);
    }

    private void kiemTra(Long programId) {
        Integer n = jdbc.queryForObject(
                "select count(*) from courses where id=? and deleted_at is null", Integer.class, programId);
        if (n == null || n == 0) throw new ResourceNotFoundException("Không tìm thấy chương trình");
    }
}
