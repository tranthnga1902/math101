package com.math10.documents;

import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.documents.service.LearningPackageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LearningPackageServiceTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef-test";

    @TempDir
    Path storage;

    @Test
    void scormLaunchesFirstItemResourceAndServesItsFiles() throws IOException {
        byte[] zip = zip(Map.of(
                "course/imsmanifest.xml", """
                        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_rootv1p1p2">
                          <organizations default="org1"><organization identifier="org1">
                            <item identifier="i1" identifierref="r1"/></organization></organizations>
                          <resources><resource identifier="r1" href="sco/start.html"/></resources>
                        </manifest>""",
                "course/sco/start.html", "<html><head></head><body>hi</body></html>",
                "course/sco/app.js", "1"));
        LearningPackageService service = new LearningPackageService(storage.toString(), SECRET);

        String launch = service.launchPath(7L, "r2://a.zip", () -> zip);

        assertThat(launch).startsWith(LearningPackageService.PATH_PREFIX).endsWith("/course/sco/start.html");
        String token = launch.substring(LearningPackageService.PATH_PREFIX.length()).split("/")[0];
        assertThat(Files.readString(service.resolve(token, "course/sco/app.js"))).isEqualTo("1");
        assertThatThrownBy(() -> service.resolve(token, "../../x")).isInstanceOf(ResourceNotFoundException.class);
        assertThatThrownBy(() -> service.resolve(token + "x", "course/sco/app.js")).isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    void tincanUsesLaunchElement() throws IOException {
        byte[] zip = zip(Map.of(
                "tincan.xml", "<tincan><activities><activity><launch>story.html?x=1</launch></activity></activities></tincan>",
                "story.html", "<html></html>"));
        LearningPackageService service = new LearningPackageService(storage.toString(), SECRET);

        assertThat(service.launchPath(1L, "k", () -> zip)).endsWith("/story.html?x=1");
    }

    @Test
    void singleHtmlFileLaunchesAsIndex() throws IOException {
        byte[] html = "<html><body>bai 1</body></html>".getBytes(StandardCharsets.UTF_8);
        LearningPackageService service = new LearningPackageService(storage.toString(), SECRET);

        String launch = service.launchHtmlPath(3L, "r2://bai-1.html", () -> html);

        assertThat(launch).startsWith(LearningPackageService.PATH_PREFIX).endsWith("/index.html");
        String token = launch.substring(LearningPackageService.PATH_PREFIX.length()).split("/")[0];
        assertThat(Files.readString(service.resolve(token, "index.html"))).contains("bai 1");
    }

    @Test
    void rejectsZipSlip() throws IOException {
        byte[] zip = zip(Map.of("../evil.html", "x"));
        LearningPackageService service = new LearningPackageService(storage.toString(), SECRET);

        assertThatThrownBy(() -> service.launchPath(1L, "evil", () -> zip)).isInstanceOf(BusinessException.class);
        assertThat(Files.exists(storage.resolve("evil.html"))).isFalse();
    }

    private static byte[] zip(Map<String, String> files) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            for (Map.Entry<String, String> file : files.entrySet()) {
                zip.putNextEntry(new ZipEntry(file.getKey()));
                zip.write(file.getValue().getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }
}
