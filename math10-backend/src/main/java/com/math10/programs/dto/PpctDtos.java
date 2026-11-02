package com.math10.programs.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.List;

/**
 * DTO cho đường nhập PPCT: tải PDF → xem trước bảng đã gán mạch → xác nhận & phân phối.
 *
 * <p><b>Xem trước không phải là ghi.</b> {@link Preview} trả về đúng những gì máy đọc được và máy
 * đoán được, kèm {@code doTinCay} từng dòng, để admin sửa chỗ máy chưa chắc trước khi cam kết.
 * {@link ConfirmRequest} gửi lại <em>bản admin đã sửa</em> — {@code objectKey} chỉ để ghi vết, còn
 * mạch/tiết/tuần lấy thẳng từ payload. Server vẫn kiểm lại tập giá trị vì client có thể lệch.
 */
public final class PpctDtos {
    private PpctDtos() {}

    /** PDF scan không rút được text → {@code UNSUPPORTED_SCAN}, không bao giờ {@code FAILED}. */
    public static final String SAN_SANG = "SAN_SANG";
    public static final String UNSUPPORTED_SCAN = "UNSUPPORTED_SCAN";

    public record Preview(
            String objectKey,
            String trangThai,
            int soTuan,
            int soTiet,
            int soMach,
            List<Dong> dong,
            int soHopLe,
            int soLoi,
            String thongDiep
    ) {
        /** PDF trắng: vẫn trả lời được, không ném lỗi. */
        public static Preview scan(String objectKey, String thongDiep) {
            return new Preview(objectKey, UNSUPPORTED_SCAN, 0, 0, 0, List.of(), 0, 0, thongDiep);
        }
    }

    /**
     * Một dòng đã gán mạch. {@code lessonId}/{@code lessonTitle} để rỗng khi chưa khớp được bài
     * trong {@code lessons} — trung tâm chưa seed bài Toán 10 nào nên thực tế luôn rỗng.
     */
    public record Dong(
            int chiSo,
            String maMach,
            String tenMach,
            int soTiet,
            int tuan,
            int hocKy,
            String phanLoai,
            String tieuDe,
            Long lessonId,
            String lessonTitle,
            String doTinCay,
            List<String> canhBao
    ) {}

    public record ConfirmRequest(
            @NotBlank
            @Pattern(regexp = "^admin/ppct-imports/[A-Za-z0-9._/-]+$",
                    message = "objectKey không thuộc thư mục nhập PPCT")
            String objectKey,
            @NotNull List<DongSua> dong
    ) {}

    /**
     * Dòng admin gửi lại khi xác nhận. {@code chiSo} chỉ để đối chiếu với bảng xem trước; thứ ghi
     * xuống {@code program_periods} là {@code maMach}/{@code soTiet}/{@code tuan}/{@code hocKy}/
     * {@code phanLoai}/{@code tieuDe}. {@code tenMach} đi kèm để đường ghi tạo được mạch mới khi
     * chương trình chưa có mã đó — nhập PPCT không còn cứng theo bốn mã CTST. Kiểm tập giá trị
     * ({@code phanLoai} ∈ CHECK, {@code (maMach, hocKy, soTiet)} duy nhất trong payload) làm ở
     * đường ghi.
     */
    public record DongSua(
            int chiSo,
            @NotBlank String maMach,
            @NotBlank String tenMach,
            @Min(1) int soTiet,
            @Min(1) int tuan,
            @Min(1) @Max(2) int hocKy,
            @NotBlank String phanLoai,
            @NotBlank String tieuDe,
            Long lessonId
    ) {}
}
