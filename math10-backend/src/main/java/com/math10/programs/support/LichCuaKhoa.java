package com.math10.programs.support;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Một chỗ duy nhất đọc lịch tuần của khóa.
 *
 * <p>Lát trước chỉ có màn quản trị hỏi tới bảng {@code course_weeks}, nên câu {@code select} nằm
 * ngay trong bộ điều khiển của nó là đủ. Màn Hôm nay là người đọc thứ hai, và người đọc thứ hai là
 * lúc phải tách ra — cùng lý do {@code AcademicBreaks} tồn tại: chỗ thứ hai sẽ là chỗ quên
 * {@code deleted_at} vào một ngày nào đó, và quên thì không có gì báo, chỉ là lịch có thêm một tuần
 * đã xoá.
 *
 * <p>Lớp này chỉ đọc. Việc sinh lịch nằm ở {@link LichTuan} và ở cửa ghi của quản trị — trộn vào
 * đây thì màn học sinh mang theo cả bộ sinh mà nó không bao giờ dùng.
 */
@Component
@RequiredArgsConstructor
public class LichCuaKhoa {

    private final JdbcTemplate jdbc;

    /** Một dòng lịch. {@code soTuan} rỗng nghĩa là tuần nghỉ. {@code id} rỗng là dòng chưa lưu. */
    public record Dong(Long id, Integer soTuan, LocalDate batDau, LocalDate ketThuc,
                       boolean nghi, String nhanNghi, boolean suaTay) {}

    /** Cả lịch, xếp theo ngày. */
    public List<Dong> tatCa(Long khoaId) {
        return jdbc.query(CAU_SELECT + " where course_instance_id=? and deleted_at is null order by starts_on",
                LichCuaKhoa::doc, khoaId);
    }

    /**
     * Dòng lịch phủ lên ngày này.
     *
     * <p>Rỗng có ba nghĩa khác nhau — chưa khai giảng, đã hết năm, chưa xếp lịch — và người gọi
     * phải phân biệt được ba nghĩa ấy, nên hàm này không tự đoán hộ.
     */
    public Optional<Dong> tai(Long khoaId, LocalDate ngay) {
        return dau(jdbc.query(CAU_SELECT + "\n" + """
                where course_instance_id=? and deleted_at is null and ? between starts_on and ends_on
                order by starts_on limit 1""",
                LichCuaKhoa::doc, khoaId, java.sql.Date.valueOf(ngay)));
    }

    /**
     * Tuần học mang số này.
     *
     * <p>Chương trình nói bằng số tuần ("tiết 14 ở tuần 12"), lịch nói bằng ngày, và đây là chỗ
     * đổi từ bên này sang bên kia. Rỗng nghĩa là khóa chưa xếp tới tuần ấy — người gọi phải nói
     * "chưa có ngày" chứ không được đoán một ngày gần đúng.
     */
    public Optional<Dong> tuan(Long khoaId, Integer soTuan) {
        if (soTuan == null) return Optional.empty();
        return dau(jdbc.query(CAU_SELECT + "\n" + """
                where course_instance_id=? and deleted_at is null and week_no=?
                limit 1""",
                LichCuaKhoa::doc, khoaId, soTuan));
    }

    /**
     * Tuần <em>học</em> đầu tiên bắt đầu từ ngày này trở đi.
     *
     * <p>Đây là câu trả lời cho "nghỉ tới bao giờ thì học lại". Bỏ qua dòng nghỉ chứ không lấy dòng
     * kế tiếp: nghỉ Tết chín ngày rơi vào hai tuần dương lịch thì dòng ngay sau vẫn là một tuần
     * nghỉ nữa, và trả về nó là nói với học sinh rằng thứ Hai tới đi học.
     */
    public Optional<Dong> tuanHocTuNgay(Long khoaId, LocalDate tuNgay) {
        return dau(jdbc.query(CAU_SELECT + "\n" + """
                where course_instance_id=? and deleted_at is null and week_no is not null and starts_on >= ?
                order by starts_on limit 1""",
                LichCuaKhoa::doc, khoaId, java.sql.Date.valueOf(tuNgay)));
    }

    /**
     * Khóa đang ở tuần thứ mấy — con số mà bốn dải hiển thị đo mọi thứ khác theo nó.
     *
     * <p>Hôm nay rơi vào tuần nghỉ thì trả về tuần <em>học</em> kế tiếp, không trả rỗng. Đây là cùng
     * câu trả lời mà màn Hôm nay đã chọn cho "nghỉ tới bao giờ thì học lại", và hai chỗ phải nói
     * giống nhau: nếu ở đây nghỉ Tết làm tuần hiện tại thành rỗng thì cả chương trình rơi tuột xuống
     * dải <em>đã học</em> suốt chín ngày, rồi tự nhảy về chỗ cũ — hỏng theo kiểu không ai báo được vì
     * nó tự khỏi.
     *
     * <p>Rỗng có nghĩa hẹp hơn nhiều: không còn tuần học nào từ hôm nay trở đi, tức là hết năm hoặc
     * chưa xếp lịch. Chỗ gọi phải hiểu rỗng là "không có mốc để so", không phải "tuần 0".
     */
    public Optional<Integer> tuanHienTai(Long khoaId, LocalDate ngay) {
        Optional<Dong> phu = tai(khoaId, ngay);
        if (phu.isPresent() && phu.get().soTuan() != null) return Optional.of(phu.get().soTuan());
        return tuanHocTuNgay(khoaId, ngay).map(Dong::soTuan);
    }

    /**
     * Khóa của một học sinh, khóa đang chạy hôm nay đứng trước.
     *
     * <p>Học sinh học hai khóa cùng lúc là chuyện thường ở trung tâm — Toán 10 và một lớp ôn thi.
     * Màn Hôm nay chỉ trả lời được cho một khóa, nên thứ tự ở đây <em>là</em> cách chọn: khóa nào
     * có tuần phủ lên hôm nay thì đó là khóa đang học, còn lại xếp theo khóa mở gần đây nhất.
     *
     * <p>Trả về cả danh sách chứ không chỉ khóa đầu, vì màn hình cần biết có bao nhiêu khóa mới
     * quyết định được có hiện nút đổi khóa hay không — và vì người gọi phải kiểm được khóa mà học
     * sinh chỉ đích danh có nằm trong danh sách này không.
     */
    public List<Long> khoaCuaHocSinh(Long hocSinhId, LocalDate ngay) {
        return khoaCuaHocSinh(hocSinhId, null, ngay);
    }

    /**
     * Cùng danh sách ấy, hẹp lại còn các khóa của một chương trình.
     *
     * <p>Một học sinh học Toán 10 và một lớp ôn thi là hai chương trình khác nhau, và màn nội dung
     * hỏi theo chương trình chứ không theo học sinh: hỏi "em đang ở tuần mấy" mà không nói chương
     * trình nào thì câu trả lời là tuần của khóa nào đó — đúng vào những hôm hai khóa lệch tuần,
     * cả màn hình xếp sai dải mà không có gì báo.
     *
     * <p>Là một tham số thêm vào đúng câu này chứ không phải một câu {@code select} thứ hai viết
     * riêng: hai câu trả lời cho "học sinh này có những khóa nào" là Đ4, và chỗ chúng sẽ lệch nhau
     * là {@code deleted_at} của một trong bốn bảng nối.
     *
     * <p>Số hiệu chương trình ghép thẳng vào câu vì nó là {@code Long} chứ không phải chữ người
     * dùng gõ — cùng lý do đã ghi ở {@code LuongNoiDung.toiDuocLop}.
     */
    public List<Long> khoaCuaHocSinh(Long hocSinhId, Long chuongTrinh, LocalDate ngay) {
        String loc = chuongTrinh == null ? "" :
                " and exists(select 1 from program_templates pt where pt.id=ci.template_id"
              + " and pt.deleted_at is null and pt.program_id=" + chuongTrinh + ")";
        return jdbc.queryForList("""
                select ci.id from course_instances ci
                join class_courses cc on cc.course_instance_id=ci.id and cc.deleted_at is null
                join class_students cs on cs.class_id=cc.class_id and cs.deleted_at is null
                where cs.student_id=? and ci.deleted_at is null""" + loc + "\n" + """
                group by ci.id, ci.starts_on
                order by (select count(*) from course_weeks cw
                          where cw.course_instance_id=ci.id and cw.deleted_at is null
                            and ? between cw.starts_on and cw.ends_on) desc,
                         ci.starts_on desc, ci.id
                """, Long.class, hocSinhId, java.sql.Date.valueOf(ngay));
    }

    /**
     * Học sinh này đang ở tuần thứ mấy của chương trình kia.
     *
     * <p>Gộp hai bước — chọn khóa, rồi hỏi tuần — vào một chỗ vì chỗ gọi nào cũng cần cả hai và
     * bước chọn khóa mới là bước dễ làm tắt: lấy khóa đầu tiên của học sinh mà quên lọc chương
     * trình thì vẫn ra một con số trông hợp lý.
     *
     * <p>Rỗng nghĩa là không có mốc để so — em chưa vào khóa nào của chương trình này, khóa chưa
     * xếp lịch, hoặc đã hết năm. Chỗ gọi phải hiểu rỗng là "không xếp dải được", không phải "tuần 0".
     */
    public Optional<Integer> tuanHienTaiCuaHocSinh(Long hocSinhId, Long chuongTrinh, LocalDate ngay) {
        return khoaCuaHocSinh(hocSinhId, chuongTrinh, ngay).stream().findFirst()
                .flatMap(khoa -> tuanHienTai(khoa, ngay));
    }

    private static final String CAU_SELECT =
            "select id,week_no,starts_on,ends_on,is_break,break_label,edited_by_hand from course_weeks";

    private static Dong doc(java.sql.ResultSet rs, int n) throws java.sql.SQLException {
        return new Dong(rs.getLong("id"),
                rs.getObject("week_no") == null ? null : rs.getInt("week_no"),
                rs.getDate("starts_on").toLocalDate(), rs.getDate("ends_on").toLocalDate(),
                rs.getBoolean("is_break"), rs.getString("break_label"), rs.getBoolean("edited_by_hand"));
    }

    private static Optional<Dong> dau(List<Dong> rows) {
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }
}
