# Đề tài phần B — Trợ lý Qwen3 cho giáo viên

**Chốt ngày 19/09/2026.** File này là khung. Việc gì không nằm trong đây thì không làm,
kể cả khi nó hay. Muốn thêm thì sửa file này trước, sửa code sau.

## Tên

**Kiến trúc sinh–kiểm với mô hình ngôn ngữ nhỏ chạy cục bộ: trợ lý số hóa và chuẩn hóa
ngân hàng đề toán lớp 10 cho giáo viên.**

## Luận điểm xuyên suốt

Mô hình 2–4B chạy trên 4 GB VRAM **sai thường xuyên**. Đề tài không giả vờ ngược lại.
Thay vào đó, mỗi đầu ra của mô hình đều đi kèm **một hàm kiểm chứng tự động**, và
**thứ không qua kiểm thì không tới tay giáo viên**.

Đây là điều nối ba chức năng dưới đây thành một đề tài, chứ không phải ba tính năng rời.
Đóng góp nghiên cứu nằm ở chỗ: *hàm kiểm chứng nào khả thi cho nghiệp vụ nào, và vòng lặp
sinh–kiểm cứu được bao nhiêu phần trăm ca hỏng.*

## Người dùng

**Giáo viên.** Chỉ giáo viên. Học sinh không chạm vào bất kỳ đầu ra nào của mô hình
trước khi giáo viên duyệt.

## Ba chức năng

### F1 — Bóc tách đề từ ảnh/PDF scan, có vòng lặp tự sửa

Điểm nhấn nghiên cứu. Đây là chức năng duy nhất trong đề tài là **agent** đúng nghĩa:
có quyết định thật, có tool để chọn, có tín hiệu phản hồi để lặp.

| | |
|---|---|
| Model | `qwen3-vl:2b` (bật thinking) |
| Vào | Ảnh trang đề, hoặc vùng đã cắt |
| Ra | Một hàng `extracted_questions` **máy chấm được**: `question_type` ∈ 4 giá trị của `ck_extracted_question_type`, `answer_text` đúng dạng của kiểu đó, `answer_payload` hợp lệ |
| **Hợp đồng đầu ra** | `ChamDiemCauHoi.dapAnHopLe(cau) == true`. Đây là hàm có sẵn của hệ thống, không phải tiêu chí đặt ra cho đồ án |
| **Hàm kiểm chứng** | 7 tầng V1–V7, xem `QUY-TRINH-F1.md` §B6. V5 gọi thẳng `dapAnHopLe()` qua endpoint nội bộ — luật giữ đúng một bản |
| Vòng lặp | Bảng luật cứng (không để LLM tự chọn hành động): tăng DPI / nới hộp cắt / đổi pix2tex / **ép cứng từng kiểu câu rồi đọc lại** / gộp câu / bỏ cuộc. **Tối đa 3 vòng**, giữ bản tốt nhất từng có |
| Đường lui | Hạ xuống `TU_LUAN` — luôn qua `dapAnHopLe()`, giáo viên chấm tay câu đó |
| Mã lỗi | `THIEU_PHUONG_AN` `DAP_AN_LAC` `LATEX_SAI_CU_PHAP` `LATEX_LECH_ANH` `DE_CUT` `KIEU_CAU_KHONG_RO` `DAP_AN_SAI_DINH_DANG` `THIEU_Y_DUNG_SAI` `DAP_AN_KHONG_PHAI_SO` `MAT_HINH_VE` `TU_THAM_CHIEU` |
| Chỉ chạy khi | `confidence < 0.9` (ngưỡng lấy từ `saveQuestion`: `.95` khi đủ 4 phương án, `.72` khi không) |
| Điểm cắm | `POST /api/teacher/content-pipeline/sources/{id}/ocr-text` — đã có |
| Baseline so sánh | 3 regex `START`/`OPTION`/`MATH` trong `TeacherContentPipelineService` |

### F2 — Gắn nhãn chương trình tự động

Rẻ nhất, an toàn nhất, làm trước để chạy thử toàn bộ đường ống.
**Không phải agent** — một lời gọi ràng buộc JSON Schema.

| | |
|---|---|
| Model | `qwen3:4b` (**tắt** thinking — việc định dạng, suy nghĩ chỉ làm chậm) |
| Vào | `question_text` + danh mục chương/bài từ PPCT |
| Ra | `chapterId`, `lessonId`, mức độ NB/TH/VD/VDC, `confidence` |
| **Hàm kiểm chứng** | chapterId/lessonId phải tồn tại và thuộc đúng bộ sách; mức độ thuộc 4 giá trị hợp lệ |
| Điểm cắm | `PUT /api/teacher/content-pipeline/questions/{id}/curriculum` với `confirmed=false` — đã có |
| Hỏng thì | Giáo viên sửa 1 cú nhấp |

### F3 — Sinh lời giải mẫu cho câu đã biết đáp án

`saveQuestion` chỉ điền `solution_text` khi tài liệu gốc có dòng "Lời giải:" — phần lớn
câu bóc ra sẽ trống. Đây là lỗ hổng thật của ngân hàng đề.

Mấu chốt: model **không phải tìm đáp án**, nó viết đường đi tới một đích đã biết. Nhờ vậy
mới kiểm được.

| | |
|---|---|
| Model | `qwen3:4b` (bật thinking) |
| Chỉ chạy khi | `answer_text IS NOT NULL AND solution_text IS NULL` |
| **Hàm kiểm chứng** | Bước cuối phải khớp `answer_text`; câu có `math_signature` thì sympy kiểm lại |
| Ghi vào | `solution_steps` (bảng dựng từ `V202607271730`, đang trống, có entity `SolutionStep` chưa ai dùng) |
| Điểm cắm | Duyệt qua `PUT /questions/{id}/review` — đã có |

## Luật chung, không có ngoại lệ

**Không đầu ra nào của mô hình được vào thẳng trạng thái đã duyệt.**

- Nhãn → `curriculum_confirmed = false`
- Câu → `status = 'DETECTED'`
- Lời giải → nháp

Hệ thống vốn đã thiết kế theo hướng này. Mô hình chỉ điền vào chỗ trống, không được tự ký.

**Mỗi lần giáo viên sửa đầu ra của mô hình đều phải ghi lại cặp trước/sau.** Xem mục
"Dữ liệu" bên dưới — đây là luật, không phải tính năng tuỳ chọn.

## Chuẩn bị cho ba khối (10, 11, 12)

Đề tài làm trên **lớp 10**. Nhưng thiết kế phải sao cho mở rộng là dữ liệu, không phải code:

> **Thêm lớp 11, 12 phải là một câu INSERT, không phải một commit.**

`grades` (có `grade_number`) và `chapters` đã có trong schema từ baseline. Luật cấm:

- F1/F2/F3 **không được chứa danh sách chương/bài/dạng toán viết cứng**. Danh mục nạp từ DB
  lúc gọi và đưa vào prompt như dữ liệu.
- Prompt không được nhắc "lớp 10" như hằng số. Khối là tham số.
- Bộ test vàng tách theo khối, để đo riêng được.

**Chỗ sẽ gãy khi lên 3 khối:** `QuestionTransformationService.generate()` có `switch` bốn
`math_signature` (LINEAR_EQUATION, QUADRATIC_EQUATION, LINEAR_FUNCTION, QUADRATIC_FUNCTION)
— đại số lớp 9–10. Lớp 11 (dãy số, lượng giác, đạo hàm) và 12 (tích phân, số phức) mỗi khối
lại thêm một nắm `case`.

**Không sửa nó trong phạm vi đề tài.** Cách né: F1 và F2 không đụng `math_signature`;
F3 chỉ dùng nó làm **verifier phụ** — có signature thì sympy kiểm thêm, không có thì vẫn
chạy với phép so đáp án cuối. Ba chức năng nhờ vậy lên 3 khối được mà không động vào `switch`.

## Dữ liệu — tài sản bền vững

Thứ khiến hệ thống độc lập với mọi API không phải là model, mà là **kho dữ liệu gán nhãn
của chính mình**. Hai nguồn:

### Nguồn 1 — Sửa của giáo viên (tính thật)

Mỗi lần giáo viên sửa đầu ra của mô hình là một mẫu gán nhãn miễn phí.

**Vấn đề hiện tại:** `PUT /questions/{id}/review` đang `update ... set question_text=?` —
**ghi đè**. Bản gốc máy sinh ra biến mất. Sửa 500 câu thì có 500 câu đúng và **không mẫu
huấn luyện nào**, vì cái sai đã bị xoá.

**Việc phải làm trước F1–F3:** một migration thêm bảng ghi cặp
*(đầu ra mô hình, bản giáo viên sửa, tên+phiên bản model, thời điểm, chức năng nào)*.
Dữ liệu không bắt lúc nó xảy ra thì mất vĩnh viễn — nên làm trước, không làm sau.

Ba thứ thu được cùng lúc:
- Bộ test vàng **tự lớn lên** theo thời gian dùng thật
- Dữ liệu fine-tune LoRA (train trên Kaggle/Colab — máy dev 4 GB không fine-tune tại chỗ được)
- Một câu cho luận văn có số: *"sau N tháng dùng thật thu được X cặp sửa, fine-tune nâng
  chính xác từ A lên B"*

### Nguồn 2 — Tổng hợp tự sinh (số lượng)

Đã chốt 13/09: render đề DOCX → ảnh + nhãn LaTeX → giả scan. Cho khối lượng lớn, nhãn
chuẩn xác, miễn phí.

**Tổng hợp cho số lượng, sửa của giáo viên cho tính thật.** Thiếu vế nào cũng hỏng: chỉ
tổng hợp thì mô hình giỏi trên ảnh giả và dở trên scan thật; chỉ sửa tay thì không đủ lượng.

### Bộ test vàng — đóng băng

~200–300 câu từ scan thật, gán nhãn tay, **không bao giờ dùng để chỉnh prompt hay fine-tune**.
Mọi thay đổi đo lại trên đúng bộ đó. Không có nó thì mọi câu "đã cải thiện độ chính xác"
chỉ là cảm giác.

## Ba đòn bẩy cho độ chính xác, xếp theo hiệu quả

1. **Cắt vùng trước khi đưa vào VLM.** Model 2B đọc cả trang A4 sẽ trượt. Phát hiện bố cục
   → cắt từng câu → mới đưa vào. Thường tăng chính xác nhiều hơn bất kỳ prompt nào.
2. **Đầu tư vào verifier, không phải prompt.** Verifier bắt được 90% lỗi biến model chính xác
   70% thành hệ thống an toàn 97% — lỗi bị bắt thì đẩy sang người, không tới giáo viên dưới
   dạng sai âm thầm. Nhích 70%→75% bằng chỉnh prompt tốn công hơn và ít giá trị hơn.
3. **Fine-tune** — sau cùng, khi đã có dữ liệu từ hai nguồn trên. Không phải việc làm đầu tiên.

## Ngoài khung — khoá cứng

| Không làm | Vì |
|---|---|
| Gia sư ảo cho học sinh | Model 3–4B bịa lời giải toán trôi chảy; học sinh không đủ sức phát hiện |
| Chấm tự luận tự động | Đã chốt 13/09: giáo viên chấm tay |
| OCR chữ viết tay, OMR phiếu tô | Đã chốt 13/09 |
| Gọi API AI ngoài (Gemini/OpenAI/Mathpix/Coze cloud) | Đã chốt 14/09 |
| Coze Studio trong sản phẩm | Kéo theo Elasticsearch + Milvus + MySQL + MinIO — chồng lên Neon PG và R2, và ES nằm trong mục đã bác bỏ của `CLAUDE.md` |
| LLM sinh câu hỏi mới | Rule + sympy giữ nguyên. Xem comment trong `QuestionTransformationService.textOptions` |
| Elasticsearch | Đã bác bỏ từ trước |

**Coze Studio** được phép dùng làm **bàn thí nghiệm ngoài sản phẩm**: thử prompt, so
Qwen3 với Llama trên cùng workflow. Chốt được thì chép sang FastAPI dưới dạng code, rồi tắt đi.
Không đóng gói, không nộp kèm.

## Mô hình và phần cứng

Máy dev: GTX 1650, **4 GB VRAM**. Ollama, `keep_alive` ngắn — hai model không được
tranh bộ nhớ cùng lúc.

| Vai | Model | VRAM (Q4) |
|---|---|---|
| Mắt | `qwen3-vl:2b` | ~1.9 GB |
| Chữ | `qwen3:4b` | ~2.5 GB |
| Đối chứng luận văn | `llama3.2:3b` | ~2 GB |

Llama **không vào sản phẩm**. Vai trò duy nhất của nó là nhánh đối chứng: chạy cùng prompt,
cùng bộ test, để có bảng so sánh hai họ mô hình trong chương thực nghiệm.

Chế độ suy nghĩ của Qwen3 bật/tắt theo việc — tắt ở khoảng 80% lời gọi (định dạng, gắn nhãn)
là khác biệt giữa "dùng được" và "chờ mãi" trên 4 GB.

## Kiến trúc

```
Spring (giữ quyền + bảng job)  --HTTP-->  math10-extractor/ (FastAPI)
                                               '-- Ollama
                                                    |-- qwen3-vl:2b
                                                    '-- qwen3:4b
```

`math10-extractor/` **chưa tồn tại**. Nó không đọc DB — nhận việc qua HTTP, trả JSON theo
schema chung. Quyền đọc vẫn nằm trong một hàm duy nhất phía Spring.

## Số phải đo cho báo cáo

| Chức năng | Đo gì |
|---|---|
| F1 ① | **Tỉ lệ hợp lệ** — qua `dapAnHopLe()`: **regex** vs **Qwen3 một lượt** vs **Qwen3 có vòng lặp** |
| F1 ② | **Tỉ lệ giữ được kiểu máy chấm** — không phải hạ cấp về `TU_LUAN` mới qua. **Bắt buộc báo cáo cùng ①**: chỉ có ① thì agent đạt 100% bằng cách bỏ cuộc mọi câu |
| F1 | Phân loại kiểu câu đúng — riêng cặp `MCQ` ↔ `DUNG_SAI_4Y`, chỗ regex không tách được |
| F1 | Số vòng trung bình. Tỉ lệ câu hỏng được cứu sau retry. Thời gian mỗi trang |
| F1 | Cùng bộ test trên `llama3.2:3b` để có bảng đối chứng |
| F2 | Độ chính xác nhãn chương/bài/mức độ, đo trên tập giáo viên đã xác nhận |
| F3 | Tỉ lệ lời giải qua được hàm kiểm chứng; trong số qua được, tỉ lệ giáo viên duyệt thẳng không sửa |

Tập test: đề scan thật, gán nhãn tay. Cộng dữ liệu tổng hợp tự sinh từ đề DOCX
(render → ảnh + nhãn LaTeX → giả scan) như đã chốt 13/09.

## Thứ tự làm

0. **Bảng ghi sửa của giáo viên** — một migration. Làm trước tất cả, vì dữ liệu không bắt
   lúc nó xảy ra thì mất vĩnh viễn.
1. **F2** — 1–2 ngày. Không phải vì nó quan trọng nhất, mà vì nó rẻ và trả lời được câu hỏi
   "hạ tầng Spring → FastAPI → Ollama → ghi ngược có sống không" trước khi đổ công vào F1.
2. **F1** — điểm nhấn luận văn. Đây là thứ bảo vệ trước hội đồng. Các bước chi tiết ở `QUY-TRINH-F1.md`.
   Đo cấu hình "một lượt + kiểm chứng" **trước** khi thêm vòng lặp, không thì không nói được vòng lặp đóng góp bao nhiêu.
3. **F3** — lấp lỗ hổng ngân hàng đề.

Hết thời gian thì cắt từ dưới lên. F1 không được cắt.
