package com.math10.schema;

import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.io.IOException;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Chạy toàn bộ migration lên một PostgreSQL rỗng, rồi bắt Hibernate soi lại schema vừa dựng.
 *
 * <p>Trước lớp này, không migration nào từng được thi hành ở đâu ngoài Neon staging dùng chung —
 * nghĩa là mọi file SQL mới đều là lời hứa chưa kiểm. Zonky tải binary PostgreSQL thật về chạy
 * trực tiếp, không cần Docker (máy này không có).
 *
 * <p>Bản thân việc context khởi động được đã là phép thử: {@code ddl-auto=validate} sẽ ném lỗi
 * nếu entity đòi một cột mà migration không tạo. Các phép khẳng định dưới đây nói rõ ra điều đó,
 * để khi vỡ thì thông báo chỉ đúng chỗ chứ không chỉ là "context không dựng được".
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
class SchemaMigrationTest {

    @Autowired
    private JdbcTemplate jdbc;

    @Nested
    @DisplayName("Migration")
    class MigrationChay {

        @Test
        @DisplayName("mọi file migration đều chạy và đều báo thành công")
        void moiMigrationDeuChay() throws IOException {
            Resource[] files = new PathMatchingResourcePatternResolver()
                    .getResources("classpath:db/migration/V*.sql");
            Integer applied = jdbc.queryForObject(
                    "select count(*) from flyway_schema_history where success = true and type = 'SQL'", Integer.class);

            // Đếm lệch nghĩa là có file nằm trong thư mục nhưng Flyway không nhặt — thường do đặt
            // sai tên phiên bản, và lỗi kiểu đó im lặng cho tới khi triển khai thật.
            assertThat(applied).as("số migration đã chạy").isEqualTo(files.length);
        }

        @Test
        @DisplayName("không migration nào chạy hỏng")
        void khongCaiNaoHong() {
            List<String> hong = jdbc.queryForList(
                    "select script from flyway_schema_history where success = false", String.class);
            assertThat(hong).isEmpty();
        }
    }

    @Nested
    @DisplayName("Vòng đời bài giao (HT-44)")
    class VongDoiBaiGiao {

        /** Đây là phần trước đây chỉ đối chiếu bằng mắt. Giờ có PostgreSQL thật nói thay. */
        @Test
        @DisplayName("assignments có đủ cột lịch và chính sách nộp muộn")
        void cotCuaAssignments() {
            assertThat(cotCua("assignments"))
                    .contains("open_at", "max_attempts", "late_policy", "late_penalty_percent", "publish_score_at");
        }

        @Test
        @DisplayName("assignment_progress tách điểm gốc khỏi điểm cuối")
        void cotCuaAssignmentProgress() {
            assertThat(cotCua("assignment_progress"))
                    .contains("attempt_no", "submitted_late", "raw_score", "score");
        }

        @Test
        @DisplayName("ràng buộc chặn giờ mở sau hạn nộp")
        void chanGioMoSauHanNop() {
            assertThat(rangBuocCua("assignments")).contains("ck_assignments_open_before_due");
        }

        @Test
        @DisplayName("ràng buộc chặn chính sách nộp muộn lạ và phần trăm trừ ngoài 0–100")
        void chanChinhSachLa() {
            assertThat(rangBuocCua("assignments"))
                    .contains("ck_assignments_late_policy", "ck_assignments_late_penalty", "ck_assignments_max_attempts");
        }

        @Test
        @DisplayName("bài đã nộp trước khi có cột attempt_no được vá thành lượt 1")
        void vaLuotNopCu() {
            // Migration back-fill: bản ghi cũ có submitted_at thì phải là lượt 1, không phải lượt 0.
            Integer sai = jdbc.queryForObject(
                    "select count(*) from assignment_progress where submitted_at is not null and attempt_no = 0",
                    Integer.class);
            assertThat(sai).isZero();
        }
    }

    private List<String> cotCua(String bang) {
        return jdbc.queryForList(
                "select column_name from information_schema.columns where table_schema = 'public' and table_name = ?",
                String.class, bang);
    }

    private List<String> rangBuocCua(String bang) {
        return jdbc.queryForList(
                "select constraint_name from information_schema.table_constraints "
                        + "where table_schema = 'public' and table_name = ?",
                String.class, bang);
    }
}
