package com.math10.programs.controller;

import com.math10.audit.service.AuditService;
import com.math10.common.dto.ApiResponse;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.programs.PpctConfigLoader;
import com.math10.programs.support.PhanPhoiChuan;
import com.math10.programs.support.PhanPhoiChuan.CauHinhChuan;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Mạch và tiết của chương trình.
 *
 * <p>Cửa đọc ở đây không hỏi quyền gì ngoài "đã đăng nhập", và đó là chủ ý: bộ khung chương trình
 * — tuần này ba mạch đang ở tiết nào — không phải bí mật với ai. Thứ có quyền đọc riêng là
 * <em>học liệu</em> gắn vào tiết, và nó đi qua {@code LuongNoiDung}, không đi qua đây. Trộn hai
 * thứ ấy vào một chỗ là cách chắc chắn để sau này không ai biết luật đọc nằm ở đâu.
 */
@RestController @RequiredArgsConstructor
public class ProgramStrandController {
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final PpctConfigLoader configLoader;

    @GetMapping("/api/programs/{programId}/strands") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String,Object>>> strands(@PathVariable Long programId){
        return ApiResponse.ok("Mạch của chương trình", jdbc.queryForList("""
          select s.id,s.code,s.name,s.order_index,
                 count(p.id) so_tiet, min(p.week_no) tuan_dau, max(p.week_no) tuan_cuoi
          from program_strands s
          left join program_periods p on p.strand_id=s.id and p.deleted_at is null
          where s.program_id=? and s.deleted_at is null
          group by s.id,s.code,s.name,s.order_index
          order by s.order_index""", programId));
    }

    /**
     * "Tuần N học gì" — câu hỏi mà màn Hôm nay đặt ra mỗi lần mở.
     *
     * <p>Xếp theo thứ tự mạch rồi tới số tiết, chứ không theo id: hai tiết Hình học của cùng một
     * tuần phải ra đúng thứ tự 9 rồi 10, và Đại số phải nằm trên Hình học vì đó là thứ tự làn mà
     * màn Lộ trình vẽ. Bỏ mệnh đề sắp xếp thì màn hình vẫn chạy, chỉ là mỗi lần mở lại một kiểu.
     */
    @GetMapping("/api/programs/{programId}/weeks/{weekNo}") @PreAuthorize("isAuthenticated()")
    public ApiResponse<List<Map<String,Object>>> week(@PathVariable Long programId,@PathVariable int weekNo){
        return ApiResponse.ok("Tuần " + weekNo, jdbc.queryForList("""
          select p.id,p.strand_id,s.code strand_code,s.name strand_name,s.order_index strand_order,
                 p.period_no,p.week_no,p.term,p.lesson_id,p.title,p.period_kind,p.source
          from program_periods p
          join program_strands s on s.id=p.strand_id and s.deleted_at is null
          where s.program_id=? and p.week_no=? and p.deleted_at is null
          order by s.order_index,p.period_no""", programId, weekNo));
    }

    /**
     * Sinh phân phối chuẩn: bốn mạch, 35 tuần, 105 tiết.
     *
     * <p>Chạy lại được, và chạy lại chỉ đụng vào dòng {@code SEED} — dòng người nhập tay mang
     * {@code MANUAL} và không bị xóa. Đó là toàn bộ lý do cột {@code source} tồn tại.
     *
     * <p><b>Đụng số tiết của dòng nhập tay thì dừng, không lách.</b> Hai lối lách đều tệ hơn:
     * đánh số tiếp sau dòng tay thì bộ đếm không còn là bộ đếm của chương trình chuẩn nữa, mà bỏ
     * qua số bị chiếm thì mạch thủng một tiết mà không ai được báo. Dừng lại và nói rõ số nào đang
     * vướng thì người ta sửa được trong một phút.
     *
     * <p>Mạch đã có thì dùng lại theo mã, không tạo trùng và cũng không ghi đè tên. Ai đó đã đổi
     * "Thống kê và Xác suất" thành tên của trung tâm mình thì lượt sinh lại không được lấy mất.
     */
    @PostMapping("/api/admin/programs/{programId}/strands/seed") @PreAuthorize("hasRole('ADMIN')") @Transactional
    public ApiResponse<Map<String,Object>> seed(@PathVariable Long programId){
        Integer coChuongTrinh = jdbc.queryForObject(
                "select count(*) from courses where id=? and deleted_at is null", Integer.class, programId);
        if (coChuongTrinh == null || coChuongTrinh == 0)
            throw new ResourceNotFoundException("Không tìm thấy chương trình");

        // Tải cấu hình từ DB — ném BusinessException nếu chưa cấu hình
        CauHinhChuan cfg = configLoader.tai(programId);

        Map<String,Long> machTheoMa = new HashMap<>();
        for (PhanPhoiChuan.Mach m : PhanPhoiChuan.mach(cfg)) {
            List<Long> cu = jdbc.queryForList(
                    "select id from program_strands where program_id=? and code=? and deleted_at is null",
                    Long.class, programId, m.ma());
            machTheoMa.put(m.ma(), cu.isEmpty()
                    ? jdbc.queryForObject("""
                        insert into program_strands(program_id,code,name,order_index,created_at,updated_at)
                        values(?,?,?,?,now(),now()) returning id""", Long.class, programId, m.ma(), m.ten(), m.thuTu())
                    : cu.get(0));
        }

        List<Long> idMach = new ArrayList<>(machTheoMa.values());
        jdbc.update("update program_periods set deleted_at=now(),updated_at=now() where source='SEED' and deleted_at is null"
                + " and strand_id in (" + choTrong(idMach.size()) + ")", idMach.toArray());

        List<PhanPhoiChuan.Tiet> tiet = PhanPhoiChuan.tiet(cfg);
        // Xóa mềm ở trên đã dọn hết dòng SEED, nên thứ còn sót lại trên các mạch này đều là dòng
        // nhập tay. Hỏi một lượt rồi đối chiếu, chứ không hỏi nhiều lượt.
        List<Map<String,Object>> conLai = jdbc.queryForList(
                "select s.code,p.period_no from program_periods p join program_strands s on s.id=p.strand_id"
                + " where p.deleted_at is null and p.strand_id in (" + choTrong(idMach.size()) + ")", idMach.toArray());
        List<String> vuong = new ArrayList<>();
        for (PhanPhoiChuan.Tiet t : tiet)
            for (Map<String,Object> x : conLai)
                if (t.maMach().equals(x.get("code")) && t.soTiet() == ((Number) x.get("period_no")).intValue())
                    vuong.add(t.maMach() + " tiết " + t.soTiet());
        if (!vuong.isEmpty()) throw new BusinessException("Số tiết đã có dòng nhập tay chiếm chỗ: " + String.join(", ", vuong));

        jdbc.batchUpdate("""
            insert into program_periods(strand_id,period_no,week_no,term,title,period_kind,source,created_at,updated_at)
            values(?,?,?,?,?,?,'SEED',now(),now())""",
                tiet.stream().map(t -> new Object[]{machTheoMa.get(t.maMach()), t.soTiet(), t.tuan(),
                        t.hocKy(), t.tieuDe(), t.phanLoai()}).toList());

        audit.record("SEED", "PROGRAM_PERIODS", programId, null,
                "mach=" + machTheoMa.size() + " tiet=" + tiet.size() + " soTuan=" + cfg.soTuan());
        return ApiResponse.ok("Đã sinh phân phối chuẩn", Map.of(
                "soMach", machTheoMa.size(), "soTiet", tiet.size(), "soTuan", cfg.soTuan()));
    }

    private String choTrong(int n){ return String.join(",", java.util.Collections.nCopies(n, "?")); }
}
