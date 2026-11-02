package com.math10.programs;

import com.math10.audit.service.AuditService;
import com.math10.common.exception.BusinessException;
import com.math10.common.exception.ResourceNotFoundException;
import com.math10.common.storage.R2StorageServiceImpl;
import com.math10.programs.dto.PpctDtos;
import com.math10.programs.dto.PpctDtos.ConfirmRequest;
import com.math10.programs.dto.PpctDtos.Dong;
import com.math10.programs.dto.PpctDtos.DongSua;
import com.math10.programs.dto.PpctDtos.Preview;
import com.math10.programs.support.PhanPhoiChuan;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Nhập PPCT thật: tách tệp → xem trước bảng đã gán mạch → ghi vào {@code program_strands}/{@code program_periods}.
 *
 * <p><b>Một đường, nhiều định dạng.</b> PDF thô đi qua {@link PpctExtractor} + {@link PpctSuyMach}
 * (máy đoán mạch, nhiều mức tin cậy); Word đi qua {@link PpctDocxReader}; Excel bảng phẳng đi qua
 * {@link PpctExcelReader} (bảng có cấu trúc, soi chặt). Mọi định dạng gặp nhau ở
 * {@code List<Dong>} rồi chung đuôi {@code dongGoi} + {@code phanPhoi}.
 * Đây là đường thay phần {@code SEED} — đúng việc mà cột {@code source} sinh ra để làm. Đường
 * {@code POST …/strands/seed} ({@link PhanPhoiChuan}) vẫn là đường "chưa có PPCT" và không đụng tới.
 *
 * <p><b>Ghi theo khớp {@code (strand_id, term, period_no)}, không xóa-rồi-ghi-lại.</b> Có dòng
 * {@code SEED} ở đúng chỗ thì UPDATE tại chỗ, <em>giữ {@code id}</em> để {@code assignments.anchor_period_id}
 * / {@code class_period_progress.period_id} / {@code program_resources.neo} không mồ côi. Không có thì
 * INSERT. Dòng {@code SEED} cũ không còn trong bảng mới thì xóa mềm. Vì UPDATE tại chỗ, đụng dòng
 * {@code MANUAL} là hủy sạch cả giao dịch — không có dòng nào bị xóa mềm dở dang.
 */
@Service
@RequiredArgsConstructor
public class PpctGhiService {

    private static final int TOI_DA_BYTE = 20 * 1024 * 1024;
    private static final String LOAI_PDF = "application/pdf";
    private static final String LOAI_DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    private static final String LOAI_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final String LOAI_XLS = "application/vnd.ms-excel";
    private static final String THU_MUC = "admin/ppct-imports/";

    private static final Set<String> PHAN_LOAI = Set.of("BAI_MOI", "ON_TAP", "KIEM_TRA", "THUC_HANH");

    private final R2StorageServiceImpl storage;
    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private final PpctConfigLoader configLoader;

    public Preview xemTruoc(long programId, MultipartFile file) {
        kiemChuongTrinh(programId);
        if (file == null || file.isEmpty()) throw new BusinessException("Tệp PPCT không được rỗng");
        if (file.getSize() > TOI_DA_BYTE) throw new BusinessException("Tệp PPCT vượt quá 20MB");
        String ten = file.getOriginalFilename() == null ? "ppct" : file.getOriginalFilename();
        String tenThuong = ten.toLowerCase(Locale.ROOT);
        boolean laPdf = tenThuong.endsWith(".pdf");
        boolean laDocx = tenThuong.endsWith(".docx");
        boolean laExcel = tenThuong.endsWith(".xlsx") || tenThuong.endsWith(".xls");
        if (!laPdf && !laDocx && !laExcel) {
            throw new BusinessException("Chỉ hỗ trợ file PPCT PDF, .docx, .xlsx hoặc .xls");
        }

        byte[] noiDung;
        try {
            noiDung = file.getBytes();
        } catch (IOException e) {
            throw new BusinessException("Không đọc được tệp tải lên");
        }
        String loai = laPdf ? LOAI_PDF : laDocx ? LOAI_DOCX : tenThuong.endsWith(".xls") ? LOAI_XLS : LOAI_XLSX;
        String objectKey = THU_MUC + UUID.randomUUID() + "-" + ten.replaceAll("[^A-Za-z0-9._-]", "_");
        storage.putObject(objectKey, noiDung, loai);

        if (laPdf) return xemTruocPdf(objectKey, noiDung, programId);
        if (laDocx) return xemTruocDocx(objectKey, noiDung, programId);
        return dongGoi(objectKey, PpctExcelReader.doc(noiDung));
    }

    private Preview xemTruocDocx(String objectKey, byte[] bytes, long programId) {
        List<Dong> docx = PpctDocxReader.doc(bytes);
        if (docx.stream().allMatch(d -> d.maMach() != null && !d.maMach().isBlank())) {
            return dongGoi(objectKey, docx);
        }

        List<PpctExtractor.HangTho> hang = docx.stream()
                .map(d -> new PpctExtractor.HangTho(d.tuan(), d.soTiet(), d.tieuDe())).toList();
        List<PpctSuyMach.TuKhoa> tuKhoa = configLoader.tuKhoa(programId).stream()
                .map(tk -> new PpctSuyMach.TuKhoa(tk.maMach(), tk.tuKhoa())).toList();
        List<PpctSuyMach.TietDoan> suy = PpctSuyMach.suy(hang, tuKhoa);
        List<Dong> ketQua = new ArrayList<>();
        for (int i = 0; i < docx.size(); i++) {
            Dong goc = docx.get(i);
            if (goc.maMach() != null && !goc.maMach().isBlank()) {
                ketQua.add(goc);
                continue;
            }
            PpctSuyMach.TietDoan doan = suy.get(i);
            ketQua.add(new Dong(i, doan.maMach(), PpctSuyMach.tenMach(doan.maMach()), goc.soTiet(),
                    goc.tuan(), goc.hocKy(), goc.phanLoai(), goc.tieuDe(), goc.lessonId(),
                    goc.lessonTitle(), doan.doTinCay(), doan.canhBao()));
        }
        return dongGoi(objectKey, ketQua);
    }

    private Preview xemTruocPdf(String objectKey, byte[] pdf, long programId) {
        List<PpctExtractor.HangTho> hang = PpctExtractor.tach(pdf);
        if (hang.isEmpty()) {
            return Preview.scan(objectKey, "Tệp không rút được bảng — có thể là bản scan. "
                    + "Hãy tải lên bản PDF gốc có chữ chọn được.");
        }
        List<PpctSuyMach.TuKhoa> tuKhoa = configLoader.tuKhoa(programId).stream()
                .map(tk -> new PpctSuyMach.TuKhoa(tk.maMach(), tk.tuKhoa())).toList();
        List<PpctSuyMach.TietDoan> doan = PpctSuyMach.suy(hang, tuKhoa);
        List<Dong> dong = new ArrayList<>();
        for (int i = 0; i < doan.size(); i++) {
            PpctSuyMach.TietDoan t = doan.get(i);
            dong.add(new Dong(i, t.maMach(), PpctSuyMach.tenMach(t.maMach()), t.soTiet(), t.tuan(),
                    t.hocKy(), t.phanLoai(), t.tieuDe(), t.lessonId(), null, t.doTinCay(), t.canhBao()));
        }
        return dongGoi(objectKey, dong);
    }

    /** Đuôi chung của cả hai đường: đếm mạch/tuần/lỗi và gói thành {@link Preview}. */
    private Preview dongGoi(String objectKey, List<Dong> dong) {
        Set<String> mach = new LinkedHashSet<>();
        int soTuan = 0;
        for (Dong d : dong) {
            mach.add(d.maMach());
            soTuan = Math.max(soTuan, d.tuan());
        }
        int soLoi = (int) dong.stream().filter(d -> !d.canhBao().isEmpty()).count();
        String thongDiep = "Đọc được " + dong.size() + " tiết · " + mach.size() + " mạch · " + soTuan + " tuần"
                + (soLoi == 0 ? "." : " — " + soLoi + " dòng máy chưa chắc, kiểm lại giúp.");
        return new Preview(objectKey, PpctDtos.SAN_SANG, soTuan, dong.size(), mach.size(), dong,
                dong.size() - soLoi, soLoi, thongDiep);
    }

    @Transactional
    public Map<String, Object> phanPhoi(long programId, ConfirmRequest req) {
        kiemChuongTrinh(programId);
        List<DongSua> ds = req.dong();
        if (ds == null || ds.isEmpty()) throw new BusinessException("Không có dòng nào để phân phối");

        Set<String> capTiet = new HashSet<>();
        for (DongSua d : ds) {
            if (d.maMach() == null || d.maMach().isBlank()) {
                throw new BusinessException("Dòng " + (d.chiSo() + 1) + " thiếu mã mạch");
            }
            if (!PHAN_LOAI.contains(d.phanLoai())) {
                throw new BusinessException("Loại tiết không hợp lệ: " + d.phanLoai());
            }
            if (!capTiet.add(khoaTiet(d.maMach(), d.hocKy(), d.soTiet()))) {
                throw new BusinessException("Trùng số tiết trong một mạch: "
                        + tenMachCua(d) + " · HK" + d.hocKy() + " tiết " + d.soTiet());
            }
        }

        Map<String, Long> machTheoMa = upsertMach(programId, ds);
        List<Long> idMach = new ArrayList<>(machTheoMa.values());

        Map<String, Long> seedHienCo = new HashMap<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "select id,strand_id,term,period_no from program_periods where source='SEED' and deleted_at is null"
                        + " and strand_id in (" + choTrong(idMach.size()) + ")", idMach.toArray())) {
            seedHienCo.put(khoaTiet(r.get("strand_id"), r.get("term"), r.get("period_no")),
                    ((Number) r.get("id")).longValue());
        }
        Set<String> manual = new HashSet<>();
        for (Map<String, Object> r : jdbc.queryForList(
                "select strand_id,term,period_no from program_periods where source='MANUAL' and deleted_at is null"
                        + " and strand_id in (" + choTrong(idMach.size()) + ")", idMach.toArray())) {
            manual.add(khoaTiet(r.get("strand_id"), r.get("term"), r.get("period_no")));
        }

        List<String> vuong = new ArrayList<>();
        for (DongSua d : ds) {
            if (manual.contains(khoaTiet(machTheoMa.get(d.maMach()), d.hocKy(), d.soTiet()))) {
                vuong.add(tenMachCua(d) + " · HK" + d.hocKy() + " tiết " + d.soTiet());
            }
        }
        if (!vuong.isEmpty()) {
            throw new BusinessException("Số tiết đã có dòng nhập tay chiếm chỗ: " + String.join(", ", vuong));
        }

        Set<Long> giuLai = new HashSet<>();
        int soTuan = 0;
        for (DongSua d : ds) {
            long sid = machTheoMa.get(d.maMach());
            soTuan = Math.max(soTuan, d.tuan());
            Long id = seedHienCo.get(khoaTiet(sid, d.hocKy(), d.soTiet()));
            if (id != null) {
                jdbc.update("""
                        update program_periods set week_no=?,term=?,title=?,period_kind=?,lesson_id=?,updated_at=now()
                        where id=?""", d.tuan(), d.hocKy(), d.tieuDe(), d.phanLoai(), d.lessonId(), id);
                giuLai.add(id);
            } else {
                giuLai.add(jdbc.queryForObject("""
                        insert into program_periods(strand_id,period_no,week_no,term,lesson_id,title,period_kind,source,created_at,updated_at)
                        values(?,?,?,?,?,?,?,'SEED',now(),now()) returning id""",
                        Long.class, sid, d.soTiet(), d.tuan(), d.hocKy(), d.lessonId(), d.tieuDe(), d.phanLoai()));
            }
        }

        List<Long> soTai = seedHienCo.values().stream().filter(id -> !giuLai.contains(id)).toList();
        if (!soTai.isEmpty()) {
            jdbc.update("update program_periods set deleted_at=now(),updated_at=now() where id in ("
                    + choTrong(soTai.size()) + ")", soTai.toArray());
        }
        capNhatTongTiet(idMach);

        int soMach = machTheoMa.size();
        audit.record("IMPORT_PPCT", "PROGRAM_PERIODS", programId, null,
                "objectKey=" + req.objectKey() + " soMach=" + soMach + " soTiet=" + ds.size() + " soTuan=" + soTuan);
        return Map.of("soMach", soMach, "soTiet", ds.size(), "soTuan", soTuan);
    }

    /**
     * Upsert mạch theo {@code (program_id, code)} lấy thẳng từ payload — không đọc config. Chương
     * trình chưa cấu hình phân phối vẫn nhập được (đường Excel bảng phẳng). Mạch đã có thì giữ
     * nguyên {@code name}/{@code order_index}; mạch mới xếp tiếp vào cuối.
     */
    private Map<String, Long> upsertMach(long programId, List<DongSua> ds) {
        LinkedHashMap<String, String> tenTheoMa = new LinkedHashMap<>();
        for (DongSua d : ds) tenTheoMa.putIfAbsent(d.maMach(), tenMachCua(d));

        Integer ke = jdbc.queryForObject(
                "select coalesce(max(order_index),0) from program_strands where program_id=? and deleted_at is null",
                Integer.class, programId);
        int keTiep = ke == null ? 0 : ke;

        Map<String, Long> machTheoMa = new HashMap<>();
        for (Map.Entry<String, String> e : tenTheoMa.entrySet()) {
            List<Long> cu = jdbc.queryForList(
                    "select id from program_strands where program_id=? and code=? and deleted_at is null",
                    Long.class, programId, e.getKey());
            if (!cu.isEmpty()) {
                machTheoMa.put(e.getKey(), cu.get(0));
            } else {
                machTheoMa.put(e.getKey(), jdbc.queryForObject("""
                        insert into program_strands(program_id,code,name,order_index,total_periods,created_at,updated_at)
                        values(?,?,?,?,0,now(),now()) returning id""",
                        Long.class, programId, e.getKey(), e.getValue(), ++keTiep));
            }
        }
        return machTheoMa;
    }

    /** Giữ {@code program_strands.total_periods} khớp số tiết còn sống (kể cả {@code SEED} lẫn {@code MANUAL}). */
    private void capNhatTongTiet(List<Long> idMach) {
        for (Long sid : idMach) {
            Integer tong = jdbc.queryForObject(
                    "select count(*) from program_periods where strand_id=? and deleted_at is null",
                    Integer.class, sid);
            jdbc.update("update program_strands set total_periods=?,updated_at=now() where id=?",
                    tong == null ? 0 : tong, sid);
        }
    }

    private void kiemChuongTrinh(long programId) {
        Integer co = jdbc.queryForObject(
                "select count(*) from courses where id=? and deleted_at is null", Integer.class, programId);
        if (co == null || co == 0) throw new ResourceNotFoundException("Không tìm thấy chương trình");
    }

    /** Khóa một tiết trong payload/CSDL. Long/Integer/Short cùng giá trị số cho ra cùng chuỗi. */
    private static String khoaTiet(Object strandId, Object term, Object soTiet) {
        return strandId + "#" + term + "#" + soTiet;
    }

    private static String tenMachCua(DongSua d) {
        return d.tenMach() == null || d.tenMach().isBlank() ? d.maMach() : d.tenMach();
    }

    private String choTrong(int n) {
        return String.join(",", Collections.nCopies(n, "?"));
    }
}
