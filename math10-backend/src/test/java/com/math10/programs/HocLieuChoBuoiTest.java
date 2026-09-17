package com.math10.programs;

import com.math10.programs.support.LuongNoiDung;
import io.zonky.test.db.AutoConfigureEmbeddedDatabase;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link LuongNoiDung#hocLieuChoBuoi} là cửa mới cho tab Học liệu của Chi tiết lớp — điểm vào duy
 * nhất thay vì để Controller tự ráp lại ba trục quyền đọc (đã phát, ai đọc được, đi tới đâu).
 *
 * <p>Bốn ca dưới đây phủ đúng ba trục cộng thêm trục mới của hàm này — <em>đi tới buổi nào</em>:
 * mục neo tiết thuộc buổi đang xem thì hiện, neo tiết của buổi khác thì không, dù cả hai đều
 * PUBLISHED và cùng đối tượng học sinh.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureEmbeddedDatabase(provider = AutoConfigureEmbeddedDatabase.DatabaseProvider.ZONKY)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
@DisplayName("Học liệu cho một buổi cụ thể của lớp")
class HocLieuChoBuoiTest {

    @Autowired JdbcTemplate jdbc;
    @Autowired LuongNoiDung luongNoiDung;

    private long lopA;
    private long lopB;
    private long emA;
    private long tiet1;
    private long tiet2;

    private long rTietDungBuoi;
    private long rTietKhacBuoi;
    private long rChiGiaoVien;
    private long rChuaXuatBan;
    private long rRiengLopB;

    @BeforeAll
    void dungDuLieu() {
        Long chuongTrinh = jdbc.queryForObject("""
                insert into courses (code, name, status, created_at, updated_at)
                values ('TOAN10-HOCLIEU', 'Toan 10 hoc lieu cho buoi', 'PUBLISHED', now(), now())
                returning id""", Long.class);
        Long mau = jdbc.queryForObject("""
                insert into program_templates (program_id, name, status, created_at, updated_at)
                values (?, 'Mẫu học liệu cho buổi', 'PUBLISHED', now(), now())
                returning id""", Long.class, chuongTrinh);
        Long khoa = jdbc.queryForObject("""
                insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
                values (?, 'Khóa học liệu cho buổi 2096/2097', '2096-2097', '2096-08-01'::date, '2097-05-31'::date, 'PUBLISHED', now(), now())
                returning id""", Long.class, mau);

        Long mach = jdbc.queryForObject("""
                insert into program_strands (program_id, code, name, order_index, created_at, updated_at)
                values (?, 'DAI_SO', 'Đại số', 1, now(), now())
                returning id""", Long.class, chuongTrinh);
        tiet1 = jdbc.queryForObject("""
                insert into program_periods (strand_id, period_no, week_no, term, title, period_kind, created_at, updated_at)
                values (?, 1, 1, 1, 'Tiết 1 - buổi đang xem', 'BAI_MOI', now(), now())
                returning id""", Long.class, mach);
        tiet2 = jdbc.queryForObject("""
                insert into program_periods (strand_id, period_no, week_no, term, title, period_kind, created_at, updated_at)
                values (?, 2, 1, 1, 'Tiết 2 - buổi khác', 'BAI_MOI', now(), now())
                returning id""", Long.class, mach);

        Long khoi = jdbc.queryForObject("select id from grades where deleted_at is null order by id limit 1", Long.class);
        lopA = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values ('HOCLIEU-10A', 'Lớp 10A học liệu cho buổi', ?, 'ACTIVE', now(), now())
                returning id""", Long.class, khoi);
        lopB = jdbc.queryForObject("""
                insert into classes (code, name, grade_id, status, created_at, updated_at)
                values ('HOCLIEU-10B', 'Lớp 10B học liệu cho buổi', ?, 'ACTIVE', now(), now())
                returning id""", Long.class, khoi);
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())", lopA, khoa);
        jdbc.update("insert into class_courses (class_id, course_instance_id, created_at, updated_at) values (?,?,now(),now())", lopB, khoa);

        emA = jdbc.queryForObject("""
                insert into users (email, password_hash, full_name, username, role_code, status, created_at, updated_at)
                values ('an@hoclieu.test', 'khong-dung-toi', 'An lớp A', 'an.lop.a.hoclieu', 'STUDENT', 'ACTIVE', now(), now())
                returning id""", Long.class);
        jdbc.update("insert into class_students (class_id, student_id, created_at, updated_at) values (?,?,now(),now())", lopA, emA);

        rTietDungBuoi = ganPhanPhoi("Học liệu tiết đang xem", "TIET", tiet1, "STUDENT_ALLOWED", "PUBLISHED", null, 1);
        rTietKhacBuoi = ganPhanPhoi("Học liệu tiết buổi khác", "TIET", tiet2, "STUDENT_ALLOWED", "PUBLISHED", null, 1);
        rChiGiaoVien = ganPhanPhoi("Đáp án chỉ giáo viên", "TIET", tiet1, "TEACHER_ONLY", "PUBLISHED", null, 2);
        rChuaXuatBan = ganPhanPhoi("Bản nháp chưa xuất bản", "TIET", tiet1, "STUDENT_ALLOWED", "DRAFT", null, 3);
        rRiengLopB = ganPhanPhoi("Tài liệu riêng lớp B", "HE_THONG", null, "STUDENT_ALLOWED", "PUBLISHED", lopB, 1);
    }

    @Test
    @DisplayName("Học sinh lớp A thấy đúng học liệu của buổi đang xem, không thấy buổi khác, không thấy giáo viên/nháp/lớp khác")
    void hocSinhChiThayDungBuoiCuaLop() {
        List<LuongNoiDung.MucHocLieu> ketQua =
                luongNoiDung.hocLieuChoBuoi(lopA, List.of(tiet1), emA, "STUDENT");

        assertThat(ketQua)
                .as("chỉ mục neo đúng tiết của buổi, đã xuất bản, đối tượng học sinh, không hẹp riêng lớp khác mới được lọt qua")
                .extracting(m -> m.id())
                .as("mục neo tiết khác buổi (%d), TEACHER_ONLY (%d), chưa xuất bản (%d), riêng lớp B (%d) đều không được lọt qua",
                        rTietKhacBuoi, rChiGiaoVien, rChuaXuatBan, rRiengLopB)
                .containsExactly(rTietDungBuoi);
    }

    @Test
    @DisplayName("Buổi chưa gán tiết nào vẫn không lỗi, chỉ đơn giản không thấy học liệu theo nội dung")
    void buoiKhongTietVanChayDuocKhongLoi() {
        List<LuongNoiDung.MucHocLieu> ketQua =
                luongNoiDung.hocLieuChoBuoi(lopA, List.of(), emA, "STUDENT");

        assertThat(ketQua)
                .as("danh sách tiết rỗng không phải lỗi — chỉ có nghĩa buổi này chưa gán tiết, nên không có học liệu theo nội dung nào khớp")
                .isEmpty();
    }

    @Test
    @DisplayName("Học liệu chương trình hiện trong lớp ngay cả khi chưa tạo lịch")
    void hocLieuLopKhongPhuThuocLich() {
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "STUDENT"))
                .extracting(LuongNoiDung.MucHocLieu::id)
                .containsExactlyInAnyOrder(rTietDungBuoi, rTietKhacBuoi);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    @DisplayName("Gỡ khóa học khỏi lớp thì không còn kế thừa tài liệu chương trình")
    void khongLayTaiLieuTuKhoaDaGo() {
        jdbc.update("update class_courses set deleted_at=now() where class_id=?", lopA);
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "STUDENT")).isEmpty();
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    void taiLieuGanBaiHienTrongKhoaLopVaBuoi() {
        long[] fixture = ganTaiLieuVaoBai("STUDENT_ALLOWED", "PUBLISHED");
        long resource = resourceCua(fixture[1]);
        assertThat(luongNoiDung.moDuocMuc(resource,emA)).isTrue();
        assertThat(luongNoiDung.moDuocMuc(resource,-1L)).isFalse();
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "STUDENT"))
                .extracting(LuongNoiDung.MucHocLieu::id).contains(resource);
        assertThat(luongNoiDung.hocLieuChoBuoi(lopA, List.of(tiet1), emA, "STUDENT"))
                .extracting(LuongNoiDung.MucHocLieu::id).contains(resource);
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "TEACHER"))
                .extracting(LuongNoiDung.MucHocLieu::id).contains(resource);
        jdbc.update("update lesson_documents set teacher_note='Đọc trước' where id=?", fixture[2]);
        assertThat(resourceCua(fixture[1])).isEqualTo(resource);
        jdbc.update("update lesson_documents set deleted_at=now() where id=?", fixture[2]);
        assertThat(luongNoiDung.moDuocMuc(resource,emA)).isFalse();
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "STUDENT"))
                .extracting(LuongNoiDung.MucHocLieu::id).doesNotContain(resource);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    void taiLieuGiaoVienVaBanNhapKhongLoChoHocSinh() {
        long[] fixture = ganTaiLieuVaoBai("TEACHER_ONLY", "PUBLISHED");
        long resource = resourceCua(fixture[1]);
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "STUDENT"))
                .extracting(LuongNoiDung.MucHocLieu::id).doesNotContain(resource);
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "TEACHER"))
                .extracting(LuongNoiDung.MucHocLieu::id).contains(resource);
        jdbc.update("update documents set audience='STUDENT_ALLOWED',title='Tên đã sửa' where id=?", fixture[1]);
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "STUDENT"))
                .extracting(LuongNoiDung.MucHocLieu::id).contains(resource);
        assertThat(jdbc.queryForObject("select title from program_resources where id=?", String.class, resource))
                .isEqualTo("Tên đã sửa");
        jdbc.update("update documents set status='DRAFT' where id=?", fixture[1]);
        assertThat(luongNoiDung.hocLieuChoLop(lopA, emA, "STUDENT"))
                .extracting(LuongNoiDung.MucHocLieu::id).doesNotContain(resource);
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    void taiLieuTrungCuChiCoMotDongPhanPhoiVaGoHetMoiBienMat() {
        long[] fixture = ganTaiLieuVaoBai("STUDENT_ALLOWED", "PUBLISHED");
        long resource = resourceCua(fixture[1]);
        jdbc.update("insert into lesson_documents(lesson_id,document_id,display_order) values(?,?,2)", fixture[0], fixture[1]);
        assertThat(resourceCua(fixture[1])).isEqualTo(resource);
        jdbc.update("update lesson_documents set deleted_at=now() where id=?", fixture[2]);
        assertThat(resourceCua(fixture[1])).isEqualTo(resource);
        jdbc.update("update lesson_documents set deleted_at=now() where lesson_id=?", fixture[0]);
        assertThat(jdbc.queryForObject("select count(*) from program_resources where id=? and deleted_at is null", Integer.class, resource)).isZero();
    }

    private long resourceCua(long document) {
        return jdbc.queryForObject("select id from program_resources where resource_type='DOCUMENT' and resource_ref_id=? and deleted_at is null", Long.class, document);
    }

    private long[] ganTaiLieuVaoBai(String audience, String status) {
        long program = jdbc.queryForObject("select s.program_id from program_periods p join program_strands s on s.id=p.strand_id where p.id=?", Long.class, tiet1);
        long chapter = jdbc.queryForObject("insert into chapters(course_id,title,order_index,status,created_at,updated_at) values(?,'Chương tài liệu',1,'PUBLISHED',now(),now()) returning id", Long.class, program);
        long lesson = jdbc.queryForObject("insert into lessons(chapter_id,title,order_index,status,created_at,updated_at) values(?,'Bài tài liệu',1,'PUBLISHED',now(),now()) returning id", Long.class, chapter);
        jdbc.update("update program_periods set lesson_id=? where id=?", lesson, tiet1);
        long document = jdbc.queryForObject("insert into documents(title,doc_type,audience,file_url,status,created_at,updated_at) values('Tài liệu đính kèm','KHBD',?,'https://example.test/material.pdf',?,now(),now()) returning id", Long.class, audience, status);
        long attachment = jdbc.queryForObject("insert into lesson_documents(lesson_id,document_id,display_order) values(?,?,1) returning id", Long.class, lesson, document);
        return new long[]{lesson,document,attachment};
    }

    // ==================== dựng dữ liệu ====================

    private long ganPhanPhoi(String tieuDe, String noiDenLoai, Long neo, String doiTuong, String trangThai,
                              Long lop, int thuTu) {
        Long tep = jdbc.queryForObject("""
                insert into file_assets (file_name, file_url, mime_type, file_size, created_at, updated_at)
                values (?, ?, 'application/pdf', 1024, now(), now())
                returning id""", Long.class, tieuDe + ".pdf", "https://vi-du.test/" + tieuDe);
        Long taiLieu = jdbc.queryForObject("""
                insert into documents (title, doc_type, audience, file_url, file_asset_id, status, created_at, updated_at)
                values (?, 'KHBD', ?, '', ?, 'PUBLISHED', now(), now())
                returning id""", Long.class, tieuDe, doiTuong, tep);
        return jdbc.queryForObject("""
                insert into program_resources
                    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience,
                     noi_den_loai, neo, lop_id, created_at, updated_at)
                values (null, 'DOCUMENT', ?, ?, ?, ?::varchar, ?::varchar, ?, ?, ?, now(), now())
                returning id""", Long.class, taiLieu, tieuDe, thuTu, trangThai, doiTuong, noiDenLoai, neo, lop);
    }
}
