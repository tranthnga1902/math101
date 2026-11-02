package com.math10.programs;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Câu SQL chuyển ống, chạy lại trên dữ liệu do phép thử tự dựng.
 *
 * <p>Flyway chạy xong trước khi bất cứ phép thử nào kịp chèn một dòng, nên lượt chuyển thật luôn
 * chạy trên một cơ sở dữ liệu rỗng. Không có cách nào chạm vào nó ngoài cách này: đọc chính tệp
 * migration từ classpath và thi hành lại. Sửa tệp ấy thì phép thử này chạy bản đã sửa — đó là điểm
 * chính, chứ không phải chép câu SQL sang đây rồi canh một bản sao.
 *
 * <p>Ba điều cần đo, và không điều nào suy ra được từ điều kia:
 *
 * <ul>
 *   <li><b>Đủ dòng.</b> Mất một dòng giữa lượt chuyển là mất hẳn: bảng cũ không còn cửa đọc nào để
 *       ai đó tình cờ nhận ra thiếu.</li>
 *   <li><b>Đúng thứ tự tương đối.</b> Đây là thứ dễ hỏng nhất và im lặng nhất. Học liệu đảo chỗ vẫn
 *       hiện đủ trên màn hình, chỉ là bài chữa nằm trước bài giảng — không ai báo lỗi, và không ai
 *       biết nó từng đúng.</li>
 *   <li><b>Chạy lại không sinh thêm.</b> Lượt chuyển <em>sinh</em> mục mới trong kho từ dữ liệu cũ.
 *       Hỏng giữa chừng rồi chạy tiếp, hoặc khôi phục từ bản sao lưu, mà mỗi lượt lại nhân đôi kho
 *       thì đường sửa duy nhất là xoá tay từng dòng — trên dữ liệu thật, không có dấu vết nguồn.
 *       {@code legacy_lesson_resource_id} tồn tại để chuyện đó không xảy ra, và ca cuối là chỗ
 *       chứng minh nó thật sự làm được việc ấy.</li>
 * </ul>
 *
 * <p>Không dùng {@code lesson_resources} qua JPA vì entity của nó đã bị gỡ cùng module ghi cũ. Bảng
 * thì vẫn còn — không migration nào xoá gì — nên chèn thẳng bằng SQL là đúng hình dạng còn lại của
 * nó: một bảng lưu trữ, không phải một mô hình.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Chuyển ống cũ vào luồng nội dung")
class ChuyenOngCuVaoLuongTest {

    private static final String DUONG_MIGRATION =
            "db/migration/V202609011500__gom_lesson_resources_vao_luong.sql";

    @Autowired JdbcTemplate jdbc;

    private long bai;
    private long baiDaCoSan;

    @BeforeAll
    void dungDuLieu() throws Exception {
        Long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-CHUYENONG', 'Toan 10 chuyen ong', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        Long chuong = jdbc.queryForObject("""
                insert into chapters (course_id, title, order_index, status, created_at, updated_at)
                values (?, 'Chương 1 - Mệnh đề', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        bai = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Bài 1 - Mệnh đề toán học', 1, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);
        baiDaCoSan = jdbc.queryForObject("""
                insert into lessons (chapter_id, title, order_index, status, created_at, updated_at)
                values (?, 'Bài 2 - Tập hợp', 2, 'PUBLISHED', now(), now())
                returning id""", Long.class, chuong);
        Long tep = jdbc.queryForObject("""
                insert into file_assets (file_name, file_url, mime_type, file_size, created_at, updated_at)
                values ('menh-de.pdf', 'https://vi-du.test/menh-de.pdf', 'application/pdf', 4096, now(), now())
                returning id""", Long.class);

        // Ba dòng, ba loại, và order_index đảo so với thứ tự chèn: xếp đúng thứ tự chèn thì vẫn
        // xanh nếu câu SQL bỏ quên mệnh đề order by, nên phải để hai thứ ấy lệch nhau.
        ongCu("Video chua menh de", "VIDEO", "https://www.youtube.com/watch?v=md-01", null, null, 3);
        ongCu("Phieu bai tap menh de", "PDF", null, tep, null, 1);
        ongCu("Ghi chu nhanh menh de", "TEXT", null, null, "Mệnh đề là câu khẳng định đúng hoặc sai.", 2);

        // Bài thứ hai đã có sẵn một dòng trong ống mới. Chỉ mục duy nhất (lesson_id, order_index)
        // không cho hai mục trùng chỗ, nên dòng chuyển sang phải xếp *tiếp sau* chứ không chen vào.
        Long taiLieuCoSan = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, status, content_group, program_id, lesson_id, created_at, updated_at)
                values ('Tai lieu co san cua bai hai', 'KHBD', 'STUDENT_ALLOWED', '', 'PUBLISHED', 'REFERENCE', ?, ?, now(), now())
                returning id""", Long.class, chuongTrinh, baiDaCoSan);
        jdbc.update("""
                insert into program_resources (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience, created_at, updated_at)
                values (?, 'DOCUMENT', ?, 'Tai lieu co san cua bai hai', 1, 'PUBLISHED', 'STUDENT_ALLOWED', now(), now())""",
                baiDaCoSan, taiLieuCoSan);
        ongCu("Phieu bai tap tap hop", "PDF", null, tep, null, 1, baiDaCoSan);

        chayMigration();
    }

    @Test
    @DisplayName("mọi dòng còn sống đều sang tới ống mới, không sót loại nào")
    void chuyenDuDong() {
        assertThat(demTrongLuong(bai))
                .as("bảng cũ không còn cửa đọc nào, nên một dòng rơi lại là rơi hẳn — không ai tình cờ thấy")
                .isEqualTo(3);
        assertThat(jdbc.queryForList(
                "select resource_type from program_resources where lesson_id=? and deleted_at is null", String.class, bai))
                .as("video về kho video, năm loại còn lại về kho tài liệu; gộp nhầm là mất đường dẫn hoặc mất tệp")
                .containsExactlyInAnyOrder("VIDEO", "DOCUMENT", "DOCUMENT");
    }

    @Test
    @DisplayName("giữ nguyên thứ tự tương đối của ống cũ")
    void giuNguyenThuTu() {
        assertThat(tenTheoThuTu(bai))
                .as("đảo chỗ thì học liệu vẫn hiện đủ, chỉ là bài chữa nằm trước bài giảng — không ai báo lỗi")
                .containsExactly("Phieu bai tap menh de", "Ghi chu nhanh menh de", "Video chua menh de");
    }

    @Test
    @DisplayName("xếp tiếp sau những gì bài đã có, không chen vào chỗ đã dùng")
    void xepTiepSauChoDaCo() {
        assertThat(tenTheoThuTu(baiDaCoSan))
                .as("chỉ mục duy nhất (lesson_id, order_index) không cho hai mục trùng chỗ")
                .containsExactly("Tai lieu co san cua bai hai", "Phieu bai tap tap hop");
    }

    @Test
    @DisplayName("nội dung nằm trong dòng cũ tách ra thành mục trong kho, kèm dấu vết nguồn")
    void noiDungTachRaKho() {
        assertThat(jdbc.queryForObject("""
                select d.file_asset_id is not null from documents d
                where d.title='Phieu bai tap menh de'""", Boolean.class))
                .as("""
                    lesson_resources là bảng duy nhất nối một tệp với một bài, và cổng tải tệp lần \
                    theo đúng mối nối ấy. Bỏ ống cũ mà không mang cột này theo thì em bấm vào không \
                    tải được, hoặc tệp được phát bằng đường dẫn trần chẳng qua cửa nào""")
                .isTrue();
        assertThat(jdbc.queryForObject("""
                select content_markdown from documents where title='Ghi chu nhanh menh de'""", String.class))
                .as("dòng kiểu TEXT không có tệp nào; mất content_markdown là mất toàn bộ nội dung của nó")
                .contains("Mệnh đề là câu khẳng định");
        assertThat(jdbc.queryForObject("""
                select count(*) from videos where legacy_lesson_resource_id is not null
                  and title='Video chua menh de'""", Integer.class))
                .as("không có dấu vết nguồn thì lượt chạy sau không biết bỏ qua cái gì")
                .isEqualTo(1);
    }

    @Test
    @DisplayName("chạy lại lượt chuyển không sinh thêm bản sao nào")
    void chayLaiKhongSinhThem() throws Exception {
        int truocLuong = demTrongLuong(bai);
        int truocTaiLieu = demKho("documents");
        int truocVideo = demKho("videos");

        chayMigration();

        assertThat(demTrongLuong(bai)).as("dòng trỏ nhân đôi thì màn học sinh hiện hai lần một tài liệu").isEqualTo(truocLuong);
        assertThat(demKho("documents"))
                .as("""
                    lượt chuyển sinh mục mới từ dữ liệu cũ, nên hỏng giữa chừng rồi chạy tiếp là \
                    chuyện bình thường. Mỗi lượt lại nhân đôi kho thì đường sửa duy nhất là xoá tay \
                    từng dòng trên dữ liệu thật""")
                .isEqualTo(truocTaiLieu);
        assertThat(demKho("videos")).isEqualTo(truocVideo);
        assertThat(tenTheoThuTu(bai))
                .as("chạy lại mà thứ tự đổi thì lượt chạy thứ hai còn tệ hơn lượt hỏng")
                .containsExactly("Phieu bai tap menh de", "Ghi chu nhanh menh de", "Video chua menh de");
    }

    // ==================== dựng dữ liệu ====================

    /**
     * Thi hành chính tệp migration, không phải một bản chép.
     *
     * <p>Trình điều khiển PostgreSQL nhận nhiều câu ngăn bằng dấu chấm phẩy trong một lượt, nên cả
     * tệp đi qua một lời gọi. Phần DDL đầu tệp đều là {@code if not exists} nên lượt hai không hỏng.
     */
    private void chayMigration() throws Exception {
        jdbc.execute(new String(new ClassPathResource(DUONG_MIGRATION).getInputStream().readAllBytes(),
                StandardCharsets.UTF_8));
    }

    private void ongCu(String ten, String loai, String duongDan, Long tep, String chu, int thuTu) {
        ongCu(ten, loai, duongDan, tep, chu, thuTu, bai);
    }

    private void ongCu(String ten, String loai, String duongDan, Long tep, String chu, int thuTu, long baiHoc) {
        jdbc.update("""
                insert into lesson_resources (lesson_id, type, title, external_url, file_asset_id, text_content, order_index, created_at, updated_at)
                values (?,?,?,?,?,?,?, now(), now())""",
                baiHoc, loai, ten, duongDan, tep, chu, thuTu);
    }

    private List<String> tenTheoThuTu(long baiHoc) {
        return jdbc.queryForList(
                "select title from program_resources where lesson_id=? and deleted_at is null order by order_index",
                String.class, baiHoc);
    }

    private int demTrongLuong(long baiHoc) {
        return jdbc.queryForObject(
                "select count(*) from program_resources where lesson_id=? and deleted_at is null", Integer.class, baiHoc);
    }

    private int demKho(String bang) {
        return jdbc.queryForObject("select count(*) from " + bang + " where deleted_at is null", Integer.class);
    }
}
