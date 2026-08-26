package com.math10.configuration;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

import java.io.IOException;

/**
 * Cho phép Spring tự phục vụ bản build React nằm trong jar: bấm F5 hay back/forward tại một
 * đường dẫn của phía client (ví dụ /documents/12) thì trả về index.html thay vì 404, để React
 * tự dựng lại màn hình.
 *
 * <p>Hiện tại repo deploy frontend riêng (Vercel, xem {@code vercel.json} ở gốc) nên trong jar
 * không có {@code classpath:/static/index.html} và toàn bộ cấu hình này tự tắt — xem
 * {@link #addResourceHandlers}. Nếu sau này gộp {@code dist/} vào jar thì nó chạy ngay, nhưng
 * nhớ mở quyền cho đường dẫn tĩnh trong {@code SecurityConfig}: hiện mọi request đều phải
 * đăng nhập nên trang HTML sẽ bị chặn trước khi tới được đây.
 */
@Configuration
public class SpaConfig implements WebMvcConfigurer {

    private static final ClassPathResource INDEX = new ClassPathResource("static/index.html");

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        // Không có bản build trong jar thì đăng ký "/**" chỉ tổ gây hại: handler này đứng trước
        // mọi đường dẫn còn lại, mà fallback lại trỏ vào một file không tồn tại — 404 thật sẽ
        // biến thành lỗi khó đoán. Backend thuần API như hiện nay thì im lặng là đúng.
        if (!INDEX.exists()) {
            return;
        }

        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new PathResourceResolver() {
                    @Override
                    protected Resource getResource(String path, Resource location) throws IOException {
                        // Trả null để Spring xử lý tiếp. Thiếu chỗ này thì gọi sai endpoint API sẽ
                        // nhận về HTML của index.html thay vì 404, debug rất mệt.
                        if (isBackendPath(path)) {
                            return null;
                        }
                        if (path.isEmpty()) {
                            return INDEX;
                        }
                        Resource requested = location.createRelative(path);
                        return requested.exists() && requested.isReadable() ? requested : INDEX;
                    }
                });
    }

    /**
     * Đường của backend, không phải route của React. Ngoài {@code api/} còn phải chừa Swagger:
     * springdoc đang bật trong application.yml, mà trang tài liệu của nó cũng là tài nguyên tĩnh
     * nên sẽ bị handler này nuốt mất nếu không loại trừ.
     */
    private static boolean isBackendPath(String path) {
        return path.startsWith("api/")
                || path.startsWith("v3/api-docs")
                || path.startsWith("swagger-ui");
    }
}
