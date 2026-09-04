package com.math10.programs;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** TẠM — soi kết quả tách PDF PPCT thật. Xóa sau khi chốt PpctExtractor/PpctSuyMach. */
class PpctExtractorProbeTest {

    private static final Path PDF = Path.of("C:/Users/Admin/Downloads/chuong_trinh_hoc_Toan_10_PPCT.pdf");

    @Test
    void inRaBang() throws Exception {
        if (!Files.exists(PDF)) {
            System.out.println("KHONG CO FILE: " + PDF);
            return;
        }
        List<PpctExtractor.HangTho> hang = PpctExtractor.tach(Files.readAllBytes(PDF));
        System.out.println("TONG DONG: " + hang.size());
        for (int i = 0; i < hang.size(); i++) {
            PpctExtractor.HangTho h = hang.get(i);
            System.out.printf("%3d | tuan=%-4s tiet=%-3d | %s%n",
                    i + 1, h.tuan(), h.tiet(), h.tieuDe());
        }

        System.out.println("\n=== SUY MACH ===");
        // Probe chạy không cần từ khóa DB — truyền list rỗng để suy theo liên mạch (nhiều THAP hơn)
        List<PpctSuyMach.TietDoan> doan = PpctSuyMach.suy(hang, java.util.List.of());
        java.util.Map<String, Integer> tong = new java.util.LinkedHashMap<>();
        for (PpctSuyMach.TietDoan t : doan) {
            tong.merge(t.maMach(), 1, Integer::sum);
            System.out.printf("tuan=%-3d ky=%d | %-9s tiet=%-3d | %-9s | %-4s | %s %s%n",
                    t.tuan(), t.hocKy(), t.maMach(), t.soTiet(), t.phanLoai(), t.doTinCay(),
                    t.tieuDe(), t.canhBao().isEmpty() ? "" : t.canhBao());
        }
        System.out.println("TONG THEO MACH: " + tong
                + "  cong=" + tong.values().stream().mapToInt(Integer::intValue).sum());
    }
}
