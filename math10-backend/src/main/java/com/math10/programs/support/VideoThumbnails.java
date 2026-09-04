package com.math10.programs.support;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Suy ảnh bìa của một video từ chính đường dẫn của nó.
 *
 * <p>Bên tài liệu, ảnh bìa được vẽ ra bằng PDFBox từ trang đầu của tệp. Video không có trang đầu để
 * vẽ, và dựng cả một đường giải mã khung hình chỉ để lấy một tấm ảnh là đổi một thư viện nặng lấy
 * một tiện ích nhỏ. YouTube thì đã phát sẵn ảnh bìa ở một địa chỉ suy được từ mã video, nên với
 * nguồn ấy việc này chỉ là ghép chuỗi.
 *
 * <p>Nguồn khác thì trả về {@code null}, và bên gọi phải để trống cột. Dán một ảnh giữ chỗ vào đó
 * sẽ khiến "chưa có ảnh bìa" trông y hệt "đã có ảnh bìa" trên màn hình, và từ đó không ai đếm được
 * còn bao nhiêu video thiếu ảnh.
 */
public final class VideoThumbnails {

    /** Mã video YouTube: 11 ký tự, chỉ chữ - số - gạch dưới - gạch ngang. */
    private static final String MA = "([A-Za-z0-9_-]{11})";

    private static final Pattern[] DANG = {
            Pattern.compile("[?&]v=" + MA),                       // youtube.com/watch?v=…
            Pattern.compile("youtu\\.be/" + MA),                  // youtu.be/…
            Pattern.compile("youtube\\.com/embed/" + MA),         // nhúng
            Pattern.compile("youtube\\.com/shorts/" + MA),        // shorts
            Pattern.compile("youtube\\.com/live/" + MA),          // phát trực tiếp
    };

    private VideoThumbnails() {
    }

    /**
     * @return địa chỉ ảnh bìa suy được, hoặc {@code null} nếu đường dẫn không phải YouTube.
     */
    public static String suyRa(String videoUrl) {
        if (videoUrl == null || videoUrl.isBlank()) return null;
        for (Pattern dang : DANG) {
            Matcher khop = dang.matcher(videoUrl);
            if (khop.find()) return "https://img.youtube.com/vi/" + khop.group(1) + "/hqdefault.jpg";
        }
        return null;
    }
}
