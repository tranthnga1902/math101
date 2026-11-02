package com.math10.programs.support;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Đoán nơi đến và đối tượng cho một tệp vừa thả vào, từ mỗi cái tên của nó.
 *
 * <p>Đầu năm có khoảng 200 tệp cho 105 tiết. Sáu thao tác mỗi tệp là 1200 thao tác, và người làm
 * đến tệp thứ ba mươi thì bắt đầu bấm cho xong. Lớp này cắt phần lặp ấy xuống gần không: hệ điền
 * sẵn, người soát và chỉ sửa dòng nào đoán sai.
 *
 * <p><b>Ba luật, và luật thứ ba phải đứng riêng.</b> Luật 1 đọc mã trong tên tệp, luật 2 khớp mờ
 * tên bài — cả hai trả lời <em>đi tới đâu</em>. Luật 3 nhận diện đáp án và barem, trả lời <em>ai
 * đọc được</em>. Gộp chúng lại thì một tệp tên {@code DS-t12-dapan.pdf} hoặc mất nơi đến, hoặc lọt
 * đáp án tới học sinh — và lọt đáp án là lỗi đắt nhất trong cả hệ. Nên luật 3 chạy sau, chỉ chạm
 * vào cột đối tượng, không bao giờ chạm vào nơi đến.
 *
 * <p><b>Ba ngưỡng tin cậy, và ngưỡng thấp là để trống.</b> Một gợi ý sai mà người soát không để ý
 * còn tệ hơn một ô trống, vì ô trống bắt người ta nhìn còn gợi ý sai thì không. Nên khi không có
 * tín hiệu nào đủ chắc, lớp này trả về nơi đến rỗng chứ không đoán bừa.
 *
 * <p><b>Không đụng cơ sở dữ liệu.</b> Người gọi nạp sẵn mạch và tiết của chương trình rồi truyền
 * vào. Đoán là một phép thuần: cùng đầu vào ra cùng đầu ra, thử được không cần Spring.
 */
public final class DoanNoiDen {

    private DoanNoiDen() {}

    public static final String CAO = "CAO";
    public static final String TRUNG_BINH = "TRUNG_BINH";
    public static final String THAP = "THAP";

    /** Một mạch của chương trình, chỉ phần mà việc đoán cần biết. */
    public record Mach(long id, String ma, String ten) {}

    /** Một tiết trong mạch. {@code loai} là {@code period_kind}, cần cho mặc định của tiết kiểm tra. */
    public record Tiet(long id, long machId, int soTiet, int tuan, String tieuDe, String loai) {}

    /**
     * Một dòng điền sẵn. {@code noiDenLoai} và {@code neo} rỗng nghĩa là ngưỡng thấp — bắt người
     * soát tự chọn. {@code vet} nói luật nào đã nổ, để người soát hiểu vì sao chứ không phải tin.
     */
    public record GoiY(String tenTep, String noiDenLoai, Long neo, String doiTuong,
                       String doTinCay, String vet) {}

    private static final Pattern MA_TIET = Pattern.compile("([a-z]{1,6})\\s*t(?:iet)?\\s*(\\d{1,3})(?![0-9])");

    /**
     * Từ khóa bắt buộc chuyển sang chỉ-giáo-viên. Danh sách này cố ý ngắn và cố ý thiên về tiếng
     * Việt có sẵn trong kho: nhận nhầm một phiếu học sinh thành tài liệu giáo viên thì người ta sửa
     * một dòng, còn bỏ sót một tệp đáp án thì cả lớp có đáp án trước giờ kiểm tra. Hai lỗi ấy không
     * cùng giá, nên ngưỡng của chúng cũng không cùng.
     */
    private static final List<String> TU_KHOA_GIAO_VIEN = List.of(
            "dap an", "dapan", "huong dan giai", "huong dan cham", "bieu diem", "barem",
            "thang diem", "loi giai", "giai chi tiet", "answer key", "solution");

    /** Những chữ có mặt ở mọi tên tệp nên không giúp phân biệt gì; bỏ ra trước khi khớp mờ. */
    private static final Set<String> CHU_RONG = Set.of(
            "pdf", "docx", "doc", "pptx", "ppt", "xlsx", "png", "jpg", "jpeg", "de", "bai", "tiet",
            "toan", "lop", "10", "hs", "gv", "file", "tai", "lieu", "final", "ban", "v1", "v2");
}
