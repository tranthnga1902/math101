package com.math10.teachercontent;

import com.math10.common.exception.BusinessException;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Hai lỗi chồng lên nhau, gặp thật khi tải một đề giữa kỳ dạng PDF lên.
 *
 * <p>Lỗi dưới: thân câu hỏi được nối nhiều dòng bằng {@code '\n'}, lớp ký tự trong biểu thức tìm
 * mảnh toán lại chứa {@code \s}, nên mảnh cắt ra kéo theo cả dấu xuống dòng. JSON chắp bằng tay
 * không thoát ký tự điều khiển, Postgres từ chối nguyên câu insert.
 *
 * <p>Lỗi trên: khối catch ghi {@code status='FAILED'} ngay trong giao dịch đã hỏng, nên nó ném
 * 25P02 đè lên ngoại lệ thật. Người dùng chỉ thấy "Hệ thống đang gặp lỗi" và không ai lần ra được
 * lỗi dưới. Phép thử thứ hai canh đúng chỗ đó bằng một lỗi CSDL bất kỳ giữa chừng.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@DisplayName("Tải lên đề có câu nhiều dòng")
class TaiLenDeNhieuDongTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired TeacherContentPipelineService pipeline;

    /** Chỉ toàn ký tự ASCII ở hai dòng liền nhau thì mảnh toán vắt qua dấu xuống dòng. */
    private static final String DE = """
            Cau 1. Cho ham so f x
            y = 2x + 3.
            A. Dung
            B. Sai
            C. Khong xac dinh
            D. Ca ba
            """;

    @Test
    @DisplayName("Câu hỏi trải trên hai dòng vẫn lưu được, không vỡ JSON")
    void deNhieuDongVanTaiLenDuoc() {
        long nguon = nguon(giaoVien("nhieudong"));

        var ketQua = pipeline.parse(nguon, tep(DE), "TXT");

        assertThat(ketQua.status()).isEqualTo("PARSED");
        assertThat(ketQua.questions()).isEqualTo(1);

        Long cauHoi = jdbc.queryForObject(
                "select id from extracted_questions where source_document_id=?", Long.class, nguon);
        assertThat(jdbc.queryForObject(
                "select options_json->>'A' from extracted_questions where id=?", String.class, cauHoi))
                .as("đọc lại được bằng toán tử jsonb nghĩa là JSON hợp lệ thật")
                .isEqualTo("Dung");

        String manh = jdbc.queryForObject(
                "select ast_json->>'source' from math_fragments where question_id=? order by order_index limit 1",
                String.class, cauHoi);
        assertThat(manh)
                .as("mảnh toán phải thật sự chứa dấu xuống dòng, nếu không phép thử này không canh gì cả")
                .contains("\n")
                .contains("Cho ham so f x")
                .contains("y = 2x + 3.");
    }

    @Test
    @Transactional
    @DisplayName("Lỗi CSDL giữa chừng vẫn báo đúng việc, không bị 25P02 nuốt mất")
    void loiCsdlKhongNuotMatThongDiep() {
        long khongTonTai = 9_999_999L;

        assertThatThrownBy(() -> pipeline.parse(khongTonTai, tep(DE), "TXT"))
                .as("khối catch không được chạy thêm lệnh SQL trong giao dịch đã hỏng")
                .isInstanceOf(BusinessException.class)
                .hasMessageContaining("Không thể phân tích tài liệu");
    }

    private MockMultipartFile tep(String noiDung) {
        return new MockMultipartFile("file", "de.txt", "text/plain", noiDung.getBytes(StandardCharsets.UTF_8));
    }

    private long giaoVien(String nhan) {
        return jdbc.queryForObject("""
                insert into users(email,password_hash,full_name,username,role_code,status,created_at,updated_at)
                values(?,'x','T',?,'TEACHER','ACTIVE',now(),now()) returning id""",
                Long.class, nhan + System.nanoTime() + "@test.local", nhan + System.nanoTime());
    }

    private long nguon(long giaoVien) {
        return jdbc.queryForObject("""
                insert into teacher_source_documents(owner_teacher_id,title,file_type,storage_key,original_filename,status,created_at,updated_at)
                values(?,'De giua ky','TXT','x','de.txt','PROCESSING',now(),now()) returning id""",
                Long.class, giaoVien);
    }
}
