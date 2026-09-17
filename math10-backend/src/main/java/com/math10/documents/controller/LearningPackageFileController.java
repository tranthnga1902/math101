package com.math10.documents.controller;

import com.math10.documents.service.LearningPackageService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.MediaTypeFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Phục vụ file bên trong gói SCORM/xAPI đã giải nén. Không cần đăng nhập: quyền nằm ở token trong
 * đường dẫn (xem {@link LearningPackageService}). Chuỗi bảo mật riêng cho đường này ở SecurityConfig.
 */
@RestController
@RequiredArgsConstructor
public class LearningPackageFileController {

    /** Script trong gói chạy ở origin rỗng; cho phép những gì bài giảng thường cần. */
    private static final String SANDBOX_CSP =
            "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-pointer-lock";

    private static final Pattern HEAD = Pattern.compile("<head(\\s[^>]*)?>", Pattern.CASE_INSENSITIVE);

    /**
     * API SCORM 1.2 ({@code window.API}) và 2004 ({@code window.API_1484_11}) giả lập, gắn thẳng vào
     * từng trang HTML: iframe sandbox không với tới được cửa sổ cha, nên bài giảng phải tìm thấy API
     * ngay trên chính cửa sổ của nó. Dữ liệu chỉ nằm trong bộ nhớ trang và được báo ra ngoài.
     */
    private static final String SCORM_SHIM = """
            <script>(function(){if(window.API&&window.API_1484_11)return;var d={"cmi.core.lesson_status":"not attempted",\
            "cmi.completion_status":"unknown","cmi.success_status":"unknown","cmi.core.student_name":"Hoc sinh",\
            "cmi.learner_name":"Hoc sinh","cmi.mode":"normal","cmi.core.lesson_mode":"normal","cmi.core.entry":"ab-initio",\
            "cmi.entry":"ab-initio","cmi.suspend_data":"","cmi.core.credit":"credit","cmi.credit":"credit"};\
            function post(k,v){try{parent.postMessage({type:"math10-scorm",key:k,value:v},"*")}catch(e){}}\
            function ok(){return "true"}function get(k){return d[k]==null?"":String(d[k])}\
            function set(k,v){d[k]=v;post(k,v);return "true"}function none(){return "0"}function str(){return ""}\
            window.API={LMSInitialize:ok,LMSFinish:function(){post("finish",true);return "true"},LMSGetValue:get,\
            LMSSetValue:set,LMSCommit:ok,LMSGetLastError:none,LMSGetErrorString:str,LMSGetDiagnostic:str};\
            window.API_1484_11={Initialize:ok,Terminate:function(){post("finish",true);return "true"},GetValue:get,\
            SetValue:set,Commit:ok,GetLastError:none,GetErrorString:str,GetDiagnostic:str};})();</script>""";

    private final LearningPackageService packages;

    @GetMapping(LearningPackageService.PATH_PREFIX + "{token}/**")
    public ResponseEntity<?> file(@PathVariable String token, HttpServletRequest request) throws IOException {
        String uri = request.getRequestURI().substring(request.getContextPath().length());
        String marker = LearningPackageService.PATH_PREFIX + token + "/";
        String relative = URLDecoder.decode(uri.substring(uri.indexOf(marker) + marker.length()), StandardCharsets.UTF_8);
        Path file = packages.resolve(token, relative);

        String name = file.getFileName().toString().toLowerCase(Locale.ROOT);
        MediaType type = MediaTypeFactory.getMediaType(name).orElse(MediaType.APPLICATION_OCTET_STREAM);
        ResponseEntity.BodyBuilder response = ResponseEntity.ok()
                .header("Content-Security-Policy", SANDBOX_CSP)
                .header("X-Content-Type-Options", "nosniff")
                .header("Referrer-Policy", "no-referrer")
                .cacheControl(CacheControl.maxAge(1, TimeUnit.HOURS).cachePrivate());

        if (name.endsWith(".html") || name.endsWith(".htm")) {
            // Đọc theo ISO-8859-1 để giữ nguyên từng byte dù trang mã hóa gì; đoạn chèn toàn ASCII.
            String html = Files.readString(file, StandardCharsets.ISO_8859_1);
            Matcher head = HEAD.matcher(html);
            String injected = head.find()
                    ? html.substring(0, head.end()) + SCORM_SHIM + html.substring(head.end())
                    : SCORM_SHIM + html;
            return response.contentType(MediaType.TEXT_HTML).body(injected.getBytes(StandardCharsets.ISO_8859_1));
        }
        Resource body = new FileSystemResource(file);
        return response.contentType(type).body(body);
    }
}
