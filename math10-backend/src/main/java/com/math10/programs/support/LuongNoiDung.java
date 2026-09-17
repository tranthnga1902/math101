package com.math10.programs.support;

import com.math10.configuration.security.CurrentUserService;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Luật đọc của luồng nội dung, để đúng một chỗ.
 *
 * <p>Bốn mảnh dưới đây trước nằm rải trong {@code ProgramContentController} vì lúc ấy chỉ có hai cửa
 * đọc và cả hai ở cùng một tệp. Sắp có cửa thứ ba — màn khóa học của học sinh — nên chúng phải rời
 * ra trước khi ai đó chép mảnh thứ hai.
 *
 * <p>Đây không phải dọn dẹp cho gọn. Lỗ vừa bịt ở lát trước sống được lâu chính vì hai cơ chế cùng
 * trả lời một câu hỏi mà lệch nhau: {@code lesson_documents} lọc đối tượng, {@code program_resources}
 * thì không, và cái không lọc là cái học sinh gọi được. Chốt của kế hoạch — <em>quyền đọc nằm trong
 * đúng một hàm</em> — chỉ giữ được nếu hàm ấy có một chỗ để ở.
 */
@Component
@RequiredArgsConstructor
public class LuongNoiDung {

    private final CurrentUserService current;
    private final JdbcTemplate jdbc;

    /**
     * Nối mỗi mục trong luồng học sang chính thứ mà nó trỏ tới.
     *
     * <p>Bốn phép nối đều là left join có chủ đích: một mục chỉ khớp đúng một bảng, ba bảng còn lại
     * để trống, và {@link #PHAT_DUOC} chỉ hỏi tới bảng ứng với loại của nó.
     */
    public static final String NOI_NGUON = """
      left join videos v         on pr.resource_type='VIDEO'         and v.id=pr.resource_ref_id  and v.deleted_at is null
      left join taxonomy_node tn on pr.resource_type='SPECIAL_TOPIC' and tn.id=pr.resource_ref_id and tn.deleted_at is null
      left join documents d      on pr.resource_type='DOCUMENT'      and d.id=pr.resource_ref_id  and d.deleted_at is null
      left join worksheets w     on pr.resource_type='EXERCISE'      and w.id=pr.resource_ref_id  and w.deleted_at is null
      """;

    /**
     * Mục có được phát ra cho người học không: hỏi trạng thái của <em>thứ được trỏ tới</em>, không
     * phải của mục.
     *
     * <p>Trước đây chỉ video bị hỏi, nên một mục PUBLISHED trỏ vào tài liệu còn là bản nháp — hoặc
     * vào bất cứ thứ gì vừa bị xoá — vẫn phát tiêu đề ra cho mọi người đã đăng nhập. Vá riêng cho
     * từng loại chính là cách lỗ video sống sót lâu như vậy, nên bốn loại đi chung một luật.
     *
     * <p>Nhánh {@code else false} là phần quan trọng nhất của biểu thức này: thêm một
     * {@code resource_type} mới mà quên khai ở đây thì nó im lặng không hiện, chứ không im lặng lọt
     * ra. Phiếu bài tập chỉ cần còn tồn tại vì {@code worksheets} không có cột trạng thái nào cả.
     */
    // Xuống dòng ở đầu là bắt buộc, không phải cho đẹp: khối văn bản của Java cắt sạch khoảng trắng
    // cuối mỗi dòng, nên chữ "and " đứng trước nó mất mất dấu cách và dán thành "andcase".
    public static final String PHAT_DUOC = "\n" + """
      case pr.resource_type
        when 'VIDEO'         then v.status='PUBLISHED'
        when 'SPECIAL_TOPIC' then tn.status='ACTIVE'
        when 'DOCUMENT'      then d.status='PUBLISHED'
        when 'EXERCISE'      then w.id is not null
        else false end""";

    /**
     * Đường dẫn phát ra ngoài cho một mục — và chỗ <em>không</em> phát.
     *
     * <p>Tài liệu có tệp thì trả rỗng, có chủ đích: {@code file_url} là đường dẫn kho, nó không hỏi
     * ai cả. Gửi cho người ngoài lớp vẫn mở được, và mở được mãi kể cả sau khi gỡ tài liệu khỏi bài.
     * Đường của học sinh đi bằng {@code file_asset_id} qua {@code /api/files/{id}} — chỗ duy nhất
     * kiểm quyền. Tài liệu <em>không</em> có tệp thì vẫn phát, vì đó là đường duy nhất tới nội dung
     * của chúng; kho cũ dựng bằng {@code file_url} thẳng, và bịt chỗ ấy là việc của tầng tệp.
     *
     * <p>Là hằng số dùng chung vì màn khóa học và màn Hôm nay cùng phát học liệu ra cho một học
     * sinh. Chép biểu thức sang màn thứ hai rồi bỏ mất mệnh đề {@code case} là một dòng khác biệt
     * nhìn không ra, và hậu quả là mọi tệp của mọi bài rời khỏi hàng rào quyền.
     */
    public static final String DUONG_DAN =
            "coalesce(v.video_url, case when d.file_asset_id is null then d.file_url end)";

    /**
     * Bài đã mở cho người học chưa — điều kiện trên <em>bài và chương</em>, không phải trên mục.
     *
     * <p>Mục có thể đã xuất bản và đúng đối tượng mà bài chứa nó còn ẩn. Màn khóa học xưa nay vẫn
     * hiểu vậy: bài {@code HIDDEN} hiện tên kèm ổ khóa và không phát học liệu nào. Nhưng luật ấy
     * trước chỉ sống trong một dòng Java của màn khóa học, nên cổng tệp không biết tới nó — giấu
     * học liệu khỏi bài ẩn xong vẫn phát tệp của chính học liệu ấy cho ai gọi thẳng số hiệu.
     *
     * <p>Hai dạng vì hai chỗ cần hai dạng: màn khóa học đã có sẵn trạng thái trong tay nên hỏi bằng
     * {@link #baiMo(String)}, các câu truy vấn thì nối chuỗi này vào. Chúng nằm cạnh nhau ở đây để
     * sửa một cái mà quên cái kia thì thấy ngay, chứ không phải để tiện chép.
     *
     * <p>Cần bí danh {@code l} cho bảng bài và {@code ch} cho bảng chương.
     */
    public static final String BAI_MO =
            " l.deleted_at is null and l.status='PUBLISHED' and ch.deleted_at is null and ch.status='PUBLISHED'";

    /** Cùng luật {@link #BAI_MO}, cho chỗ đã cầm sẵn trạng thái của bài. */
    public static boolean baiMo(String trangThaiBai) {
        return "PUBLISHED".equals(trangThaiBai);
    }

    /**
     * Thứ tự trên màn hình người học: đang học, rồi sắp học, rồi đã học.
     *
     * <p>Hai dải đầu xếp xuôi theo chương vì câu hỏi của chúng là "kế tiếp là gì". Dải đã học xếp
     * <em>ngược</em> vì câu hỏi của nó khác hẳn: mở lại phần đã qua gần như luôn là để tìm bài tuần
     * trước, không phải bài đầu năm. Xếp xuôi thì thứ hay cần nhất nằm cuối, và càng về cuối năm nó
     * càng lùi xa — hỏng dần chứ không hỏng hẳn, nên không ai báo.
     *
     * <p>Hai biểu thức phải chia dải y hệt nhau, nên cái thứ hai hỏi lại đúng hai điều kiện của cái
     * thứ nhất thay vì tự viết một phép thử "đã qua" riêng. Chương chưa xếp lịch rơi vào nhánh cuối
     * ở cả hai — trước lát này cũng vậy — nên chúng nằm chung dải đã học và cùng xếp ngược.
     */
    public static final String THU_TU = "\n" + """
      order by case when current_date between ps.starts_on and ps.ends_on then 0
                    when ps.starts_on>current_date then 1 else 2 end,
               case when current_date between ps.starts_on and ps.ends_on
                      or ps.starts_on>current_date then ch.order_index else -ch.order_index end,
               pr.order_index""";

    /**
     * Tuần của một dòng phân phối — trục thứ ba, và là trục <em>mềm</em>.
     *
     * <p>Hai trục kia chặn: nơi đến nói dòng này có tới bài ấy không, đối tượng nói ai đọc được. Trục
     * tuần không chặn gì cả, nó chỉ xếp thứ tự. Trước lát này thời gian là một cái cổng — chương chưa
     * tới lịch thì học liệu của nó không hiện — và cổng ấy vừa thừa vừa thiếu: thừa vì học sinh muốn
     * xem trước bài tuần sau là chuyện lành mạnh, thiếu vì nó che giúp những chỗ khai sai đối tượng
     * và làm người ta tưởng mình an toàn. Bỏ cổng đi thì <em>an toàn do đối tượng lo, thứ tự do thời
     * gian lo</em> — mỗi trục đúng một việc.
     *
     * <p>Chỉ {@code TIET} và {@code BAI} có tuần. Dòng của mạch trải cả năm, dòng toàn hệ thống không
     * thuộc chương trình nào, nút chuyên đề không phải một bài — ba loại ấy không có tuần nào đúng,
     * và đoán một tuần cho chúng là bịa dữ liệu. Chúng rơi vào dải <em>luôn hiện</em>, đúng chỗ.
     *
     * <p>{@code min(week_no)} cho dòng của bài vì một bài dạy nhiều tiết ở nhiều tuần: học liệu của
     * bài xuất hiện từ tuần đầu tiên bài ấy được dạy, không phải tuần cuối.
     *
     * <p>Là {@code left join lateral} chứ không phải biểu thức chép bốn lần vào bốn chỗ (dải, thứ tự
     * trong dải, cột trả ra, bộ lọc): bốn bản sao là bốn chỗ để sửa lệch nhau, và lệch giữa "dải nào"
     * với "xếp theo số nào" thì danh sách trông vẫn bình thường, chỉ sai thứ tự.
     */
    public static final String NOI_TUAN = """
      left join lateral (
        select case pr.noi_den_loai
                 when 'TIET' then (select p.week_no from program_periods p
                                    where p.id=pr.neo and p.deleted_at is null)
                 when 'BAI'  then (select min(p.week_no) from program_periods p
                                    where p.lesson_id=pr.lesson_id and p.deleted_at is null)
               end tuan) tt on true
      """;

    /**
     * Chương của dòng — cho cả dòng của bài lẫn dòng của tiết.
     *
     * <p>Dải <em>đã học</em> phình ra tới cả trăm mục khi cổng thời gian gỡ đi, và cách duy nhất giữ
     * nó đọc được là gom theo chương rồi thu gọn. Nhưng cột chương cũ hỏi bằng {@code pr.lesson_id},
     * nên từ lát nơi-đến trở đi mọi dòng của tiết đều trả về chương rỗng — thẻ trên màn hình in
     * "Chương null", và phần gom theo chương dồn tất cả vào một đống "chưa rõ".
     *
     * <p>Dòng của tiết đi vòng một nhịp: tiết biết bài của nó, bài biết chương. Dòng của mạch thì
     * không có chương nào đúng — một mạch trải nhiều chương — nên để rỗng, và rỗng ở đây là câu trả
     * lời thật chứ không phải chỗ chưa làm.
     *
     * <p>Thay hai câu con vô danh bằng một chỗ nối có tên vì màn hình cần ba cột cùng lúc (số hiệu,
     * tên, thứ tự chương): ba câu con là ba lần đi lại cùng một đường, và là ba chỗ để quên
     * {@code deleted_at}.
     */
    public static final String NOI_CHUONG = """
      left join lateral (
        select ch.id, ch.title, ch.order_index from chapters ch
         where ch.deleted_at is null
           and ch.id = case pr.noi_den_loai
                         when 'BAI'  then (select l.chapter_id from lessons l
                                            where l.id=pr.lesson_id and l.deleted_at is null)
                         when 'TIET' then (select l.chapter_id from lessons l
                                            join program_periods p on p.lesson_id=l.id
                                                                  and p.deleted_at is null
                                           where p.id=pr.neo and l.deleted_at is null)
                       end) cc on true
      """;

    /** Tên bốn dải, theo đúng thứ tự chúng nằm trên màn hình. */
    public static final String TUAN_NAY = "TUAN_NAY", SAP_TOI = "SAP_TOI",
                               LUON_HIEN = "LUON_HIEN", DA_HOC = "DA_HOC", TUONG_LAI = "TUONG_LAI";

    /**
     * Dòng này thuộc dải nào — cần {@link #NOI_TUAN} đã nối.
     *
     * <p>Bốn dải của kế hoạch là bốn dải <em>hiện trên màn chính</em>: tuần này, sắp tới (hai tuần),
     * luôn hiện, đã học. Nhưng tuần xa hơn hai tuần vẫn phải đọc được — kế hoạch nói rõ học sinh thấy
     * tài liệu cả năm, chỉ là chúng sống ở màn Lộ trình. Nên có dải thứ năm {@code TUONG_LAI}, và nó
     * là một <em>nhãn</em> chứ không phải một cái cổng: câu truy vấn vẫn trả nó ra, màn chính lọc nó
     * đi, màn Lộ trình giữ lại. Biến nó thành điều kiện {@code where} ở đây là dựng lại đúng cái cổng
     * thời gian vừa gỡ, chỉ khác chỗ đứng.
     *
     * <p>Khóa chưa có mốc tuần nào — chưa xếp lịch, hoặc đã hết năm — thì mọi dòng vào
     * {@code LUON_HIEN}. Không có mốc thì không so được, và xếp tất cả vào <em>đã học</em> hay
     * <em>sắp tới</em> đều là nói một điều mình không biết.
     */
    public static String dai(Integer tuanNay) {
        if (tuanNay == null) return "'" + LUON_HIEN + "'";
        return "case when tt.tuan is null then '" + LUON_HIEN + "'"
             + " when tt.tuan = " + tuanNay + " then '" + TUAN_NAY + "'"
             + " when tt.tuan between " + (tuanNay + 1) + " and " + (tuanNay + 2) + " then '" + SAP_TOI + "'"
             + " when tt.tuan > " + (tuanNay + 2) + " then '" + TUONG_LAI + "'"
             + " else '" + DA_HOC + "' end";
    }

    /**
     * Thứ tự bốn dải, và thứ tự bên trong mỗi dải.
     *
     * <p>Dải <em>đã học</em> xếp <strong>ngược</strong> — tuần 8 nằm trên tuần 3 — vì câu hỏi của nó
     * khác hẳn ba dải kia: mở lại phần đã qua gần như luôn là để tìm tuần vừa rồi, không phải tuần
     * đầu năm. Xếp xuôi thì thứ hay cần nhất nằm cuối, và càng về cuối năm nó càng lùi xa: hỏng dần
     * chứ không hỏng hẳn, nên không ai báo.
     *
     * <p>{@code TUONG_LAI} xếp sau {@code SAP_TOI} và trước {@code LUON_HIEN} để màn Lộ trình — màn
     * duy nhất giữ nó — đọc được một mạch xuôi theo tuần từ hôm nay tới cuối năm.
     */
    public static String thuTuBonDai(Integer tuanNay) {
        return "\n order by case " + dai(tuanNay)
             + "\n            when '" + TUAN_NAY + "'  then 0"
             + "\n            when '" + SAP_TOI + "'   then 1"
             + "\n            when '" + TUONG_LAI + "' then 2"
             + "\n            when '" + LUON_HIEN + "' then 3"
             + "\n            else 4 end,"
             + "\n          case when " + dai(tuanNay) + " = '" + DA_HOC + "'"
             + "\n               then -tt.tuan else tt.tuan end nulls first,"
             + "\n          pr.order_index, pr.id";
    }

    /**
     * Ai đọc được mục này — câu hỏi thứ hai, tách hẳn khỏi {@link #PHAT_DUOC} là câu hỏi thứ nhất.
     *
     * <p>Trộn hai câu ấy làm một chính là gốc của lỗ đã bịt: luật phát chỉ biết hỏi "đã xuất bản
     * chưa", nên tài liệu chỉ-giáo-viên mà đã xuất bản thì đậu, và đậu là ra tới học sinh. Trạng
     * thái nói mục đã sẵn sàng hay chưa; đối tượng nói nó sẵn sàng cho <em>ai</em>. Hai chuyện khác
     * nhau, hai cột, hai biểu thức.
     *
     * <p>Là một hàm dùng chung cho mọi cửa đọc, không phải mấy đoạn giống nhau chép nhiều chỗ. Các
     * cửa cùng trả lời về cùng một mục mà lệch nhau là cách mà lỗ trước sống được lâu như vậy.
     *
     * <p>Người không xác định được vai thì {@code requireRoleCode()} đã ném từ trước, nên ở đây
     * không có nhánh "không rõ là ai".
     */
    public String docDuoc() {
        return docDuoc(current.requireRoleCode());
    }

    /**
     * Cùng luật ấy, nhưng cho một vai nói thẳng ra.
     *
     * <p>Cổng tệp đã biết mình đang hỏi giùm ai — nó nhận mã học sinh làm tham số. Để nó hỏi lại
     * SecurityContext là để hai nguồn cùng trả lời một câu: chỉ cần hai nguồn lệch nhau một lần là
     * có cửa mở nhầm người, mà lệch thì không có gì báo.
     */
    public String docDuoc(String vai) {
        return "STUDENT".equals(vai)
                ? " and pr.audience='STUDENT_ALLOWED' and (pr.resource_type<>'DOCUMENT' or d.audience='STUDENT_ALLOWED')"
                : "";
    }

    /**
     * Dòng này có <em>tới</em> được bài kia không — câu hỏi thứ ba, tách hẳn khỏi hai câu trên.
     *
     * <p>Nơi đến và đối tượng là hai trục độc lập, và gộp chúng vào một cột "phạm vi" chính là gốc
     * của lỗ đã bịt ở lát trước. Giữ chúng rời ra thì cùng một tệp gắn được hai chỗ với hai đối
     * tượng khác nhau mà không phải nhân bản, và mỗi lần đều là một lần ghi rõ chủ ý.
     *
     * <p>Năm loại neo, và nhánh {@code else false} lại là phần quan trọng nhất — thêm một loại neo
     * mới mà quên khai ở đây thì nó im lặng không tới đâu cả, chứ không im lặng tới mọi nơi.
     * {@code CHUYEN_DE} rơi vào nhánh ấy có chủ đích: nút chuyên đề không phải một bài, và câu hỏi
     * "nút này có phải bài L không" không có câu trả lời đúng nào ngoài "không".
     *
     * <p>Nhận biểu thức chứ không nhận tham số vì chỗ gọi thường đã nối sẵn bảng bài — truyền
     * {@code "l.id"} thì câu không tốn tham số nào, truyền {@code "?"} thì tốn ba, và ba tham số
     * cùng một giá trị là ba chỗ để đếm lệch.
     */
    public static String toiDuocBai(String bai) {
        return "\n case pr.noi_den_loai"
             + "\n   when 'BAI'      then pr.lesson_id=" + bai
             + "\n   when 'HE_THONG' then true"
             + "\n   when 'TIET'     then exists(select 1 from program_periods p"
             + "\n                                where p.id=pr.neo and p.lesson_id=" + bai
             + "\n                                  and p.deleted_at is null)"
             + "\n   when 'MACH'     then exists(select 1 from program_periods p"
             + "\n                                where p.strand_id=pr.neo and p.lesson_id=" + bai
             + "\n                                  and p.deleted_at is null)"
             + "\n   else false end";
    }

    /**
     * Dòng này có thuộc chương trình kia không.
     *
     * <p>Câu hỏi của màn <em>chương trình</em>, khác hẳn câu {@link #toiDuocBai(String)} của màn
     * <em>bài</em>. Trước lát này màn chương trình hỏi bằng một phép nối — {@code join lessons} rồi
     * {@code join chapters} rồi {@code where ch.course_id=?} — và phép nối ấy chính là cái cổng đã
     * âm thầm nuốt mất bốn loại neo còn lại: dòng của tiết, của mạch, của toàn hệ thống, của nút
     * chuyên đề đều có {@code lesson_id} rỗng, nên phép nối trong loại bỏ hết. Chúng vẫn nằm trong
     * bảng, vẫn PUBLISHED, chỉ là không đường nào đọc tới — hỏng theo kiểu không ai báo được.
     *
     * <p>Ba loại có chương trình thì hỏi tới chương trình ấy; {@code HE_THONG} và {@code CHUYEN_DE}
     * thì không có, và không phải vì thiếu dữ liệu mà vì bản chất: tài liệu toàn hệ thống cố ý đứng
     * ngoài mọi chương trình, còn {@code taxonomy_node} là cây chủ đề dùng chung, chỉ có
     * {@code subject} chứ chưa từng có {@code program_id}. Hai loại ấy hiện ở mọi chương trình, và
     * đó là câu trả lời đúng chứ không phải chỗ nới lỏng.
     *
     * <p>Năm nhánh viết đủ, {@code else false} đứng cuối — cùng lý do như {@link #toiDuocBai(String)}:
     * thêm một loại neo mà quên khai ở đây thì nó im lặng không hiện ở chương trình nào, chứ không
     * im lặng hiện ở tất cả. Một nhánh {@code else true} gọn hơn đúng ba dòng và sai theo hướng
     * không sửa được sau khi đã phát ra.
     */
    public static String thuocChuongTrinh(String chuongTrinh) {
        return "\n case pr.noi_den_loai"
             + "\n   when 'BAI'       then exists(select 1 from lessons l2"
             + "\n                                 join chapters ch2 on ch2.id=l2.chapter_id"
             + "\n                                                  and ch2.deleted_at is null"
             + "\n                                where l2.id=pr.lesson_id and l2.deleted_at is null"
             + "\n                                  and ch2.course_id=" + chuongTrinh + ")"
             + "\n   when 'TIET'      then exists(select 1 from program_periods p2"
             + "\n                                 join program_strands s2 on s2.id=p2.strand_id"
             + "\n                                                       and s2.deleted_at is null"
             + "\n                                where p2.id=pr.neo and p2.deleted_at is null"
             + "\n                                  and s2.program_id=" + chuongTrinh + ")"
             + "\n   when 'MACH'      then exists(select 1 from program_strands s2"
             + "\n                                where s2.id=pr.neo and s2.deleted_at is null"
             + "\n                                  and s2.program_id=" + chuongTrinh + ")"
             + "\n   when 'HE_THONG'  then true"
             + "\n   when 'CHUYEN_DE' then true"
             + "\n   else false end";
    }

    /**
     * Nửa thứ hai của nơi đến: dòng hẹp tới một lớp thì chỉ người trong lớp ấy với tới.
     *
     * <p>Rời khỏi {@link #toiDuocBai(String)} vì hai nửa hỏi hai bảng khác nhau và một nửa phụ thuộc
     * vai còn nửa kia thì không. Người lớn không bị chặn ở đây: quản trị và giáo viên nhìn thấy cả
     * dòng gắn cho lớp khác, vì với họ "gắn cho lớp nào" là thông tin cần thấy chứ không phải hàng
     * rào — hàng rào của họ là {@link #docDuoc(String)}.
     *
     * <p>Số hiệu người đọc ghép thẳng vào câu chứ không đi bằng tham số, có chủ đích: mọi mảnh khác
     * trong lớp này đều không tốn tham số, và một mảnh lẻ có tham số thì chỗ gọi phải nhớ truyền
     * thêm đúng một giá trị ở đúng một vị trí — nhớ nhầm thì câu vẫn chạy, chỉ là chạy sai. Ghép
     * thẳng an toàn vì đây là {@code Long}, không phải chữ người dùng gõ vào.
     */
    public String toiDuocLop(String vai, Long nguoiDoc) {
        if (!"STUDENT".equals(vai)) return " true";
        return " (pr.lop_id is null or exists(select 1 from class_students cs2"
             + " where cs2.class_id=pr.lop_id and cs2.student_id=" + nguoiDoc
             + " and cs2.deleted_at is null))";
    }

    /**
     * Toàn bộ điều kiện của một mục đọc được: còn sống, đã phát, và đúng người.
     *
     * <p>Gộp ba mảnh vào một hàm vì cửa nào bỏ sót một mảnh cũng là một lỗ, mà bỏ sót thì không có
     * gì báo — chỉ là ai đó thấy thứ đáng lẽ không thấy. Cửa nào cần thêm điều kiện riêng thì nối
     * vào sau, còn ba mảnh này thì không chọn lẻ được.
     */
    public String docDuocDayDu() {
        return docDuocDayDu(current.requireRoleCode());
    }

    /** Cùng ba mảnh ấy, cho một vai nói thẳng ra — xem {@link #docDuoc(String)}. */
    public String docDuocDayDu(String vai) {
        return " pr.deleted_at is null and pr.status='PUBLISHED' and" + PHAT_DUOC + docDuoc(vai);
    }

    /**
     * Học sinh này có được mở tệp kia không.
     *
     * <p>Cổng tải tệp là cửa thứ tư, và là cửa dễ quên nhất vì nó không hiện gì lên màn hình: nó chỉ
     * nhận một con số. Giấu một mục khỏi danh sách mà cổng vẫn phát tệp của mục ấy cho ai đoán trúng
     * số hiệu thì việc giấu chẳng có nghĩa gì — nên cổng phải hỏi lại {@link #docDuocDayDu()}, cùng
     * cái hàm mà danh sách vừa hỏi, chứ không phải một câu truy vấn viết riêng cho nó.
     *
     * <p>Chuỗi nối lớp ở dưới trả lời câu hỏi thứ hai và là câu hỏi khác hẳn: <em>đi tới đâu</em>.
     * Mục có thể đọc được mà em không thuộc lớp được cấp, hoặc em thuộc lớp mà mục chưa xuất bản —
     * hai điều kiện độc lập nên cả hai đều phải hỏi.
     *
     * <p>Phép nối tới bài đi qua {@link #toiDuocBai(String)} chứ không so thẳng {@code pr.lesson_id}
     * nữa: từ lát nơi đến, một dòng còn tới bài bằng đường mạch, đường tiết, hoặc toàn hệ thống. Đây
     * là chỗ dễ hỏng nhất của cả lát — danh sách rộng ra mà cổng không rộng theo thì học liệu hiện
     * tên rồi bấm vào báo cấm, còn cổng rộng hơn danh sách thì đúng là lỗ. Hai bên phải hỏi chung
     * một hàm, và giờ chúng hỏi chung.
     *
     * <p>Câu hỏi thứ ba là {@link #BAI_MO}: bài chứa mục đã mở chưa. Trước lát này cổng không hỏi,
     * nên bài ẩn giấu được học liệu khỏi danh sách mà tệp của nó vẫn tải về được.
     *
     * <p>Chỉ tài liệu mới giữ tệp; video là đường dẫn ngoài, phiếu và chuyên đề có đường xem riêng.
     * Nên với mọi loại khác, {@code d} rỗng và phép so sánh thành sai — đúng ý, không phải tình cờ.
     *
     * <p>Vai ghi thẳng là {@code STUDENT} vì hàm này chỉ tới lượt khi người gọi đã trả lời xong cho
     * admin và giáo viên. Đổi chỗ ấy mà quên chỗ này thì thành hỏi luật học sinh cho người lớn.
     */
    public boolean moDuocTep(Long tepId, Long hocSinhId) {
        return moDuocNguon("d.file_asset_id", tepId, hocSinhId);
    }

    public boolean moDuocMuc(Long mucId, Long hocSinhId) {
        return moDuocNguon("pr.id", mucId, hocSinhId);
    }

    private boolean moDuocNguon(String cot, Long nguonId, Long hocSinhId) {
        return Boolean.TRUE.equals(jdbc.queryForObject("""
                select exists(
                  select 1 from program_resources pr
                """ + NOI_NGUON
                        + "  join lessons l on (" + toiDuocBai("l.id") + "\n  )\n" + """
                  join chapters ch on ch.id=l.chapter_id
                  join program_templates pt on pt.program_id=ch.course_id and pt.deleted_at is null
                  join course_instances ci on ci.template_id=pt.id and ci.deleted_at is null
                  join class_courses cc on cc.course_instance_id=ci.id and cc.deleted_at is null
                  join class_students cs on cs.class_id=cc.class_id and cs.deleted_at is null
                  """ + " where " + cot + "=? and cs.student_id=? and" + BAI_MO
                        + " and" + docDuocDayDu("STUDENT")
                        + " and" + toiDuocLop("STUDENT", hocSinhId) + ")",
                Boolean.class, nguonId, hocSinhId));
    }

    /** Một mục học liệu đã lọc xong quyền đọc, đủ để tầng trình bày chỉ việc vẽ ra. */
    public record MucHocLieu(
            Long id, String loaiNguon, Long nguonId, String tieuDe, boolean riengLop, int thuTu,
            /* Chương/bài mà nơi đến trỏ vào — rỗng với HE_THONG và MACH, để màn hình gom chương → bài. */
            Long chuongId, String chuongTen, Integer chuongThuTu,
            Long baiId, String baiTen, Integer baiThuTu) {
    }

    /**
     * Toàn bộ mục học liệu một lớp được thấy cho một buổi cụ thể — điểm vào duy nhất cho tab
     * <em>Học liệu</em> của Chi tiết lớp, để Controller không tự ráp lại ba trục quyền đọc.
     *
     * <p>{@code tietIds} là các {@code program_periods} thuộc buổi đó, do người gọi tính sẵn từ lịch
     * ({@code class_schedule} → {@code course_delivery_session_units}). Hàm này cố ý không tự tra —
     * biết buổi nào gồm những tiết nào là câu hỏi của miền lịch, còn hàm này chỉ trả lời quyền đọc và
     * nơi đến; ghép hai miền vào một hàm thì lần sau lịch đổi hình dạng, quyền đọc phải đổi theo dù
     * không liên quan. Buổi chưa gán tiết nào thì truyền danh sách rỗng — vẫn trả đúng phần "riêng
     * lớp", không phải lỗi.
     *
     * <p>Nơi đến hỏi bốn nhánh, cùng tinh thần {@code else false} như {@link #toiDuocBai(String)}:
     * {@code HE_THONG} luôn khớp (đây là nhánh mang cả "một lớp" — {@code HE_THONG} + {@code lop_id}
     * — tài liệu luôn hiện cho lớp này, không phụ thuộc buổi nào); {@code TIET}/{@code BAI}/
     * {@code MACH} chỉ khớp khi neo của dòng trúng đúng tiết, đúng bài, hoặc đúng mạch đang dạy trong
     * {@code tietIds}. {@code CHUYEN_DE} không có nhánh — nút chuyên đề không thuộc về một buổi nào,
     * nó hiện ở màn Lộ trình, không phải ở đây.
     *
     * <p>Cột {@code lop_id} hỏi riêng, tách khỏi bốn nhánh trên: dòng không hẹp lớp
     * ({@code lop_id is null}) thì mọi lớp học đúng nội dung ấy đều thấy; dòng hẹp lớp thì chỉ đúng
     * lớp ấy — bất kể lớp đọc là chính lớp truy vấn hay lớp khác, việc so khớp {@code lop_id} nằm
     * trong {@code where}, không nằm trong nhánh nơi đến, vì hai câu hỏi ("đi tới nội dung nào" và
     * "có hẹp riêng cho lớp nào không") độc lập với nhau.
     */
    public List<MucHocLieu> hocLieuChoBuoi(Long classId, List<Long> tietIds, Long nguoiDoc, String vai) {
        return hocLieu(classId, tietIds, nguoiDoc, vai, false);
    }

    /** Học liệu tổng của lớp không phụ thuộc việc đã tạo lịch hay chưa. */
    public List<MucHocLieu> hocLieuChoLop(Long classId, Long nguoiDoc, String vai) {
        return hocLieu(classId, List.of(), nguoiDoc, vai, true);
    }

    private List<MucHocLieu> hocLieu(Long classId, List<Long> tietIds, Long nguoiDoc, String vai,
                                    boolean toanLop) {
        String dsTiet = tietIds.isEmpty()
                ? "-1"
                : tietIds.stream().map(String::valueOf).collect(Collectors.joining(","));
        String sql = """
                select pr.id, pr.resource_type, pr.resource_ref_id, pr.title, pr.lop_id, pr.order_index,
                       cc.id chuong_id, cc.title chuong_ten, cc.order_index chuong_thu_tu,
                       lb.id bai_id, lb.title bai_ten, lb.order_index bai_thu_tu
                  from program_resources pr
                """ + NOI_NGUON + NOI_CHUONG + """
                  left join lateral (
                    select l.id, l.title, l.order_index from lessons l
                     where l.deleted_at is null
                       and l.id = case pr.noi_den_loai
                                    when 'BAI'  then pr.lesson_id
                                    when 'TIET' then (select p.lesson_id from program_periods p
                                                       where p.id=pr.neo and p.deleted_at is null)
                                  end) lb on true
                 where
                """ + docDuocDayDu(vai)
                + " and" + toiDuocLop(vai, nguoiDoc)
                + " and (pr.lop_id is null or pr.lop_id=" + classId + ")"
                + "\n   and (pr.noi_den_loai='HE_THONG'"
                + (toanLop ? "\n or (pr.noi_den_loai in ('BAI','TIET','MACH') and exists("
                    + "select 1 from class_courses cc join course_instances ci on ci.id=cc.course_instance_id"
                    + " and ci.deleted_at is null join program_templates pt on pt.id=ci.template_id"
                    + " and pt.deleted_at is null where cc.class_id=" + classId
                    + " and cc.deleted_at is null and " + thuocChuongTrinh("pt.program_id") + "))" : "")
                + "\n     or (pr.noi_den_loai='TIET' and pr.neo in (" + dsTiet + "))"
                + "\n     or (pr.noi_den_loai='BAI' and exists(select 1 from program_periods p3"
                + "\n           where p3.id in (" + dsTiet + ") and p3.lesson_id=pr.lesson_id"
                + "\n             and p3.deleted_at is null))"
                + "\n     or (pr.noi_den_loai='MACH' and exists(select 1 from program_periods p3"
                + "\n           where p3.id in (" + dsTiet + ") and p3.strand_id=pr.neo"
                + "\n             and p3.deleted_at is null)))"
                + "\n order by pr.lop_id nulls first, cc.order_index nulls first, lb.order_index nulls first, pr.order_index";
        return jdbc.query(sql, (rs, i) -> new MucHocLieu(
                rs.getLong("id"),
                rs.getString("resource_type"),
                rs.getLong("resource_ref_id"),
                rs.getString("title"),
                rs.getObject("lop_id") != null,
                rs.getInt("order_index"),
                rs.getObject("chuong_id", Long.class),
                rs.getString("chuong_ten"),
                rs.getObject("chuong_thu_tu", Integer.class),
                rs.getObject("bai_id", Long.class),
                rs.getString("bai_ten"),
                rs.getObject("bai_thu_tu", Integer.class)));
    }
}
