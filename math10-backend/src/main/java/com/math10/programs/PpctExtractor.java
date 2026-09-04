package com.math10.programs;

import org.apache.pdfbox.Loader;
import org.apache.pdfbox.contentstream.PDFGraphicsStreamEngine;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.graphics.image.PDImage;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;

import java.awt.geom.Point2D;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Tách bảng PPCT (Phân phối chương trình) từ PDF thô theo vị trí ký tự.
 *
 * <p>Bảng PPCT Toán 10 CTST có ba cột: TUẦN (ô gộp dọc mấy dòng), TIẾT (số thứ tự tiết
 * theo từng mạch — chạy song song nên số lặp lại), NỘI DUNG. Mỗi tuần gồm 2–4 dòng vật lý,
 * mỗi dòng là một tiết.
 *
 * <p><b>Số tuần in ở giữa ô gộp, không ở dòng đầu</b> — nên không suy tuần theo dòng in số,
 * cũng không theo "gần tâm nhất" (khối 2 và 4 dòng làm hỏng phép này). Thay vào đó đọc
 * <b>đường kẻ ngang</b>: đường ngăn giữa hai tuần kéo dài hết bảng (mép trái {@code x≈65}),
 * đường ngăn các dòng trong cùng một tuần chỉ bắt đầu từ cột TIẾT ({@code x≈116}). Mỗi cặp
 * đường {@code x≈65} liên tiếp là một khối tuần; các khối đánh số 1, 2, 3… xuôi theo tài liệu
 * (đo ở {@code scratchpad/ppct_probe.txt}). Cách này đúng bất kể khối 2, 3 hay 4 dòng. Nếu PDF
 * không có đường kẻ nào thì lùi về "số tuần in gần dòng nhất".
 *
 * <p><b>Không suy mạch ở đây.</b> Lớp này chỉ trả bảng thô đúng thứ tự tài liệu; việc gán
 * mạch cho từng tiết là của {@link PpctSuyMach}.
 *
 * <p>Thuần, không DB. Dùng lại khuôn {@code Loader.loadPDF(bytes)} của
 * {@code TeacherContentPipelineService}. PDF scan (không rút được text) → danh sách rỗng;
 * người gọi đổi thành trạng thái {@code UNSUPPORTED_SCAN}, <em>không bao giờ</em>
 * {@code FAILED}.
 */
public final class PpctExtractor {

    /** Một dòng thô của bảng, theo đúng thứ tự trong tài liệu. */
    public record HangTho(Integer tuan, int tiet, String tieuDe) {}

    // Dải x đo trên PDF thật (scratchpad/ppct_probe.txt): landscape A4, viền trái cột tiết ở
    // x≈116, nội dung bắt đầu từ x≈171. Cột tuần nằm bên trái x≈116.
    private static final float X_TIET = 116f;
    private static final float X_NOI_DUNG = 150f;
    // Ký tự cùng một dòng lệch baseline không quá chừng này (chiều cao dòng ~16pt).
    private static final float Y_SAI_SO = 3f;
    // Khoảng trống ngang tối thiểu để chèn một dấu cách giữa hai ký tự.
    private static final float KHE_CHU = 1.2f;
    // Đường kẻ ngăn hai tuần kéo tới mép trái bảng; đường trong-tuần bắt đầu từ cột tiết (x≈116).
    private static final float X_VIEN_KHOI = 95f;
    // Bỏ đường kẻ nằm trong dải tiêu đề trang (phía trên hàng dữ liệu đầu tiên, y≈105).
    private static final float Y_DAU_BANG = 100f;
    // Hai đường kẻ cách nhau dưới ngần này coi là một.
    private static final float GOP_VIEN = 4f;

    // Dòng tiêu đề trang / chú thích lặp lại ở đầu-cuối mỗi trang — không phải nội dung.
    private static final String[] RAC = {
            "PHÂN MÔN", "CHƯƠNG TRÌNH HỌC", "NỘI DUNG", "PPCT", "được cung cấp", "đối chiếu"
    };

    private PpctExtractor() {}

    public static List<HangTho> tach(byte[] pdf) {
        List<Tok> toks = new ArrayList<>();
        List<Vien> vien = new ArrayList<>();
        try (PDDocument doc = Loader.loadPDF(pdf)) {
            PDFTextStripper stripper = new PDFTextStripper() {
                @Override
                protected void writeString(String text, List<TextPosition> positions) {
                    int page = getCurrentPageNo();
                    for (TextPosition p : positions) {
                        String u = p.getUnicode();
                        if (u == null || u.isEmpty()) continue;
                        toks.add(new Tok(page, p.getXDirAdj(),
                                p.getXDirAdj() + p.getWidthDirAdj(), p.getYDirAdj(), u));
                    }
                }
            };
            stripper.setSortByPosition(true);
            stripper.getText(doc); // kích hoạt writeString; bỏ chuỗi trả về

            for (int i = 0; i < doc.getNumberOfPages(); i++) {
                PDPage page = doc.getPage(i);
                DoVien dv = new DoVien(page, i + 1);
                dv.processPage(page);
                vien.addAll(dv.bien);
            }
        } catch (Exception e) {
            return List.of();
        }
        if (toks.isEmpty()) return List.of();
        try {
            return dungHang(gomDong(toks), chiaKhoi(vien, doSoTrang(toks)));
        } catch (Exception e) {
            return List.of();
        }
    }

    private static int doSoTrang(List<Tok> toks) {
        int max = 1;
        for (Tok t : toks) max = Math.max(max, t.page);
        return max;
    }

    private static List<Dong> gomDong(List<Tok> toks) {
        toks.sort(Comparator.comparingInt((Tok t) -> t.page)
                .thenComparingDouble(t -> t.y)
                .thenComparingDouble(t -> t.x));

        List<List<Tok>> nhom = new ArrayList<>();
        List<Tok> hienTai = new ArrayList<>();
        for (Tok t : toks) {
            if (hienTai.isEmpty()) {
                hienTai.add(t);
                continue;
            }
            Tok mau = hienTai.get(0);
            if (t.page == mau.page && Math.abs(t.y - mau.y) <= Y_SAI_SO) {
                hienTai.add(t);
            } else {
                nhom.add(hienTai);
                hienTai = new ArrayList<>();
                hienTai.add(t);
            }
        }
        if (!hienTai.isEmpty()) nhom.add(hienTai);

        List<Dong> ket = new ArrayList<>();
        for (List<Tok> g : nhom) {
            g.sort(Comparator.comparingDouble(t -> t.x));
            ket.add(new Dong(g.get(0).page, g.get(0).y,
                    ghep(g, Float.NEGATIVE_INFINITY, X_TIET),
                    ghep(g, X_TIET, X_NOI_DUNG),
                    ghep(g, X_NOI_DUNG, Float.POSITIVE_INFINITY)));
        }
        return ket;
    }

    private static String ghep(List<Tok> g, float tu, float den) {
        StringBuilder b = new StringBuilder();
        float truoc = Float.NEGATIVE_INFINITY;
        for (Tok t : g) {
            if (t.x < tu || t.x >= den) continue;
            if (b.length() > 0 && t.x - truoc > KHE_CHU && b.charAt(b.length() - 1) != ' ') b.append(' ');
            b.append(t.text);
            truoc = t.endX;
        }
        return chuan(b.toString());
    }

    /**
     * Gộp đường kẻ mép-trái thành khối tuần, đánh số 1, 2, 3… xuôi theo trang rồi theo y.
     * Mỗi cặp đường liên tiếp trên cùng một trang là một khối.
     */
    private static List<Khoi> chiaKhoi(List<Vien> vien, int soTrang) {
        List<Khoi> khoi = new ArrayList<>();
        int tuan = 0;
        for (int p = 1; p <= soTrang; p++) {
            List<Float> y = new ArrayList<>();
            for (Vien v : vien) {
                if (v.page != p || v.top < Y_DAU_BANG) continue;
                boolean trung = false;
                for (float e : y) if (Math.abs(e - v.top) <= GOP_VIEN) { trung = true; break; }
                if (!trung) y.add(v.top);
            }
            y.sort(Comparator.naturalOrder());
            for (int i = 0; i + 1 < y.size(); i++) {
                khoi.add(new Khoi(p, y.get(i), y.get(i + 1), ++tuan));
            }
        }
        return khoi;
    }

    private static List<HangTho> dungHang(List<Dong> dong, List<Khoi> khoi) {
        // Lùi: nếu không đọc được đường kẻ nào, dùng số tuần in gần dòng nhất.
        List<Moc> moc = new ArrayList<>();
        if (khoi.isEmpty()) {
            for (Dong d : dong) {
                Integer w = so(d.cotTuan);
                if (w != null) moc.add(new Moc(d.page, d.y, w));
            }
        }

        List<HangTho> ket = new ArrayList<>();
        for (Dong d : dong) {
            Integer tiet = so(d.cotTiet);
            if (tiet == null) continue;            // dòng không số tiết = tiêu đề trang / rác
            if (laRac(d.tieuDe)) continue;
            String tieuDe = catRac(d.tieuDe);
            if (tieuDe.isBlank()) continue;
            ket.add(new HangTho(tuanCua(d, khoi, moc), tiet, tieuDe));
        }
        return ket;
    }

    private static Integer tuanCua(Dong d, List<Khoi> khoi, List<Moc> moc) {
        for (Khoi k : khoi) {
            if (k.page == d.page && d.y >= k.top - Y_SAI_SO && d.y < k.duoi - Y_SAI_SO) return k.tuan;
        }
        if (!khoi.isEmpty()) return null; // ngoài mọi khối (hiếm) — để người soát xử lý
        Integer tuan = null;
        float gan = Float.MAX_VALUE;
        for (Moc m : moc) {
            if (m.page != d.page) continue;
            float k = Math.abs(m.y - d.y);
            if (k < gan) {
                gan = k;
                tuan = m.tuan;
            }
        }
        return tuan;
    }

    private static boolean laRac(String s) {
        String x = s.toUpperCase(java.util.Locale.ROOT);
        for (String r : RAC) if (x.contains(r.toUpperCase(java.util.Locale.ROOT))) return true;
        return false;
    }

    /** Bỏ đuôi tiêu đề trang bị dính vào ô nội dung cuối trang ("... Trang 2 CHƯƠNG TRÌNH..."). */
    private static String catRac(String s) {
        int i = s.indexOf(" Trang ");
        if (i > 0) s = s.substring(0, i);
        for (String r : RAC) {
            int j = s.toUpperCase(java.util.Locale.ROOT).indexOf(r.toUpperCase(java.util.Locale.ROOT));
            if (j > 0) s = s.substring(0, j);
        }
        return chuan(s);
    }

    private static String chuan(String x) {
        return x.replace(' ', ' ').replaceAll("\\s+", " ").trim();
    }

    private static Integer so(String x) {
        if (x == null) return null;
        String d = x.replaceAll("[^0-9]", "");
        if (d.isEmpty()) return null;
        try {
            return Integer.parseInt(d);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Quét đường kẻ của một trang, giữ lại đường ngang chạm mép trái bảng (ranh giới tuần). */
    private static final class DoVien extends PDFGraphicsStreamEngine {
        private final float caoTrang;
        private final int page;
        private final List<float[]> re = new ArrayList<>();   // hình chữ nhật user-space đang gom
        private final List<float[]> doan = new ArrayList<>(); // đoạn thẳng đang gom
        final List<Vien> bien = new ArrayList<>();
        private float x0, y0;

        DoVien(PDPage p, int page) {
            super(p);
            this.caoTrang = p.getMediaBox().getHeight();
            this.page = page;
        }

        @Override
        public void appendRectangle(Point2D p0, Point2D p1, Point2D p2, Point2D p3) {
            float minY = (float) Math.min(Math.min(p0.getY(), p1.getY()), Math.min(p2.getY(), p3.getY()));
            float maxY = (float) Math.max(Math.max(p0.getY(), p1.getY()), Math.max(p2.getY(), p3.getY()));
            float minX = (float) Math.min(Math.min(p0.getX(), p1.getX()), Math.min(p2.getX(), p3.getX()));
            float maxX = (float) Math.max(Math.max(p0.getX(), p1.getX()), Math.max(p2.getX(), p3.getX()));
            re.add(new float[]{minY, maxY, minX, maxX});
        }

        private void nhan() {
            for (float[] r : re) {
                float cao = r[1] - r[0], rong = r[3] - r[2];
                if (cao <= 3f && rong >= 200f && r[2] <= X_VIEN_KHOI) {
                    bien.add(new Vien(page, caoTrang - r[1]));
                }
            }
            for (float[] s : doan) {
                if (Math.abs(s[1] - s[3]) < 1.5f && Math.abs(s[2] - s[0]) >= 200f
                        && Math.min(s[0], s[2]) <= X_VIEN_KHOI) {
                    bien.add(new Vien(page, caoTrang - s[1]));
                }
            }
            re.clear();
            doan.clear();
        }

        @Override public void fillPath(int windingRule) { nhan(); }
        @Override public void fillAndStrokePath(int windingRule) { nhan(); }
        @Override public void strokePath() { nhan(); }

        @Override public void drawImage(PDImage pdImage) {}
        @Override public void clip(int windingRule) {}
        @Override public void moveTo(float x, float y) { x0 = x; y0 = y; }
        @Override public void lineTo(float x, float y) { doan.add(new float[]{x0, y0, x, y}); x0 = x; y0 = y; }
        @Override public void curveTo(float x1, float y1, float x2, float y2, float x3, float y3) { x0 = x3; y0 = y3; }
        @Override public Point2D getCurrentPoint() { return new Point2D.Float(x0, y0); }
        @Override public void closePath() {}
        @Override public void endPath() { re.clear(); doan.clear(); }
        @Override public void shadingFill(org.apache.pdfbox.cos.COSName shadingName) {}
    }

    private record Tok(int page, float x, float endX, float y, String text) {}

    private record Dong(int page, float y, String cotTuan, String cotTiet, String tieuDe) {}

    private record Moc(int page, float y, int tuan) {}

    private record Vien(int page, float top) {}

    private record Khoi(int page, float top, float duoi, int tuan) {}
}
