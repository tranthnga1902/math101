package com.math10.documents.service;

import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Locale;
import java.util.function.Supplier;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Chạy gói SCORM/xAPI và trang HTML (một file, hoặc gói .zip có index.html) ngay trong app ở mức cơ bản: giải nén gói ra đĩa, tìm trang khởi chạy, phục
 * vụ từng file qua {@code /api/doc-packages/{token}/...} và gắn sẵn API SCORM giả lập vào trang HTML.
 *
 * <p><b>Vì sao cần token trong đường dẫn:</b> trang trong iframe tự tải CSS/JS/ảnh theo đường dẫn
 * tương đối, trình duyệt không gắn header Authorization vào các request đó. Nên quyền được kiểm
 * <i>một lần</i> lúc xin mở ({@code DocumentService}), rồi cấp token ký HMAC ngắn hạn gắn với đúng
 * tài liệu đó. Token chỉ mở được file trong gói, không mở được API nào khác.
 *
 * <p><b>Vì sao sandbox:</b> gói do người dùng tải lên, chạy chung origin với API. Mọi file được trả
 * kèm CSP {@code sandbox} không có {@code allow-same-origin}, nên script trong gói chạy ở origin
 * rỗng — không đọc được cookie hay gọi API bằng phiên của người đang xem.
 *
 * <p>Chưa có: lưu điểm/tiến độ SCORM và LRS cho xAPI. API giả lập giữ dữ liệu trong bộ nhớ trang và
 * báo ra ngoài bằng postMessage để làm tiếp sau.
 */
@Service
public class LearningPackageService {

    public static final String PATH_PREFIX = "/api/doc-packages/";
    private static final long TOKEN_TTL_SECONDS = 6 * 3600;
    private static final long MAX_UNPACKED_BYTES = 1024L * 1024 * 1024;
    private static final String READY_MARKER = ".math10-ready";
    private static final String ENTRY_FILE = ".math10-entry";

    private final Path cacheDir;
    private final byte[] secret;

    public LearningPackageService(@Value("${math10.file-storage-path}") String storagePath,
                                  @Value("${math10.jwt-secret}") String jwtSecret) {
        this.cacheDir = Path.of(storagePath, "packages").toAbsolutePath().normalize();
        // Khóa riêng cho token gói, suy từ bí mật JWT: token gói không bao giờ dùng được như JWT.
        this.secret = hmac(jwtSecret.getBytes(StandardCharsets.UTF_8), "math10-doc-package");
    }

    /** Giải nén (nếu chưa) và trả đường dẫn khởi chạy tương đối với {@link #PATH_PREFIX}. */
    public String launchPath(Long documentId, String cacheKey, Supplier<byte[]> zipBytes) {
        return launch(documentId, cacheKey, temp -> extractZip(temp, zipBytes.get()));
    }

    /**
     * Trang HTML một file: đặt vào thư mục riêng thành index.html rồi phục vụ y như gói, để đi chung
     * đường có token và CSP sandbox — không bao giờ trả HTML người dùng tải lên từ origin của API.
     */
    public String launchHtmlPath(Long documentId, String cacheKey, Supplier<byte[]> htmlBytes) {
        return launch(documentId, cacheKey, temp -> Files.write(temp.resolve("index.html"), htmlBytes.get()));
    }

    private String launch(Long documentId, String cacheKey, Extractor extractor) {
        String folder = OfficePdfConverter.sha256(cacheKey);
        Path dir = unpack(folder, extractor);
        String entry;
        try {
            entry = Files.readString(dir.resolve(ENTRY_FILE), StandardCharsets.UTF_8).strip();
        } catch (IOException e) {
            throw new BusinessException("Không đọc được gói học liệu");
        }
        long expires = Instant.now().getEpochSecond() + TOKEN_TTL_SECONDS;
        String payload = documentId + "." + folder + "." + expires;
        String token = b64(payload.getBytes(StandardCharsets.UTF_8)) + "." + b64(hmac(secret, payload)).substring(0, 32);
        return PATH_PREFIX + token + "/" + entry;
    }

    /** File trong gói ứng với token; token sai hoặc hết hạn thì coi như không tồn tại. */
    public Path resolve(String token, String relativePath) {
        int dot = token.indexOf('.');
        if (dot < 0) {
            throw new ResourceNotFoundException("Liên kết gói học liệu không hợp lệ");
        }
        String payload;
        try {
            payload = new String(Base64.getUrlDecoder().decode(token.substring(0, dot)), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new ResourceNotFoundException("Liên kết gói học liệu không hợp lệ");
        }
        String expected = b64(hmac(secret, payload)).substring(0, 32);
        if (!MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                token.substring(dot + 1).getBytes(StandardCharsets.UTF_8))) {
            throw new ResourceNotFoundException("Liên kết gói học liệu không hợp lệ");
        }
        String[] parts = payload.split("\\.");
        if (parts.length != 3 || Long.parseLong(parts[2]) < Instant.now().getEpochSecond()) {
            throw new ResourceNotFoundException("Liên kết gói học liệu đã hết hạn, hãy mở lại tài liệu");
        }
        Path dir = cacheDir.resolve(parts[1]);
        if (!Files.exists(dir.resolve(READY_MARKER))) {
            throw new ResourceNotFoundException("Gói học liệu chưa sẵn sàng, hãy mở lại tài liệu");
        }
        Path file = dir.resolve(relativePath).normalize();
        if (!file.startsWith(dir) || file.getFileName().toString().startsWith(".math10-") || !Files.isRegularFile(file)) {
            throw new ResourceNotFoundException("Không tìm thấy file trong gói học liệu");
        }
        return file;
    }

    @FunctionalInterface
    private interface Extractor {
        void writeInto(Path temp) throws IOException;
    }

    private static void extractZip(Path temp, byte[] zipBytes) throws IOException {
        long total = 0;
        try (ZipInputStream zip = new ZipInputStream(new ByteArrayInputStream(zipBytes))) {
            ZipEntry entry;
            while ((entry = zip.getNextEntry()) != null) {
                Path target = temp.resolve(entry.getName().replace('\\', '/')).normalize();
                if (!target.startsWith(temp)) {
                    throw new BusinessException("Gói học liệu chứa đường dẫn không hợp lệ");
                }
                if (entry.isDirectory()) {
                    Files.createDirectories(target);
                    continue;
                }
                Files.createDirectories(target.getParent());
                total += Files.copy(zip, target, StandardCopyOption.REPLACE_EXISTING);
                if (total > MAX_UNPACKED_BYTES) {
                    throw new BusinessException("Gói học liệu giải nén ra quá lớn (trên 1 GB)");
                }
            }
        }
    }

    private Path unpack(String folder, Extractor extractor) {
        Path dir = cacheDir.resolve(folder);
        if (Files.exists(dir.resolve(READY_MARKER))) {
            return dir;
        }
        Path temp = null;
        try {
            Files.createDirectories(cacheDir);
            temp = Files.createTempDirectory(cacheDir, "tmp-");
            extractor.writeInto(temp);
            String entry = findLaunchEntry(temp);
            Files.writeString(temp.resolve(ENTRY_FILE), entry, StandardCharsets.UTF_8);
            Files.writeString(temp.resolve(READY_MARKER), "ok", StandardCharsets.UTF_8);
            try {
                Files.move(temp, dir, StandardCopyOption.ATOMIC_MOVE);
            } catch (IOException raced) {
                // Hai người mở cùng lúc: bên kia đã giải nén xong trước thì dùng bản đó.
                if (!Files.exists(dir.resolve(READY_MARKER))) {
                    throw raced;
                }
                OfficePdfConverter.deleteQuietly(temp);
            }
            return dir;
        } catch (IOException e) {
            if (temp != null) {
                OfficePdfConverter.deleteQuietly(temp);
            }
            throw new BusinessException("Không giải nén được gói học liệu: " + e.getMessage());
        } catch (RuntimeException e) {
            if (temp != null) {
                OfficePdfConverter.deleteQuietly(temp);
            }
            throw e;
        }
    }

    /** Trang khởi chạy: cmi5.xml / tincan.xml (xAPI) rồi imsmanifest.xml (SCORM), cuối cùng index.html. */
    static String findLaunchEntry(Path root) throws IOException {
        Path cmi5 = findFile(root, "cmi5.xml");
        if (cmi5 != null) {
            String url = firstText(parse(cmi5), "url");
            if (url != null) return relative(root, cmi5, url);
        }
        Path tincan = findFile(root, "tincan.xml");
        if (tincan != null) {
            String launch = firstText(parse(tincan), "launch");
            if (launch != null) return relative(root, tincan, launch);
        }
        Path manifest = findFile(root, "imsmanifest.xml");
        if (manifest != null) {
            String href = scormHref(parse(manifest));
            if (href != null) return relative(root, manifest, href);
        }
        for (String name : List.of("index_lms.html", "story.html", "index.html", "index.htm")) {
            Path file = findFile(root, name);
            if (file != null) return root.relativize(file).toString().replace('\\', '/');
        }
        throw new BusinessException("Không tìm thấy trang khởi chạy trong gói học liệu");
    }

    /** Resource của item đầu tiên trong tổ chức mặc định; không có thì resource đầu tiên có href. */
    private static String scormHref(org.w3c.dom.Document doc) {
        NodeList resources = byLocalName(doc, "resource");
        String orgDefault = null;
        NodeList orgsList = byLocalName(doc, "organizations");
        if (orgsList.getLength() > 0) {
            orgDefault = ((Element) orgsList.item(0)).getAttribute("default");
        }
        NodeList orgs = byLocalName(doc, "organization");
        Element org = null;
        for (int i = 0; i < orgs.getLength(); i++) {
            Element candidate = (Element) orgs.item(i);
            if (org == null || candidate.getAttribute("identifier").equals(orgDefault)) {
                org = candidate;
            }
        }
        if (org != null) {
            NodeList items = org.getElementsByTagNameNS("*", "item");
            for (int i = 0; i < items.getLength(); i++) {
                Element item = (Element) items.item(i);
                String ref = item.getAttribute("identifierref");
                if (ref.isBlank()) continue;
                for (int j = 0; j < resources.getLength(); j++) {
                    Element resource = (Element) resources.item(j);
                    if (ref.equals(resource.getAttribute("identifier")) && !resource.getAttribute("href").isBlank()) {
                        return withBase(resource, resource.getAttribute("href")) + item.getAttribute("parameters");
                    }
                }
            }
        }
        for (int j = 0; j < resources.getLength(); j++) {
            Element resource = (Element) resources.item(j);
            if (!resource.getAttribute("href").isBlank()) {
                return withBase(resource, resource.getAttribute("href"));
            }
        }
        return null;
    }

    private static String withBase(Element resource, String href) {
        StringBuilder base = new StringBuilder();
        for (Node n = resource; n instanceof Element e; n = n.getParentNode()) {
            String xmlBase = e.getAttribute("xml:base");
            if (!xmlBase.isBlank()) base.insert(0, xmlBase.endsWith("/") ? xmlBase : xmlBase + "/");
        }
        return base + href;
    }

    private static String relative(Path root, Path descriptor, String href) {
        String trimmed = href.strip();
        if (trimmed.matches("(?i)^[a-z][a-z0-9+.-]*:.*")) {
            throw new BusinessException("Gói học liệu khởi chạy từ địa chỉ bên ngoài, chưa hỗ trợ xem trong app");
        }
        int cut = indexOfAny(trimmed, '?', '#');
        String path = cut < 0 ? trimmed : trimmed.substring(0, cut);
        String rest = cut < 0 ? "" : trimmed.substring(cut);
        Path resolved = descriptor.getParent().resolve(path).normalize();
        if (!resolved.startsWith(root) || !Files.isRegularFile(resolved)) {
            throw new BusinessException("Trang khởi chạy " + path + " không có trong gói học liệu");
        }
        return root.relativize(resolved).toString().replace('\\', '/') + rest;
    }

    private static int indexOfAny(String s, char a, char b) {
        int i = s.indexOf(a), j = s.indexOf(b);
        return i < 0 ? j : j < 0 ? i : Math.min(i, j);
    }

    /** Mô tả nằm nông nhất (gói hay bọc thêm một thư mục ngoài cùng). */
    private static Path findFile(Path root, String name) throws IOException {
        try (Stream<Path> walk = Files.walk(root, 4)) {
            return walk.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().toLowerCase(Locale.ROOT).equals(name))
                    .min((x, y) -> Integer.compare(x.getNameCount(), y.getNameCount()))
                    .orElse(null);
        }
    }

    private static org.w3c.dom.Document parse(Path file) throws IOException {
        try (InputStream in = Files.newInputStream(file)) {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setNamespaceAware(true);
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_DTD, "");
            factory.setAttribute(XMLConstants.ACCESS_EXTERNAL_SCHEMA, "");
            factory.setExpandEntityReferences(false);
            return factory.newDocumentBuilder().parse(in);
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessException("File mô tả " + file.getFileName() + " trong gói bị hỏng");
        }
    }

    private static NodeList byLocalName(org.w3c.dom.Document doc, String name) {
        return doc.getElementsByTagNameNS("*", name);
    }

    private static String firstText(org.w3c.dom.Document doc, String name) {
        NodeList nodes = byLocalName(doc, name);
        for (int i = 0; i < nodes.getLength(); i++) {
            String text = nodes.item(i).getTextContent();
            if (text != null && !text.isBlank()) return text.strip();
        }
        return null;
    }

    private static byte[] hmac(byte[] key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String b64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
