package com.math10.documents;

import com.math10.common.exception.BusinessException;
import com.math10.documents.service.AdminDocumentFolderService;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@DisplayName("Cây thư mục của kho tài liệu dùng chung")
class ThuMucTaiLieuTest {

    @Autowired AdminDocumentFolderService service;
    @Autowired JdbcTemplate jdbc;

    @Test
    @DisplayName("Hai thư mục con khác cha được trùng tên, cùng cha thì không")
    void trungTenTheoCap() {
        var khoi10 = service.create("Khối 10 " + tag(), null);
        var khoi11 = service.create("Khối 11 " + tag(), null);
        service.create("Đề kiểm tra", khoi10.id());
        service.create("Đề kiểm tra", khoi11.id());
        assertThatThrownBy(() -> service.create("đề KIỂM tra", khoi10.id())).isInstanceOf(BusinessException.class);
    }

    @Test
    @DisplayName("Không chuyển được thư mục vào thư mục con của chính nó")
    void chanVong() {
        var cha = service.create("Cha " + tag(), null);
        var con = service.create("Con", cha.id());
        var chau = service.create("Cháu", con.id());
        assertThatThrownBy(() -> service.move(cha.id(), chau.id())).isInstanceOf(BusinessException.class);
        assertThatThrownBy(() -> service.move(cha.id(), cha.id())).isInstanceOf(BusinessException.class);
        assertThat(service.move(chau.id(), null).parentId()).isNull();
    }

    @Test
    @DisplayName("Xóa thư mục thì thư mục con và tài liệu được đưa lên cha, không mất gì")
    void xoaDuaNoiDungLenCha() {
        var cha = service.create("Chuyên đề " + tag(), null);
        var giua = service.create("Hàm số", cha.id());
        var con = service.create("Bài tập", giua.id());
        long taiLieu = themTaiLieu();
        service.moveDocuments(List.of(taiLieu), giua.id());

        service.delete(giua.id());

        assertThat(jdbc.queryForObject("select folder_id from documents where id = ?", Long.class, taiLieu)).isEqualTo(cha.id());
        assertThat(jdbc.queryForObject("select parent_id from document_folders where id = ?", Long.class, con.id())).isEqualTo(cha.id());
        assertThat(service.list()).extracting(AdminDocumentFolderService.FolderView::id).doesNotContain(giua.id());
        assertThat(service.list()).filteredOn(f -> f.id().equals(cha.id())).singleElement()
                .extracting(AdminDocumentFolderService.FolderView::documentCount).isEqualTo(1L);
    }

    @Test
    @DisplayName("Tài liệu riêng của giáo viên không bị xếp vào thư mục dùng chung")
    void khongDungTaiLieuRieng() {
        var thuMuc = service.create("Chung " + tag(), null);
        long giaoVien = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values (?, 'x', 'Giáo viên thư mục', ?, 'TEACHER', 'ACTIVE', now(), now()) returning id""",
                Long.class, tag() + "@thumuc.test", "gv-" + tag());
        long rieng = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, owner_id, created_at, updated_at)
                values ('Riêng', 'KHBD', 'TEACHER_ONLY', 'https://files.example.com/r.pdf', ?, now(), now())
                returning id""", Long.class, giaoVien);
        assertThatThrownBy(() -> service.moveDocuments(List.of(rieng), thuMuc.id())).isInstanceOf(BusinessException.class);
    }

    private long themTaiLieu() {
        return jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, created_at, updated_at)
                values ('Tài liệu thư mục', 'KHBD', 'TEACHER_ONLY', 'https://files.example.com/t.pdf', now(), now())
                returning id""", Long.class);
    }

    private static String tag() {
        return UUID.randomUUID().toString().substring(0, 8);
    }
}
