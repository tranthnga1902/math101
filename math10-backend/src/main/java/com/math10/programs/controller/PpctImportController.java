package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.programs.PpctGhiService;
import com.math10.programs.dto.PpctDtos.ConfirmRequest;
import com.math10.programs.dto.PpctDtos.Preview;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;

/**
 * Nhập PPCT thật cho một chương trình: tải PDF → xem trước bảng đã gán mạch → xác nhận & phân phối.
 *
 * <p>Chỉ ADMIN. Đường ghi thay phần {@code SEED} của {@code program_periods}; dòng {@code MANUAL}
 * giữ nguyên. Xem {@link PpctGhiService} cho luật khớp {@code (strand_id, period_no)} và giữ id.
 */
@RestController
@RequiredArgsConstructor
public class PpctImportController {

    private final PpctGhiService ghi;

    @PostMapping(value = "/api/admin/programs/{programId}/ppct/preview",
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Preview> xemTruoc(@PathVariable long programId, @RequestPart("file") MultipartFile file) {
        return ApiResponse.ok("Đọc tệp PPCT", ghi.xemTruoc(programId, file));
    }

    @PostMapping("/api/admin/programs/{programId}/ppct/confirm")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Map<String, Object>> phanPhoi(@PathVariable long programId,
                                                     @Valid @RequestBody ConfirmRequest req) {
        return ApiResponse.ok("Đã phân phối theo PPCT", ghi.phanPhoi(programId, req));
    }
}
