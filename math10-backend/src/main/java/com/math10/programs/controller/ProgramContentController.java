package com.math10.programs.controller;

import com.math10.common.dto.ApiResponse;
import com.math10.common.entity.ContentGroup;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.audit.service.AuditService;
import com.math10.configuration.security.CurrentUserService;
import com.math10.programs.support.LuongNoiDung;
import com.math10.programs.support.VideoThumbnails;
import com.math10.documents.support.DocumentUrls;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController @RequiredArgsConstructor
public class ProgramContentController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final LuongNoiDung luat;
    private final CurrentUserService current;
    private final com.math10.programs.support.LichCuaKhoa lich;

    @GetMapping("/api/programs/{programId}/chapters-by-time") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String,Object>>> chaptersByTime(@PathVariable Long programId,@RequestParam(required=false) java.time.LocalDate at){java.time.LocalDate date=at==null?java.time.LocalDate.now():at;return ApiResponse.ok("Chương theo thời gian",jdbc.queryForList("""
      select ch.id chapter_id,ch.title,ch.order_index,ps.starts_on,ps.ends_on,
      case when ? between ps.starts_on and ps.ends_on then 'CURRENT' when ps.starts_on>? then 'UPCOMING' else 'PAST' end time_group
      from chapters ch left join program_schedules ps on ps.chapter_id=ch.id and ps.course_id=ch.course_id and ps.deleted_at is null and ps.status='ACTIVE' and ps.course_instance_id is null
      where ch.course_id=? and ch.deleted_at is null
      order by ch.order_index""",date,date,programId));}

    // Nơi đến rộng ra bảy chỗ từ lát trước, nhưng đường đọc này vẫn hỏi bằng một phép nối vào bảng
    // bài — nên bốn loại neo còn lại nằm trong bảng mà không màn nào thấy. Thay phép nối bằng
    // LuongNoiDung.thuocChuongTrinh: hỏi thẳng "dòng này thuộc chương trình nào", không đi vòng qua
    // bài, và không nhân dòng khi một bài có nhiều lịch.
    //
    // Thời gian thôi làm cổng chặn, chỉ còn làm thứ tự. Trước đây học sinh chỉ thấy chương đang mở;
    // giờ thấy cả năm, xếp theo bốn dải quanh tuần hiện tại. Dải TUONG_LAI vẫn được trả ra chứ không
    // bị lọc ở đây — biến nó thành điều kiện where là dựng lại đúng cái cổng vừa gỡ, chỉ khác chỗ
    // đứng. Màn chính bỏ nó đi, màn Lộ trình giữ lại.
    //
    // toiDuocLop là phần bù lỗ, không phải phần thêm cho đẹp: dòng gắn riêng cho một lớp trước đây
    // lọt sang mọi học sinh của chương trình vì đường này chưa từng hỏi tới lớp. Cổng thời gian che
    // giúp một phần — dòng của lớp khác thường nằm ở chương chưa mở — và giờ tấm che ấy không còn.
    //
    // Người lớn không có khóa nên không có tuần hiện tại, và dai(null) cho mọi dòng vào LUON_HIEN:
    // họ thấy đủ, chỉ là không xếp theo dải. Đoán một tuần cho họ là bịa dữ liệu.
    @GetMapping("/api/programs/{programId}/resources") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String,Object>>> published(@PathVariable Long programId,@RequestParam(required=false) String type){
        String vai=current.requireRoleCode(); Long toi=current.requireUserId();
        Integer tuanNay="STUDENT".equals(vai)
                ?lich.tuanHienTaiCuaHocSinh(toi,programId,java.time.LocalDate.now()).orElse(null):null;
        String filter=type==null?"":" and pr.resource_type=?";
        Object[] args=type==null?new Object[]{}:new Object[]{type};
        List<Map<String,Object>> rows=jdbc.queryForList("""
          select pr.*,tt.tuan,cc.id chapter_id,cc.title chapter_title,cc.order_index chapter_order,
          v.video_url,v.thumbnail_url,v.duration_seconds,d.doc_type,d.file_url,d.file_asset_id,
          """+LuongNoiDung.dai(tuanNay)+" dai\n from program_resources pr\n"
          +LuongNoiDung.NOI_NGUON+LuongNoiDung.NOI_TUAN+LuongNoiDung.NOI_CHUONG
          +"where"+LuongNoiDung.thuocChuongTrinh(String.valueOf(programId))
          +" and"+luat.docDuocDayDu(vai)
          +" and"+luat.toiDuocLop(vai,toi)
          +filter+LuongNoiDung.thuTuBonDai(tuanNay),args);
        rows.forEach(row -> {
            DocumentUrls.maskContent(row,"resource_ref_id","doc_type","file_url");
            String url=(String)row.get("file_url");
            if(url!=null && url.startsWith("/api/documents/")) {
                row.put("file_url","/api/program-resources/"+row.get("id")+"/content."+DocumentUrls.extensionOf(url));
            } else if((url==null || url.isBlank()) && row.get("file_asset_id")!=null) {
                row.put("file_url","/api/files/"+row.get("file_asset_id")+"/download");
            }
        });
        return ApiResponse.ok("Nội dung chương trình",rows);
    }

    // Cùng một luật ĐỌC như published() ở trên, và đó là điểm chính: hai đường này phải trả lời
    // giống nhau về việc ai đọc được cùng một mục, nên chúng gọi chung đúng một hàm.
    //
    // Từ lát nơi đến, chúng khác nhau ở trục thứ hai: đường này hỏi "trên bài X có gì" nên nó hỏi
    // bằng toiDuocBai và thấy đủ bảy nơi đến, còn published() hỏi "trong chương trình P có gì" —
    // một dòng toàn hệ thống thuộc về mọi bài của P nên nới nó ra là nhân dòng, và chỗ đứng của
    // những dòng ấy trong danh sách chính là dải "luôn hiện" mà PP-6 mới định nghĩa. Nên published()
    // ở lại với bài cho tới lát ấy — cố tình, chứ không phải quên; ThuTuBonDaiTest đang canh đúng
    // thứ tự bốn dải của nó và PP-6 sẽ sửa cả hai cùng lượt.
    @GetMapping("/api/lessons/{lessonId}/program-resources") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String,Object>>> lesson(@PathVariable Long lessonId){return ApiResponse.ok("Luồng nội dung",jdbc.queryForList("""
      select pr.* from program_resources pr
      """+LuongNoiDung.NOI_NGUON
      +"where"+LuongNoiDung.toiDuocBai(String.valueOf(lessonId))
      +" and"+luat.docDuocDayDu()
      +" and"+luat.toiDuocLop(current.requireRoleCode(),current.requireUserId())
      +" order by pr.order_index"));}

    @PostMapping("/api/admin/lessons/{lessonId}/resources") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> add(@PathVariable Long lessonId,@RequestBody ResourceInput x){
        validateRef(x.resourceType(),x.resourceRefId());
        Long id=jdbc.queryForObject("insert into program_resources(lesson_id,exercise_type_id,resource_type,resource_ref_id,title,order_index,status,audience,created_at,updated_at) values(?,?,?,?,?,?,?,?,now(),now()) returning id",Long.class,lessonId,x.exerciseTypeId(),x.resourceType(),x.resourceRefId(),x.title(),x.orderIndex(),x.status()==null?"DRAFT":x.status(),doiTuong(x));
        return ApiResponse.created("Đã thêm vào luồng học",one("program_resources",id));
    }

    /**
     * Đối tượng của dòng gắn: mặc định theo tài liệu gốc, thu hẹp được, nới rộng thì không.
     *
     * <p>Mặc định phải là "theo tài liệu gốc" chứ không phải "cho học sinh", vì ca tốn kém nhất
     * trong cả hệ là người gắn quên khai rồi đáp án lọt ra. Quên thì phải rơi về phía an toàn, và
     * chỗ duy nhất biết được phía an toàn là chính tài liệu ấy.
     *
     * <p>Còn cái trần thì cứng: dấu chỉ-giáo-viên trên tài liệu là lời của nhà trường về chính tệp
     * đó, không phải gợi ý cho từng chỗ gắn. Muốn phát nó ra cho học sinh thì sửa tài liệu — một
     * việc đi qua {@code DocumentService} và có nhật ký — chứ không lách bằng một dòng gắn mới, vốn
     * lặng lẽ và không ai đi soát. Nên luật này áp cho cả quản trị, không chừa ai.
     *
     * <p>Ba loại còn lại không có khái niệm đối tượng nào để hỏi, nên trần của chúng là mở: khai gì
     * cũng được, không khai thì cho học sinh.
     */
    private String doiTuong(ResourceInput x){return doiTuong(x,false);}
    /** Chỗ neo có phải một tiết loại kiểm tra không. Chỉ tiết mới có loại; sáu nơi đến kia thì không. */
    private boolean tietKiemTra(String loai,Long neo){
        return "TIET".equals(loai)&&neo!=null&&Boolean.TRUE.equals(jdbc.queryForObject(
                "select period_kind='KIEM_TRA' from program_periods where id=? and deleted_at is null",
                Boolean.class,neo));
    }


    /**
     * Sàn của tiết kiểm tra: neo vào một tiết loại kiểm tra thì không khai gì nghĩa là chỉ-giáo-viên.
     *
     * <p>Cổng thời gian cũ che đề kiểm tra một cách tình cờ — đề nằm ở chương chưa mở nên học sinh
     * không tới được. Lát bốn dải gỡ cổng ấy, và thứ mất đi không phải một tính năng mà là một tấm
     * che. Ai gắn đề vào tiết kiểm tra rồi quên khai đối tượng thì trước đây được thời gian đỡ hộ,
     * giờ thì không.
     *
     * <p>Sàn chứ không phải trần: khai thẳng cho học sinh vẫn được, vì đề đã chấm xong phát lại cho
     * cả lớp là việc thường. Trần vẫn là dấu trên chính tài liệu. Nói cách khác chỗ này chỉ đổi câu
     * trả lời cho người im lặng, không lấy đi quyền của người nói rõ.
     */
    private String doiTuong(ResourceInput x,boolean tietKiemTra){
        String goc="DOCUMENT".equals(x.resourceType())
                ?String.valueOf(jdbc.queryForObject("select audience from documents where id=?",String.class,x.resourceRefId()))
                :"STUDENT_ALLOWED";
        if(rong(x.audience()))return tietKiemTra?"TEACHER_ONLY":goc;
        if(!List.of("STUDENT_ALLOWED","TEACHER_ONLY").contains(x.audience()))throw new BusinessException("Đối tượng không hợp lệ: "+x.audience());
        if("TEACHER_ONLY".equals(goc)&&"STUDENT_ALLOWED".equals(x.audience()))
            throw new BusinessException("Tài liệu này chỉ dành cho giáo viên nên không gắn cho học sinh được; muốn phát ra thì sửa đối tượng của chính tài liệu");
        return x.audience();
    }

    /**
     * Dựng nội dung mới rồi gắn ngay vào bài, trong một lượt.
     *
     * <p>{@link #add} chỉ trỏ vào thứ đã có trong kho, nên màn soạn bài không dùng được nó: người
     * soạn có một tệp trong tay, không có sẵn một dòng tài liệu để trỏ. Trước lát này màn ấy ghi
     * thẳng vào {@code lesson_resources} — bảng giữ nội dung nằm ngay trong dòng gắn — và bảng ấy
     * vừa mất cửa đọc cuối cùng. Di dân mang được những gì có sẵn lúc chạy, nhưng nó chạy một lần:
     * thiếu đường này thì mọi thứ admin gắn thêm từ giờ rơi vào bảng chết, không lỗi và không màn
     * hình trống, chỉ là học sinh không bao giờ thấy.
     *
     * <p>Hai bước đi chung một giao dịch chứ không tách thành hai lượt gọi từ trình duyệt. Lượt thứ
     * hai hỏng — mạng rớt, đóng tab — thì kho nhận một dòng không ai trỏ tới: nó vẫn hiện trong thư
     * viện, vẫn tìm ra được, và không màn hình nào cho thấy nó lạc.
     *
     * <p>Chỉ dựng được video và tài liệu. Phiếu bài tập và chuyên đề có đường dựng riêng với hàng
     * rào riêng, nên ở đây chúng đi qua {@link #add} như mọi thứ đã có sẵn.
     */
    @PostMapping("/api/admin/lessons/{lessonId}/resources/new") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> themMoi(@PathVariable Long lessonId,@RequestBody NewResourceInput x){
        if(rong(x.title()))throw new BusinessException("Học liệu phải có tiêu đề");
        Map<String,Object> cay=cayCuaBai(lessonId);
        String doiTuong=doiTuongMoi(x.audience());
        String trangThai=trangThai(x.status());
        Long ref=switch(x.resourceType()==null?"":x.resourceType()){
            case "VIDEO"->luuVideo(new VideoInput(x.title(),null,x.videoUrl(),x.storageKey(),null,null,
                    (Long)cay.get("course_id"),(Long)cay.get("chapter_id"),lessonId,"THEORY",trangThai));
            case "DOCUMENT"->luuTaiLieu(x,cay,lessonId,doiTuong,trangThai);
            default->throw new BusinessException("Chỉ dựng mới được video hoặc tài liệu; loại khác thì gắn thứ đã có bằng /resources");
        };
        Long id=jdbc.queryForObject("insert into program_resources(lesson_id,resource_type,resource_ref_id,title,order_index,status,audience,created_at,updated_at) values(?,?,?,?,?,?,?,now(),now()) returning id",
                Long.class,lessonId,x.resourceType(),ref,x.title(),x.orderIndex()==null?ketTiep(lessonId):x.orderIndex(),trangThai,doiTuong);
        return ApiResponse.created("Đã thêm vào luồng học",one("program_resources",id));
    }

    /**
     * Tài liệu mới của luồng học: dấu đối tượng ghi lên cả tài liệu lẫn dòng gắn.
     *
     * <p>Ghi hai chỗ nghe như thừa, nhưng hai chỗ trả lời hai câu khác nhau và {@link #doiTuong}
     * đọc chính cột trên tài liệu làm trần cho những lần gắn sau. Ghi lệch ở đây thì lần gắn sau
     * vào bài khác sẽ đọc được một cái trần rộng hơn thứ người soạn vừa khai — mà không có gì báo,
     * vì mỗi dòng nhìn riêng đều hợp lệ.
     *
     * <p>{@code file_url} giữ đường dẫn của tệp vì cột ấy không cho rỗng và thư viện tài liệu đọc
     * nó, nhưng đường học sinh thì đi bằng {@code file_asset_id} — con đường duy nhất có kiểm quyền.
     */
    private Long luuTaiLieu(NewResourceInput x,Map<String,Object> cay,Long lessonId,String doiTuong,String trangThai){
        if(x.fileAssetId()==null&&rong(x.textContent()))throw new BusinessException("Tài liệu phải có tệp hoặc nội dung chữ");
        String duongDan=x.fileAssetId()==null?"":String.valueOf(jdbc.queryForObject(
                "select file_url from file_assets where id=? and deleted_at is null",String.class,x.fileAssetId()));
        return jdbc.queryForObject("insert into documents(title,doc_type,audience,file_url,file_asset_id,content_markdown,status,content_group,program_id,lesson_id,created_at,updated_at) values(?,'KHBD',?,?,?,?,?,'REFERENCE',?,?,now(),now()) returning id",
                Long.class,x.title(),doiTuong,duongDan,x.fileAssetId(),rong(x.textContent())?null:x.textContent(),
                trangThai,cay.get("course_id"),lessonId);
    }

    /**
     * Đối tượng của nội dung vừa dựng: không có tài liệu gốc nào để làm trần, nên chỉ kiểm giá trị.
     *
     * <p>Khác {@link #doiTuong} ở chỗ ấy, và khác một cách có chủ đích: thứ này chưa tồn tại trước
     * lượt gọi, nên không có lời nào của nhà trường về nó để mà nới rộng. Trần bắt đầu từ đúng cái
     * người soạn khai ra ở đây.
     */
    private String doiTuongMoi(String x){
        if(rong(x))return "STUDENT_ALLOWED";
        if(!List.of("STUDENT_ALLOWED","TEACHER_ONLY").contains(x))throw new BusinessException("Đối tượng không hợp lệ: "+x);
        return x;
    }

    // Hỏi cây trước khi ghi bất cứ thứ gì: bài đã gỡ thì không dựng nội dung cho nó, và video còn
    // cần course_id lẫn chapter_id của bài để không lạc khỏi mọi màn hình.
    private Map<String,Object> cayCuaBai(Long lessonId){
        List<Map<String,Object>> rows=jdbc.queryForList("""
          select l.chapter_id,ch.course_id from lessons l
          join chapters ch on ch.id=l.chapter_id and ch.deleted_at is null
          where l.id=? and l.deleted_at is null""",lessonId);
        if(rows.isEmpty())throw new ResourceNotFoundException("Không tìm thấy bài học");
        return rows.get(0);
    }

    private int ketTiep(Long lessonId){return dem("select coalesce(max(order_index),0)+1 from program_resources where lesson_id=? and deleted_at is null",lessonId);}

    @PutMapping("/api/admin/lessons/{lessonId}/resources/reorder") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> reorder(@PathVariable Long lessonId,@RequestBody List<OrderInput> rows){
        for(OrderInput row:rows) if(jdbc.update("update program_resources set order_index=-?,updated_at=now() where id=? and lesson_id=? and deleted_at is null",row.orderIndex(),row.id(),lessonId)!=1) throw new ResourceNotFoundException("Không tìm thấy nội dung");
        for(OrderInput row:rows) jdbc.update("update program_resources set order_index=? where id=?",row.orderIndex(),row.id());
        return ApiResponse.ok("Đã lưu thứ tự nội dung",null);
    }

    /**
     * Sửa tên, trạng thái và đối tượng của một dòng gắn.
     *
     * <p>Đi qua đúng {@link #doiTuong} mà đường gắn đi, và đó là toàn bộ lý do hàm này nhận một
     * {@link ResourceInput} thay vì ba tham số rời: chặn trần ở lúc gắn mà để hở lúc sửa thì người
     * ta gắn hẹp rồi sửa rộng, cột vẫn đổi, và ai nhìn cũng tưởng trần còn nguyên. Hai đường ghi
     * vào cùng một cột thì phải hỏi cùng một hàm.
     *
     * <p>Nội dung — tệp, đường dẫn, đoạn văn — không sửa ở đây: chúng nằm trong kho, và kho có màn
     * hình riêng với nhật ký riêng. Dòng gắn chỉ nói bài này gọi thứ ấy là gì và phát cho ai.
     */
    @PutMapping("/api/admin/program-resources/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> sua(@PathVariable Long id,@RequestBody ResourceInput x){
        if(rong(x.title()))throw new BusinessException("Học liệu phải có tiêu đề");
        Map<String,Object> cu=dongGanHienCo(id);
        String doiTuong=doiTuong(new ResourceInput(null,String.valueOf(cu.get("resource_type")),
                (Long)cu.get("resource_ref_id"),x.title(),x.orderIndex(),x.status(),x.audience()));
        jdbc.update("update program_resources set title=?,status=?,audience=?,updated_at=now() where id=? and deleted_at is null",
                x.title(),trangThai(x.status()),doiTuong,id);
        return ApiResponse.ok("Đã cập nhật nội dung",one("program_resources",id));
    }

    private Map<String,Object> dongGanHienCo(Long id){
        List<Map<String,Object>> rows=jdbc.queryForList("select * from program_resources where id=? and deleted_at is null",id);
        if(rows.isEmpty())throw new ResourceNotFoundException("Không tìm thấy nội dung");
        return rows.get(0);
    }

    @DeleteMapping("/api/admin/program-resources/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> remove(@PathVariable Long id){if(jdbc.update("update program_resources set deleted_at=now(),updated_at=now() where id=? and deleted_at is null",id)!=1)throw new ResourceNotFoundException("Không tìm thấy nội dung");return ApiResponse.ok("Đã gỡ khỏi luồng học",null);}

    @GetMapping("/api/admin/videos") @PreAuthorize("hasRole('ADMIN')")
    public ApiResponse<List<Map<String,Object>>> videos(@RequestParam(required=false) Long programId){return ApiResponse.ok("Kho video",programId==null?jdbc.queryForList("select * from videos where deleted_at is null order by created_at desc"):jdbc.queryForList("select * from videos where deleted_at is null and program_id=? order by created_at desc",programId));}

    @PostMapping("/api/admin/videos") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> video(@RequestBody VideoInput x){
        Long id=luuVideo(x);
        Map<String,Object> moi=one("videos",id);
        audit.record("CREATE","VIDEO",id,null,tomTat(moi));
        return ApiResponse.created("Đã tạo video",moi);
    }

    @PutMapping("/api/admin/videos/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> updateVideo(@PathVariable Long id,@RequestBody VideoInput x){
        kiemVideo(x);
        Map<String,Object> cu=videoHienCo(id);
        jdbc.update("update videos set title=?,description=?,video_url=?,storage_key=?,thumbnail_url=?,duration_seconds=?,program_id=?,chapter_id=?,lesson_id=?,content_group=?,status=?,updated_at=now() where id=? and deleted_at is null",x.title(),x.description(),x.videoUrl(),x.storageKey(),anhBia(x),x.durationSeconds(),x.programId(),x.chapterId(),x.lessonId(),nhomNoiDung(x.contentGroup()),trangThai(x.status()),id);
        Map<String,Object> moi=one("videos",id);
        audit.record("UPDATE","VIDEO",id,tomTat(cu),tomTat(moi));
        return ApiResponse.ok("Đã cập nhật video",moi);
    }

    // Đọc hình dạng cũ trước khi lưu trữ: sau archive() thì không còn gì để ghi vào nhật ký, mà
    // dòng nhật ký xoá không kèm old_data thì chẳng cho ai biết thứ vừa mất là thứ gì.
    @DeleteMapping("/api/admin/videos/{id}") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Void> deleteVideo(@PathVariable Long id){
        Map<String,Object> cu=videoHienCo(id);
        archive("videos",id);
        audit.record("DELETE","VIDEO",id,tomTat(cu),null);
        return ApiResponse.ok("Đã lưu trữ video",null);
    }

    // Bốn endpoint /api/admin/special-topics đã gỡ cùng bảng của chúng: chuyên đề nay là nút của cây
    // phân loại, quản trị bằng /api/admin/taxonomy. Không màn hình nào từng gọi tới chúng.

    /**
     * Nhóm nội dung của video: để trống được (chưa phân loại), sai chính tả thì không.
     *
     * <p>CSDL đã có ràng buộc CHECK cùng danh sách này và nó mới là chốt chặn thật. Chặn thêm ở đây
     * chỉ để đổi một lỗi CSDL 500 khó hiểu thành một câu người dùng đọc được — cùng lý do
     * {@code apply(...)} bên lịch chương trình vẫn kiểm status trước khi ghi.
     */
    private String nhomNoiDung(String x){
        if(x==null||x.isBlank())return null;
        try{return ContentGroup.valueOf(x).name();}
        catch(IllegalArgumentException e){throw new BusinessException("Nhóm nội dung không hợp lệ: "+x);}
    }
    /**
     * Hàng rào của kho video. Trước lát này, sau cổng vai trò không còn gì cả: mọi lỗi nhập rơi
     * xuống ràng buộc CSDL rồi bật lên thành 500.
     *
     * <p>Điều kiện "phải có ít nhất một nguồn" là điều kiện nặng nhất trong đây, vì nó không phải
     * chuyện đổi mã lỗi. Cả {@code video_url} lẫn {@code storage_key} đều nullable, nên kho nhận
     * được một dòng có tiêu đề, có nhóm nội dung, hiện đầy đủ trên mọi danh sách, và chỉ khai ra là
     * rỗng đúng lúc học sinh bấm vào. Không có truy vấn nào tìm ra loại dòng ấy trừ khi biết trước
     * mà đi tìm.
     *
     * <p>Còn hai điều kiện về cây thì giữ cho video không lạc khỏi mọi màn hình: gắn vào chương của
     * chương trình khác thì màn hình bên nào cũng lọc mất nó.
     */
    private void kiemVideo(VideoInput x){
        if(x.title()==null||x.title().isBlank())throw new BusinessException("Video phải có tiêu đề");
        if(rong(x.videoUrl())&&rong(x.storageKey()))throw new BusinessException("Video phải có ít nhất một nguồn: đường dẫn hoặc khoá tệp đã tải lên");
        if(x.durationSeconds()!=null&&x.durationSeconds()<0)throw new BusinessException("Thời lượng không được là số âm");
        if(x.programId()==null)throw new BusinessException("Video phải thuộc một chương trình");
        if(dem("select count(*) from courses where id=? and deleted_at is null",x.programId())==0)throw new ResourceNotFoundException("Không tìm thấy chương trình");
        if(x.chapterId()!=null&&dem("select count(*) from chapters where id=? and course_id=? and deleted_at is null",x.chapterId(),x.programId())==0)throw new BusinessException("Chương không thuộc chương trình đã chọn");
        if(x.lessonId()==null)return;
        if(x.chapterId()!=null){if(dem("select count(*) from lessons where id=? and chapter_id=? and deleted_at is null",x.lessonId(),x.chapterId())==0)throw new BusinessException("Bài không thuộc chương đã chọn");return;}
        if(dem("select count(*) from lessons l join chapters ch on ch.id=l.chapter_id and ch.deleted_at is null where l.id=? and ch.course_id=? and l.deleted_at is null",x.lessonId(),x.programId())==0)throw new BusinessException("Bài không thuộc chương trình đã chọn");
    }

    /**
     * Ảnh bìa người dùng tự chọn luôn thắng; không có thì suy từ đường dẫn; không suy được thì để
     * trống. Xem {@link com.math10.programs.support.VideoThumbnails} về lý do không dán ảnh giữ chỗ.
     */
    private String anhBia(VideoInput x){return rong(x.thumbnailUrl())?VideoThumbnails.suyRa(x.videoUrl()):x.thumbnailUrl();}

    // Cột status có default 'DRAFT' nhưng câu lệnh chèn liệt kê nó tường minh, mà mặc định của
    // PostgreSQL chỉ áp khi cột bị bỏ khỏi danh sách. Nên mặc định phải nằm ở đây — giống add().
    private String trangThai(String x){return rong(x)?"DRAFT":x;}

    /**
     * Một chỗ dựng video, để hai cửa vào kho cùng đi qua đúng một hàng rào.
     *
     * <p>{@link #kiemVideo} gọi từ đây chứ không từ từng endpoint: cửa thứ hai quên gọi nó thì kho
     * nhận lại đúng loại dòng mà hàng rào ấy sinh ra để chặn — có tiêu đề, hiện đủ trên mọi danh
     * sách, và rỗng đúng lúc học sinh bấm vào.
     */
    private Long luuVideo(VideoInput x){
        kiemVideo(x);
        return jdbc.queryForObject("insert into videos(title,description,video_url,storage_key,thumbnail_url,duration_seconds,program_id,chapter_id,lesson_id,content_group,status,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,now(),now()) returning id",Long.class,x.title(),x.description(),x.videoUrl(),x.storageKey(),anhBia(x),x.durationSeconds(),x.programId(),x.chapterId(),x.lessonId(),nhomNoiDung(x.contentGroup()),trangThai(x.status()));
    }

    private boolean rong(String x){return x==null||x.isBlank();}
    private int dem(String sql,Object... args){Integer n=jdbc.queryForObject(sql,Integer.class,args);return n==null?0:n;}
    private Map<String,Object> videoHienCo(Long id){List<Map<String,Object>> rows=jdbc.queryForList("select * from videos where id=? and deleted_at is null",id);if(rows.isEmpty())throw new ResourceNotFoundException("Không tìm thấy video");return rows.get(0);}
    private String tomTat(Map<String,Object> row){return "title=%s,status=%s,contentGroup=%s".formatted(row.get("title"),row.get("status"),row.get("content_group"));}

    /**
     * Gắn một thứ đã có vào một nơi đến bất kỳ — cửa ghi của trục nơi đến.
     *
     * <p>{@link #add} vẫn ở lại và vẫn chỉ gắn được vào bài, vì đó là việc chiếm gần hết số lượt
     * gắn thật và đường của nó ngắn hơn hẳn. Cửa này là cửa cho sáu nơi đến còn lại; hai cửa ghi
     * vào cùng một bảng thì phải đi chung mọi hàng rào, nên chúng gọi chung {@link #validateRef},
     * {@link #doiTuong} và {@link #trangThai} chứ không tự kiểm lại theo cách riêng.
     *
     * <p>Hỏi xem chỗ neo có thật không trước khi ghi, chứ không tin số hiệu người gọi đưa. Một dòng
     * neo vào mạch không tồn tại thì không phát ra ở đâu cả và cũng không báo gì — đúng dạng dữ liệu
     * sai vô hình mà Đ3 nói tới, chỉ khác là lần này nó nằm ở cột mới toanh.
     *
     * <p>Trần đối tượng vẫn là trần của tài liệu: gắn toàn hệ thống không phải là đường lách để phát
     * tài liệu chỉ-giáo-viên ra cho học sinh. Ngược lại thì được — nới nơi đến rộng ra mà vẫn giữ
     * đối tượng hẹp chính là nhánh B mà kế hoạch muốn có.
     */
    @PostMapping("/api/admin/phan-phoi") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> phanPhoi(@RequestBody PhanPhoiInput x){
        if(rong(x.title()))throw new BusinessException("Dòng phân phối phải có tiêu đề");
        validateRef(x.resourceType(),x.resourceRefId());
        String loai=rong(x.noiDenLoai())?"BAI":x.noiDenLoai();
        Long neo=neoCua(loai,x);
        Long bai="BAI".equals(loai)?x.lessonId():null;
        if(x.lopId()!=null)conSong("classes",x.lopId());
        String doiTuong=doiTuong(new ResourceInput(null,x.resourceType(),x.resourceRefId(),
                x.title(),x.orderIndex(),x.status(),x.audience()),tietKiemTra(loai,neo));
        int thuTu=x.orderIndex()==null?ketTiepCua(loai,neo,bai,x.lopId()):x.orderIndex();
        Long id;
        try{
            id=jdbc.queryForObject("""
                    insert into program_resources
                      (lesson_id,resource_type,resource_ref_id,title,order_index,status,audience,
                       noi_den_loai,neo,lop_id,created_by,created_at,updated_at)
                    values(?,?,?,?,?,?,?,?,?,?,?,now(),now()) returning id""",
                    Long.class,bai,x.resourceType(),x.resourceRefId(),x.title(),thuTu,
                    trangThai(x.status()),doiTuong,loai,neo,x.lopId(),current.requireUserId());
        }catch(DuplicateKeyException e){
            // Hai chỉ mục duy nhất canh hai chuyện khác nhau, và người gắn cần biết mình vướng cái nào:
            // trùng chỗ đứng thì đổi thứ tự là xong, còn trùng nguồn thì dòng cũ đã có sẵn — gắn nữa
            // chỉ ra một dòng lặp trên màn hình. Trả 500 ở đây là bắt người ta đoán.
            throw new BusinessException(String.valueOf(e.getMessage()).contains("uq_program_resources_cho_dung")
                    ?"Chỗ ấy đã có dòng khác đứng ở vị trí này"
                    :"Nguồn này đã được gắn vào đúng chỗ ấy rồi");
        }
        return ApiResponse.created("Đã phân phối",one("program_resources",id));
    }

    /**
     * Chỗ neo của từng loại nơi đến, và chỗ <em>không</em> được neo.
     *
     * <p>CSDL đã canh đúng luật này bằng {@code ck_program_resources_neo} và đó mới là hàng rào
     * thật. Đây chỉ là để người gọi nhận được một câu tiếng Việt thay vì một lỗi ràng buộc — nên
     * hai bên phải nói cùng một luật, và sửa một bên mà quên bên kia thì cửa này báo sai chứ không
     * cho lọt.
     */
    private Long neoCua(String loai,PhanPhoiInput x){
        return switch(loai){
            case "HE_THONG"->{
                if(x.lessonId()!=null||x.neo()!=null)
                    throw new BusinessException("Phân phối toàn hệ thống thì không neo vào bài hay mạch nào");
                yield null;
            }
            case "BAI"->{
                if(x.lessonId()==null)throw new BusinessException("Nơi đến là bài thì phải nói bài nào");
                if(x.neo()!=null)throw new BusinessException("Nơi đến là bài thì neo nằm ở lessonId, không phải ở neo");
                conSong("lessons",x.lessonId());
                yield null;
            }
            case "MACH"->{conSong("program_strands",phaiCo(x,"mạch"));yield x.neo();}
            case "TIET"->{conSong("program_periods",phaiCo(x,"tiết"));yield x.neo();}
            case "CHUYEN_DE"->{conSong("taxonomy_node",phaiCo(x,"nút chuyên đề"));yield x.neo();}
            default->throw new BusinessException("Nơi đến không hợp lệ: "+loai);
        };
    }

    private Long phaiCo(PhanPhoiInput x,String ten){
        if(x.lessonId()!=null)throw new BusinessException("Nơi đến là "+ten+" thì không kèm bài");
        if(x.neo()==null)throw new BusinessException("Nơi đến là "+ten+" thì phải nói "+ten+" nào");
        return x.neo();
    }

    // Thứ tự đếm trong đúng nhóm chỗ đứng của dòng, không đếm chung cả bảng: hai dòng ở hai nơi đến
    // khác nhau không tranh nhau vị trí, mà chỉ mục duy nhất cũng canh theo đúng bộ khoá này.
    private int ketTiepCua(String loai,Long neo,Long bai,Long lop){
        return dem("""
                select coalesce(max(order_index),0)+1 from program_resources
                 where noi_den_loai=? and neo is not distinct from ?::bigint
                   and lesson_id is not distinct from ?::bigint
                   and lop_id is not distinct from ?::bigint
                   and deleted_at is null""",loai,neo,bai,lop);
    }

    /**
     * Hàng rào lúc gắn: nguồn phải có thật, và với chuyên đề thì phải còn dùng được.
     *
     * <p>Chỉ chuyên đề bị kiểm trạng thái ở đây, và đó là chủ ý chứ không phải bỏ sót. ARCHIVED và
     * MERGED là hai trạng thái cuối đời của một nút — nút đã gộp còn chuyển hết nội dung sang nút
     * khác — nên gắn chúng vào bài là gắn một cái vỏ, không bao giờ đúng. Còn tài liệu và video thì
     * bản nháp là chuyện thường: người soạn gắn vào luồng trước, xuất bản sau. Chặn chúng ở đây sẽ
     * ép người ta làm ngược thứ tự, nên đường đọc mới là chỗ lọc trạng thái của hai loại ấy.
     */
    private void validateRef(String type,Long id){
        switch(type){
            case "VIDEO"->conSong("videos",id);
            case "DOCUMENT"->conSong("documents",id);
            case "EXERCISE"->conSong("worksheets",id);
            case "SPECIAL_TOPIC"->{
                conSong("taxonomy_node",id);
                if(dem("select count(*) from taxonomy_node where id=? and status='ACTIVE'",id)==0)throw new BusinessException("Chuyên đề phải đang hoạt động mới gắn vào bài được");
            }
            default->throw new BusinessException("Loại tài nguyên không hợp lệ");
        }
    }
    private void conSong(String table,Long id){if(dem("select count(*) from "+table+" where id=? and deleted_at is null",id)==0)throw new ResourceNotFoundException("Không tìm thấy tài nguyên nguồn");}
    private Map<String,Object> one(String table,Long id){return jdbc.queryForMap("select * from "+table+" where id=?",id);}
    private void archive(String table,Long id){if(jdbc.update("update "+table+" set status='ARCHIVED',deleted_at=now(),updated_at=now() where id=? and deleted_at is null",id)!=1)throw new ResourceNotFoundException("Không tìm thấy tài nguyên");}
    public record ResourceInput(Long exerciseTypeId,String resourceType,Long resourceRefId,String title,Integer orderIndex,String status,String audience){}
    public record NewResourceInput(String resourceType,String title,String videoUrl,String storageKey,Long fileAssetId,String textContent,Integer orderIndex,String status,String audience){}
    public record OrderInput(Long id,Integer orderIndex){}
    public record PhanPhoiInput(String noiDenLoai,Long neo,Long lessonId,Long lopId,
                                String resourceType,Long resourceRefId,String title,
                                Integer orderIndex,String status,String audience){}
    public record VideoInput(String title,String description,String videoUrl,String storageKey,String thumbnailUrl,Integer durationSeconds,Long programId,Long chapterId,Long lessonId,String contentGroup,String status){}
}
