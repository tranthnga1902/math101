package com.math10.audit.controller;

import com.math10.audit.dto.AuditLogQuery;
import com.math10.audit.dto.AuditLogResponse;
import com.math10.audit.service.AuditService;
import com.math10.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/audit-logs")
public class AuditController {
    private final AuditService auditService;

    /**
     * Lọc dưới CSDL chứ không tải về rồi lọc ở trình duyệt: nhật ký nay ghi cả bài giao, điểm số,
     * thành viên lớp và tài liệu, nên một trang 50 dòng mới nhất chỉ còn là vài phút hoạt động —
     * lọc phía client trên tập đó sẽ báo "không có kết quả" cho những việc thật sự đã xảy ra.
     *
     * <p>Thứ tự mặc định đặt ở máy chủ, không phó cho lời gọi. Truy vấn không có {@code order by},
     * nên thiếu tham số sắp xếp thì CSDL trả về theo thứ tự tuỳ ý — nhật ký mà không theo thời gian
     * thì vô dụng. Và phải có {@code id} làm khoá phụ: nhiều dòng ghi trong cùng một thao tác
     * (chấm lại cả lớp, nhập danh sách) có cùng {@code created_at}, chỉ sắp theo thời gian thì thứ
     * tự giữa chúng không xác định, nên cùng một dòng có thể hiện ở hai trang hoặc không hiện ở
     * trang nào.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<Page<AuditLogResponse>> search(@RequestParam(required = false) Long actorUserId,
                                                      @RequestParam(required = false) String actorRole,
                                                      @RequestParam(required = false) String targetType,
                                                      @RequestParam(required = false) Long targetId,
                                                      @RequestParam(required = false) String action,
                                                      @RequestParam(required = false) Integer days,
                                                      @PageableDefault(size = 50, sort = {"createdAt", "id"},
                                                              direction = Sort.Direction.DESC) Pageable pageable) {
        AuditLogQuery query = new AuditLogQuery(actorUserId, actorRole, targetType, targetId, action, days);
        return ApiResponse.ok("Lấy nhật ký hoạt động thành công", auditService.search(query, pageable));
    }
}
