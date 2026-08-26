package com.math10.users.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.users.dto.ResetPasswordRequest;
import com.math10.users.dto.UserImportConfirmRequest;
import com.math10.users.dto.UserImportPreviewRequest;
import com.math10.users.dto.UserImportPreviewResponse;
import com.math10.users.dto.UserImportPresignRequest;
import com.math10.users.dto.UserImportPresignResponse;
import com.math10.users.dto.UserImportResult;
import com.math10.users.dto.UserRequest;
import com.math10.users.dto.UserResponse;
import com.math10.users.entity.UserStatus;
import com.math10.users.service.UserImportService;
import com.math10.users.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;
    private final UserImportService userImportService;

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<UserResponse>> findAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String roleCode,
            @RequestParam(required = false) UserStatus status,
            @PageableDefault(size = 20, sort = "fullName") Pageable pageable
    ) {
        return ApiResponse.ok("Lấy danh sách tài khoản thành công", userService.findAll(search, roleCode, status, pageable));
    }

    @GetMapping("/students")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<Page<UserResponse>> findStudents(@RequestParam(required = false) String search) {
        return ApiResponse.ok("Danh sách học sinh", userService.findAll(search, "STUDENT", UserStatus.ACTIVE, PageRequest.of(0, 50)));
    }

    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserResponse> create(@Valid @RequestBody UserRequest request) {
        return ApiResponse.created("Tạo tài khoản thành công", userService.create(request));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserResponse> update(@PathVariable Long id, @Valid @RequestBody UserRequest request) {
        return ApiResponse.ok("Cập nhật tài khoản thành công", userService.update(id, request));
    }

    @PatchMapping("/{id}/reset-password")
    @PreAuthorize("hasAnyRole('ADMIN', 'TEACHER')")
    public ApiResponse<Void> resetPassword(@PathVariable Long id, @Valid @RequestBody ResetPasswordRequest request) {
        userService.resetPassword(id, request);
        return ApiResponse.ok("Đặt lại mật khẩu thành công", null);
    }

    @PatchMapping("/{id}/lock")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> lock(@PathVariable Long id) {
        userService.lock(id);
        return ApiResponse.ok("Khóa tài khoản thành công", null);
    }

    @PatchMapping("/{id}/activate")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> activate(@PathVariable Long id) {
        userService.activate(id);
        return ApiResponse.ok("Kích hoạt tài khoản thành công", null);
    }

    @PatchMapping("/{id}/disable")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> disable(@PathVariable Long id) {
        userService.disable(id);
        return ApiResponse.ok("Vô hiệu hóa tài khoản thành công", null);
    }

    @PostMapping("/import/presign")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserImportPresignResponse> presignImport(@Valid @RequestBody UserImportPresignRequest request) {
        return ApiResponse.ok("Tạo URL tải lên thành công", userImportService.presign(request.fileName(), request.contentType()));
    }

    @PostMapping(value = "/import/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserImportPreviewResponse> uploadImport(@RequestPart("file") MultipartFile file) {
        return ApiResponse.ok("Đọc file import thành công", userImportService.uploadAndPreview(file));
    }

    @GetMapping("/import/template")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<byte[]> importTemplate() {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=user-import-template.xlsx")
                .body(userImportService.template());
    }

    @PostMapping("/import/preview")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserImportPreviewResponse> previewImport(@Valid @RequestBody UserImportPreviewRequest request) {
        return ApiResponse.ok("Đọc file import thành công", userImportService.preview(request.objectKey()));
    }

    @PostMapping("/import/confirm")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<UserImportResult> confirmImport(@Valid @RequestBody UserImportConfirmRequest request) {
        return ApiResponse.created("Import tài khoản hoàn tất", userImportService.confirm(request.objectKey()));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Void> delete(@PathVariable Long id) {
        userService.softDelete(id);
        return ApiResponse.noContent("Xóa tài khoản thành công");
    }
}
