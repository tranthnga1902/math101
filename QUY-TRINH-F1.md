# F1 — Quy trình từ file đề tới câu làm được trên máy

**Phụ lục chi tiết của `DE-TAI-QWEN3.md`.** Khung nằm ở file kia; đây là các bước.
Mâu thuẫn giữa hai file thì khung thắng.

Mục tiêu một câu:

> Từ một file đề scan, sinh ra hàng `extracted_questions` mà
> `ChamDiemCauHoi.dapAnHopLe()` trả về `true` — tức là **máy chấm được ngay, giáo viên
> không phải gõ lại gì**.

---

# Phần A — Dữ liệu, làm trước khi viết F1

## A1. Chốt hình dạng nhãn

Làm trước tất cả. Đổi hình dạng giữa chừng thì toàn bộ nhãn đã thu thành rác, không cứu được.

```json
{
  "so_cau": 17,
  "kieu_cau": "MCQ",
  "de": "Tìm tập xác định của hàm số $y=\\frac{\\sqrt{2x-3}}{x-1}$",
  "y": ["$[\\frac{3}{2};+\\infty)$", "$[\\frac{3}{2};+\\infty)\\setminus\\{1\\}$", "...", "..."],
  "dap_an": "B",
  "payload": null,
  "latex": [{"vi_tri": 28, "gia_tri": "\\frac{\\sqrt{2x-3}}{x-1}"}],
  "hinh": null,
  "vung_khong_chac": []
}
```

`kieu_cau` ∈ `MCQ | DUNG_SAI_4Y | TRA_LOI_NGAN | TU_LUAN` — **đúng bộ từ vựng của
`ck_extracted_question_type`**, không tự đặt tên khác. Bộ tách cũ từng ghi
`MULTIPLE_CHOICE / SHORT_ANSWER / FREE_RESPONSE` rồi phải viết migration quy về một;
đừng tạo ra bộ thứ ba.

`y` luôn là **bốn dòng a) b) c) d)**, nhưng mang nghĩa khác nhau tuỳ kiểu:

| `kieu_cau` | `y` là gì | `dap_an` | `payload` |
|---|---|---|---|
| `MCQ` | 4 **lựa chọn**, chọn 1 | `"B"` | `null` |
| `DUNG_SAI_4Y` | 4 **mệnh đề**, mỗi ý đúng/sai riêng | `"DSSD"` | `null` |
| `TRA_LOI_NGAN` | `[]` | `"3.14"` | `{"tolerance":0.01}` |
| `TU_LUAN` | `[]` | `null` | `null` |

Hai dòng đầu bảng này là cả bài toán khó của F1 — xem B6/V5.

## A2. Bắt cặp sửa của giáo viên — migration, gấp nhất

Ba nguồn nhãn đang bị ghi đè mỗi lần giáo viên bấm nút:

| Cột | Là nhãn cho | Nút nào ghi đè |
|---|---|---|
| `math_fragments.raw_value` → `latex_value` | OCR → LaTeX | `MathReview` |
| `curriculum_chapter_id` / `lesson_id` / `exercise_type_id` | gắn nhãn chương trình (F2) | `PUT /questions/{id}/curriculum` |
| `question_text`, `option_a..d`, `answer_text`, `question_type` | bóc tách (F1) | `PUT /questions/{id}/review` |

```sql
create table sua_dau_ra_mo_hinh (
  id               bigserial primary key,
  chuc_nang        text   not null,   -- BOC_TACH | GAN_NHAN | SINH_LOI_GIAI
  bang_goc         text   not null,   -- extracted_questions | math_fragments
  ban_ghi_id       bigint not null,
  lan_sua          int    not null,   -- 1,2,3... lan_sua=1 thì truoc CHÍNH LÀ đầu ra máy
  loai_sua         text   not null default 'LOI_MAY',
                   -- LOI_MAY | SUA_SU_PHAM | SUA_CUA_CHINH_MINH
  truoc            jsonb  not null,
  sau              jsonb  not null,
  mo_hinh          text,              -- qwen3-vl:2b
  phien_ban_prompt text,
  sua_boi          bigint not null references users(id),
  thuoc_bo_test    boolean not null default false,
  created_at       timestamptz not null default now()
);
create index idx_sua_chuc_nang on sua_dau_ra_mo_hinh(chuc_nang, created_at desc);
```

Cộng hai cột vào `extracted_questions`: `nguon_sinh` (`REGEX | QWEN3_VL_2B | THU_CONG`)
và `phien_ban_prompt`. **Không xoá cột nào** — đúng luật `CLAUDE.md`.

`lan_sua = 1` thì `truoc` tự nó là đầu ra của máy, nên không cần chụp thêm lúc sinh.

### `loai_sua` — bước hay bị bỏ, và bỏ là hỏng cả đợt train

| Loại | Ví dụ | Đưa vào train? |
|---|---|---|
| `LOI_MAY` | đọc `x²` thành `x2`; nhận nhầm DS_4Y thành MCQ | **có** |
| `SUA_SU_PHAM` | đổi số cho dễ hơn, sửa câu chữ cho hợp lớp | không |
| `SUA_CUA_CHINH_MINH` | sửa lại chính lần sửa trước của mình | không |

Trộn `SUA_SU_PHAM` vào tức là đang dạy mô hình **viết lại đề** thay vì **đọc đề**.
Hỏng im lặng — không có dấu hiệu nào báo, chỉ thấy số đo tụt mà không hiểu vì sao.

Giao diện: một ô chọn nhỏ trên thẻ câu hỏi, mặc định `LOI_MAY`. Không thêm việc cho giáo viên.

## A3. Nguồn tổng hợp — render DOCX

Đáp án có sẵn **trước khi** tạo dữ liệu: văn bản trong DOCX chính **là** nhãn.

```
file.docx ──► LibreOffice --headless --convert-to pdf ──► pdftoppm 200dpi ──► ảnh
          └─► python-docx đọc văn bản + bảng ──────────► nhãn JSON (A1)
```

Không ai phải gõ gì. Số lượng không giới hạn. Đây là nguồn chính, không phải nguồn phụ.

## A4. Làm bẩn — quyết định T2 dùng được hay không

Ảnh render sạch quá: nét sắc, nền trắng tuyệt đối, thẳng tắp. Train trên ảnh sạch rồi
chạy trên scan thật thì **tệ hơn không train** — mô hình học đặc trưng không tồn tại
ngoài đời.

Phải giả scan có kiểm soát: nghiêng ±2°, nhiễu Gauss, nén JPEG mạnh, gradient bóng đèn,
vết mực photo, nền ngả xám.

Cách kiểm đã đủ bẩn chưa: **đo trên bộ vàng**. Thêm T2 vào train mà điểm bộ vàng **giảm**
thì khoảng cách miền còn quá lớn, phải làm bẩn thêm.

## A5. Bộ vàng — 200–300 câu, đóng băng

Lấy từ scan thật, gán nhãn tay, **không bao giờ dùng để chỉnh prompt hay fine-tune**.
Đặt `thuoc_bo_test = true` **một lần** lúc chọn, không sửa về sau.

Tách theo khối 10/11/12 để đo riêng từng khối được.

## A6. Khử trùng lặp trước khi chia train/test

Một câu xuất hiện trong nhiều đề là chuyện bình thường. Bản sao nằm cả hai bên thì số đo
vô nghĩa **mà không có cách nào phát hiện** — chỉ thấy điểm đẹp bất thường.

Băm chuẩn hoá (bỏ khoảng trắng, bỏ số thứ tự câu, chuẩn hoá LaTeX), loại theo băm,
ưu tiên giữ bên test.

## A7. Xuất JSONL — một hàm duy nhất

```sql
where thuoc_bo_test = false and loai_sua = 'LOI_MAY'
```

Cái `where` đó nằm trong **một hàm xuất duy nhất** — cùng nguyên tắc với "quyền đọc nằm
trong một hàm duy nhất" của `CLAUDE.md`. Rải ra nhiều chỗ là rò rỉ bộ test, và rò rồi thì
không phát hiện được.

Trộn **1 phần T1 : 5–10 phần T2**. T1 toàn ca khó (vì chỉ câu sai mới bị sửa); train
thuần T1 thì mô hình lệch về ca khó và hỏng ca dễ. Ghi rõ tỉ lệ đã dùng vào luận văn —
đó là siêu tham số, không phải chi tiết vụn.

## A8. Fine-tune — sau cùng, không phải đầu tiên

QLoRA 4-bit trên Kaggle (30h/tuần, ổn định hơn Colab free). Ma sát nằm ở khâu
merge → GGUF → `ollama create`, không nằm ở train.

Làm **sau khi** A1–A7 xong và F1 đã chạy được bằng prompt. Có thể kết quả là **không cải
thiện đáng kể** — đó vẫn là kết quả hợp lệ, và phải viết đúng như thế.

---

# Phần B — Đường chạy thật

## Toàn cảnh

```
file đề (PDF / ảnh / DOCX)
  │
  ├─ B1  raster hoá                        [Python, tất định]
  ├─ B2  tiền xử lý ảnh                    [Python, tất định]
  ├─ B3  dò bố cục → cắt vùng từng câu     [Python, tất định]
  │
  ├─ B4  gọi qwen3-vl:2b → JSON thô        [VLM, một lượt]
  ├─ B5  chuẩn hoá về Cau                  [Python, tất định]
  ├─ B6  kiểm chứng 7 tầng                 [Python + gọi Spring]
  ├─ B7  chẩn đoán → chọn hành động    ┐   ★ AGENT
  ├─ B8  thử lại, tối đa 3 vòng        ┘   ★ AGENT
  ├─ B9  hạ cấp an toàn về TU_LUAN         [tất định]
  │
  ├─ B10 ghi DB, status='DETECTED'         [Spring]
  ├─ B11 giáo viên soi                     [màn hình đã có]
  └─ B12 soạn đề → phát hành → học sinh làm   [đã có, không đụng]
```

Agent chỉ là **B7 + B8**. Mọi bước khác tất định. Đó là chủ ý: phần nào chạy lại phải ra
kết quả y hệt thì để tất định; chỉ phần cần phán đoán mới giao cho mô hình.

## B1 — Raster hoá

| | |
|---|---|
| Vào | PDF / ảnh / DOCX |
| Ra | danh sách ảnh trang, mặc định 200 DPI |
| Công cụ | `pdftoppm`; DOCX qua LibreOffice headless |

**DPI là biến trạng thái**, không phải hằng số — B7 sẽ đổi nó.

## B2 — Tiền xử lý

Khử nghiêng, chuẩn hoá tương phản, khử nhiễu muối tiêu.

Giữ nguyên bản gốc: mọi bước sau phải quay lại ảnh gốc được, vì **tiền xử lý quá tay cũng
là một nguyên nhân đọc sai** — nét mảnh của dấu căn hay dấu mũ bị khử mất.

## B3 — Dò bố cục, cắt vùng

Đây là **đòn bẩy số 1** trong khung: model 2B đọc cả trang A4 sẽ trượt.

| | |
|---|---|
| Ra | danh sách `hop_cat`: `{so_cau, x, y, w, h, trang}` |
| Cách | dò khoảng trắng ngang + neo theo mẫu đánh số (`Câu 1.`, `Bài 2:`) |

Cắt sai ở đây thì mọi bước sau vô nghĩa — nên B7 có hai hành động riêng để cắt lại.

## B4 — Gọi VLM

| | |
|---|---|
| Model | `qwen3-vl:2b`, bật thinking |
| Vào | **một vùng đã cắt**, không phải cả trang |
| Ra | JSON đúng schema A1 |
| Ràng buộc | JSON Schema cứng; danh mục kiểu câu **nạp từ DB**, không viết cứng trong prompt |

Nạp danh mục từ DB là để giữ luật *"thêm khối phải là một câu INSERT, không phải một commit"*.

Prompt phải nói rõ sự khác nhau giữa MCQ và DUNG_SAI_4Y — xem B6/V5.

## B5 — Chuẩn hoá về `Cau`

Cầu nối giữa JSON của mô hình và bảng thật:

| JSON (A1) | Cột `extracted_questions` |
|---|---|
| `de` | `question_text` |
| `y[0..3]` | `option_a` … `option_d` |
| `dap_an` | `answer_text` |
| `kieu_cau` | `question_type` |
| `payload` | `answer_payload` |

Rồi dựng đối tượng `ChamDiemCauHoi.Cau(id, kieu, dapAn, payload, diemToiDa)` để đem đi kiểm.

## B6 — Kiểm chứng, 7 tầng

| Tầng | Kiểm gì | Bằng gì | Mã lỗi |
|---|---|---|---|
| V1 | JSON đúng schema | JSON Schema | `JSON_HONG` |
| V2 | LaTeX parse được | `pylatexenc` | `LATEX_SAI_CU_PHAP` |
| V3 | LaTeX **khớp ảnh** | render ngược rồi so ảnh | `LATEX_LECH_ANH` |
| V4 | đủ 4 ý khi kiểu cần | đếm | `THIEU_Y` |
| **V5** | **đáp án hợp lệ với kiểu** | **`ChamDiemCauHoi.dapAnHopLe()`** | `DAP_AN_SAI_DINH_DANG` |
| V6 | câu tự chứa | regex `"như câu trên"`, `"hình bên"` | `TU_THAM_CHIEU` |
| V7 | hình có mặt | đề nhắc hình mà `hinh == null` | `MAT_HINH_VE` |

**V3 bắt được lỗi mô hình không thể tự biết.** `x²` đọc thành `x2` vẫn là LaTeX hợp lệ —
V2 cho qua, chỉ V3 chặn được. Mô hình tự chấm mình thì cũng nói là đúng.

**V5 là hàm có sẵn của hệ thống, không phải thứ đồ án bịa ra để có cái mà kiểm.**
Nó đang chặn giáo viên phát hành đề không chấm được. Javadoc của nó nói thẳng lý do:

> *"Đáp án sai định dạng mà lọt qua đây thì cả lớp bị 0 câu đó mà không ai báo."*

### V5 chạy ở đâu — một quyết định kiến trúc

`ChamDiemCauHoi` là Java; vòng lặp ở Python. Ba lựa chọn:

| Cách | Vấn đề |
|---|---|
| Chép luật sang Python | **Bác.** `McqGrading` từng bị viết ba bản và chúng đã lệch nhau thật — javadoc của nó ghi lại vụ đó. Đừng tạo bản thứ tư |
| Spring kiểm sau khi nhận kết quả | Quá muộn — hết đường thử lại |
| **Spring mở endpoint nội bộ, Python gọi mỗi vòng** | **Chọn** |

```
POST /noi-bo/kiem-dap-an
  →  { kieu, dapAn, payload }
  ←  { hopLe: true|false, ly_do: "..." }
```

Không trạng thái, không đụng DB, localhost ~2 ms — không đáng kể so với vài giây suy luận
của VLM. Luật vẫn nằm đúng một bản.

## B7 — Chẩn đoán và chọn hành động ★

Bảng luật cứng. **Không để LLM tự chọn hành động.** Lý do: chạy lại phải ra kết quả y hệt,
không thì không ai kiểm chứng được luận văn.

| Lỗi gặp | Hành động | Đổi trạng thái gì |
|---|---|---|
| `LATEX_LECH_ANH` | dựng lại vùng ở DPI cao | `dpi: 200 → 400` |
| `THIEU_Y`, `DE_CUT` | nới hộp cắt | `hop_cat` rộng thêm 15% |
| `LATEX_SAI_CU_PHAP` | đổi bộ đọc công thức | `bo_doc: vlm → pix2tex` |
| `KIEU_CAU_KHONG_RO` | **ép cứng từng kiểu, thử lần lượt** | `ep_kieu: MCQ` rồi `DUNG_SAI_4Y` |
| `DAP_AN_KHONG_PHAI_SO` | đọc như phân số/căn rồi tính bằng sympy | `hau_xu_ly: sympy` |
| `MAT_HINH_VE` | cắt vùng hình → R2 → gắn vào câu | `hinh: {...}` |
| `TU_THAM_CHIEU` | gộp với câu liền trước | `hop_cat` nối hai câu |
| hết cách | `HET_CACH` → B9 | — |

Dòng `KIEU_CAU_KHONG_RO` là dòng đáng giá nhất — xem phần "Điểm cộng" cuối file.

## B8 — Thử lại, trần cứng 3 vòng

Giữ **bản tốt nhất từng có**, không phải bản mới nhất — vòng sau hoàn toàn có thể tệ hơn
vòng trước, và nếu cứ lấy bản mới nhất thì vòng lặp có thể làm kết quả **xấu đi**.

Ghi nhật ký mỗi vòng: `{vong, hanh_dong, loi_gap, thoi_gian_ms}`. Đây là nguồn của mọi con
số trong luận văn — không có nhật ký thì không có chương kết quả.

## B9 — Hạ cấp an toàn

Không dựng nổi câu máy chấm được thì **hạ xuống `TU_LUAN`**: `dapAnHopLe()` luôn cho `TU_LUAN`
qua, nên đề vẫn dùng được, giáo viên chấm tay câu đó. Bỏ cuộc có kiểm soát là kết quả hợp lệ.

> **Bẫy đo lường.** Hạ tất cả về `TU_LUAN` thì verifier qua 100%. Agent "đạt điểm tuyệt đối"
> bằng cách bỏ cuộc mọi câu. Bắt buộc đo **hai** số — xem mục Đo.

## B10 — Ghi DB

`status = 'DETECTED'`, `curriculum_confirmed = false`, `nguon_sinh = 'QWEN3_VL_2B'`.
Không đầu ra nào của mô hình vào thẳng trạng thái đã duyệt.

Điểm cắm: `POST /api/teacher/content-pipeline/sources/{id}/ocr-text` — đã có sẵn.

## B11 — Giáo viên soi

Màn hình đã có: `QuestionReview`, `MathReview` trong `TeacherContentPipeline.tsx`.

Thêm đúng ba thứ:

- ô chọn `question_type` (4 giá trị)
- ô nhập `answer_text` đổi dạng theo kiểu đã chọn (A/B/C/D — DSSD — số)
- ô chọn `loai_sua` (A2)

Mỗi lần bấm lưu đều ghi một hàng vào `sua_dau_ra_mo_hinh`.

## B12 — Soạn đề, phát hành

**Không đụng gì.** `worksheet_items` chụp `question_type_snapshot` / `answer_payload_snapshot`
/ `max_score` qua trigger `snapshot_pipeline_question_options`; `exams` phát hành xuống
`assignments` với `task_kind='BAI_KIEM_TRA'`. Đường này đã chạy trước khi có đồ án.

Nghĩa là F1 **không tạo đề thi**. F1 nạp nguyên liệu vào đúng khuôn để phần đã có dùng được.

---

# Đo — hai cột, không phải một

| Số | Nghĩa | Gian lận được không? |
|---|---|---|
| ① tỉ lệ hợp lệ | qua được `dapAnHopLe()` | **có** — hạ hết về `TU_LUAN` |
| ② **tỉ lệ giữ được kiểu máy chấm** | không phải hạ cấp mới qua | không |

Chỉ báo cáo ① là lỗi phương pháp nghiêm trọng, và là câu hỏi đầu tiên hội đồng sẽ hỏi.
Báo cáo cả hai thì không bắt bẻ được.

Ba cấu hình, chạy trên cùng bộ vàng:

| | ① hợp lệ | ② giữ kiểu | phân loại kiểu đúng | số vòng TB | giây/câu |
|---|---|---|---|---|---|
| A. regex hiện tại | | | | — | |
| B. Qwen3 một lượt + kiểm chứng | | | | 1 | |
| C. Qwen3 có vòng lặp | | | | | |

Cộng một nhánh đối chứng `llama3.2:3b` ở cấu hình C.

A→B là bước **an toàn**. B→C là bước **hiệu quả**. Tách rời hai bước này ra thì mới nói được
phần nào do kiểm chứng, phần nào do vòng lặp.

---

# Điểm cộng khi thêm "đưa về đúng định dạng làm trên máy"

**1. Tiêu chí kiểm chứng không do mình đặt ra.**
Phần lớn đồ án LLM tự nghĩ ra thước đo rồi tự đo bằng thước đó. Ở đây `dapAnHopLe()` là
ràng buộc nghiệp vụ có trước, đang chặn giáo viên thật, không sửa được để chiều số liệu.

**2. Bài toán MCQ ↔ DUNG_SAI_4Y — chỗ regex bó tay và agent thắng rõ ràng.**
Hai kiểu này **nhìn hệt nhau** trên giấy: đều bốn dòng a) b) c) d). Khác nhau ở nghĩa —
một bên chọn một lựa chọn, một bên phán đúng/sai cho từng mệnh đề. Không luật hình thức nào
tách được.

Nhưng nó là **mơ hồ nhị phân có phép thử quyết định được**: ép kiểu MCQ đọc lại, kiểm; ép
kiểu DUNG_SAI_4Y đọc lại, kiểm; lấy bên qua được. Một lượt gọi LLM không làm được việc đó —
phải có vòng lặp mới làm được. Đây là ca lý tưởng cho agent, và nó có thật trong dữ liệu thật.

**3. Đoán sai kiểu là lỗi im lặng, tốn kém.**
Không có kiểm chứng: DS_4Y bị đọc thành MCQ, `answer_text = "DSSD"`, `dapAnHopLe()` chặn
lúc phát hành — nếu may. Không chặn được thì cả lớp mất điểm câu đó. Agent biến lỗi im lặng
thành lỗi ồn, ngay lúc bóc tách.

**4. Có đường lui, và đường lui được đo riêng.**
`TU_LUAN` là bậc thang an toàn. Nói được về "bỏ cuộc có kiểm soát" — và hai cột đo chặn
đúng cái mẹo mà bậc thang đó mở ra. Chỗ này thể hiện tư duy phương pháp hơn là kết quả đẹp.

**5. Đầu ra dùng được ngay, không phải bản demo.**
Có đường liền từ file scan → `extracted_questions` → `worksheet_items` → `exams` →
`assignments` → học sinh bấm nộp. Không có bước "giả sử sau này nối vào hệ thống".

**6. Đúng định dạng thi hiện hành.**
`DUNG_SAI_4Y` với thang luỹ tiến 0 / 0.10 / 0.25 / 0.50 / 1.00 là định dạng của Bộ, không
phải kiểu tự chế. Bài toán đang giải là bài toán có thật ngoài trường.

---

# Thứ tự thi công

| | Việc | Ước |
|---|---|---|
| 0 | A2 migration bắt sửa + móc 3 endpoint + hàm xuất JSONL | 1 ngày |
| 1 | A1 chốt schema nhãn, ghi vào file này | 0.5 ngày |
| 2 | F2 — chạy thử đường ống Spring → FastAPI → Ollama | 1–2 ngày |
| 3 | B1–B5 + V1, V2, V4, V5 — **chưa có vòng lặp** (cấu hình B) | 3–4 ngày |
| 4 | Bộ vàng A5 + đo cấu hình A và B | 2 ngày |
| 5 | B7, B8 vòng lặp (cấu hình C) + V3, V6, V7 | 3–4 ngày |
| 6 | A3, A4 dữ liệu tổng hợp | 2 ngày |
| 7 | A8 fine-tune | 2–3 ngày |
| 8 | F3 | |

Bước 4 nằm **trước** bước 5 là cố ý: phải có mốc so sánh trước khi thêm vòng lặp, không thì
không nói được vòng lặp đóng góp bao nhiêu.

Hết thời gian thì cắt từ dưới lên. Bước 0–5 không được cắt.
