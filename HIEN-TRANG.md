# Hiện trạng thật của MATH10

File này ghi **mức xác minh** của từng phần, dựa trên bằng chứng đọc được trong mã nguồn —
không dựa trên trạng thái tự khai trong bảng tính kế hoạch.

Bảng được **bồi dần theo từng tính năng**: mỗi lần một tính năng được làm khép kín
(DB → API → UI → test) thì thêm/cập nhật đúng dòng của nó. Phần chưa soát thì để trống,
không đoán — một dòng đoán còn hại hơn một dòng trống.

## Quy ước mức

| Mức | Nghĩa |
|-----|-------|
| **A** | Có migration (nếu cần) + API + UI + test tự động chứng minh hành vi |
| **B** | Đủ ba thứ đầu, chưa có test |
| **C** | Luồng chưa khép kín (thiếu một khâu, hoặc có lỗ hổng đã biết) |
| **D** | Mới có khung, chưa dùng được |

Test được tính là bằng chứng chỉ khi nó **đỏ lên nếu gỡ đoạn code nó bảo vệ**. Test viết xong
đều được kiểm bằng cách tạm gỡ guard rồi chạy lại; ghi lại kết quả ở cột "Bằng chứng".

## Bảng

| Mã | Phần | Mức | Bằng chứng | Còn thiếu |
|----|------|-----|------------|-----------|
| HT-05 | Tài liệu — chỉ người có quyền mới tải được file | **A** | `DocumentServiceImpl.checkCanRead`; `DocumentUrls`; `DocumentController.content/thumbnail`; `PdfThumbnail.tsx`, `PdfPageViewer.tsx`, `pdfOcr.ts`. Test: `DocumentAccessTest` (12 ca), `DocumentUrlsTest` (9 ca) — đã kiểm bằng mutation: gỡ guard giáo viên thì đúng 2 ca đỏ | Bucket R2 phải chuyển sang **private** (việc vận hành, xem cuối file). `readObject` nạp cả file vào RAM — sách lớn cần hỗ trợ range request |
| HT-44 | Bài giao — vòng đời (giờ mở, hạn nộp, số lượt, giờ công bố điểm) và trừ điểm nộp muộn | **B** | `AssignmentWindow` (một bản luật duy nhất), `AssignmentState`, `LatePolicy`, `AssignmentRows`; gọi từ `AssignmentProgressController`, `TeacherSubmissionController`, `StudentLearningController`, `StudentClassController`. UI: `ClassTaskPanel.tsx` (đặt lịch + tự kiểm mâu thuẫn), `assignmentGate()` trong `format.ts` dùng ở `AssignmentsPage`, `MyClassesPage`, `WorksheetRunner`. Test: `AssignmentWindowTest` (26 ca) — kiểm bằng mutation, **6/6 phép sửa đều làm suite đỏ**; `AssignmentProgressControllerTest` thêm 2 ca chặn DRAFT và quá hạn | Migration `V202608271000__assignment_lifecycle.sql` **chưa từng chạy trên bất kỳ DB nào** — máy không có Postgres cục bộ, DB duy nhất là Neon staging dùng chung. Đây là lý do dòng này ở B chứ không phải A. `assignmentGate` không có test vì frontend chưa có test runner. Chưa có `assignment_targets` (giao theo nhóm / từng học sinh) |
| HT-51 | Chấm trắc nghiệm — một bản luật cho nộp bài, chấm lại và thống kê | **A** | `McqGrading` (chuẩn hoá đáp án, soát đề chấm được, soát bài nộp đủ câu, tính điểm thang 10); `WorksheetAnswerKeys` nạp đáp án cả phiếu bằng một truy vấn. Gọi từ `AssignmentProgressController.submit/saveAnswers` và `TeacherSubmissionController.regrade/analysis`. UI: `AssignmentAnalysisDialog.tsx` mở từ nút "Tỉ lệ đúng" trong `ClassTaskPanel.tsx`. Test: `McqGradingTest` (21 ca) — kiểm bằng mutation, **7/7 phép sửa đều làm suite đỏ** | Chưa có test cho `AssignmentAnalysisDialog` vì frontend chưa có test runner. Đề tự luận vẫn chỉ có điểm tổng + nhận xét chung, chưa chấm theo từng câu (#54) |

## Chi tiết HT-05

Ba lỗ hổng đã đóng trong lát này:

1. **API trả URL R2 thô.** `documents.file_url` là URL công khai tuyệt đối, đi thẳng ra
   `DocumentResponse.fileUrl` rồi được frontend `window.open`. Trình duyệt mở URL đó là bỏ qua
   toàn bộ kiểm quyền, vì R2 không biết ai đang đăng nhập. Nay mọi đường dẫn trả ra client đều
   là `/api/documents/{id}/content.{ext}` — quy ước nằm gọn trong `DocumentUrls`, một chỗ định
   nghĩa duy nhất, dùng chung cho cả mapper lẫn các truy vấn native (`ClassContentController`,
   `StudentClassController`).

2. **Proxy mở toàn bucket.** `GET /api/admin/documents/content?url=` nhận URL bất kỳ rồi đọc
   thẳng object trên R2, cho mọi tài khoản `ADMIN` **hoặc `TEACHER`**. Đã xoá hẳn.

3. **IDOR giữa các giáo viên.** `readDocumentBytes` không kiểm chủ sở hữu, nên giáo viên A đoán
   id là đọc được tài liệu riêng của giáo viên B. Nay điều kiện đọc file khớp **đúng** điều kiện
   nhìn thấy tài liệu trong danh sách (`findLibraryForTeacher`, `findStudentVisibleDocuments`) —
   không rộng hơn (là hở), không hẹp hơn (là chặn nhầm người đang thấy tài liệu trên màn hình).

Không cần migration: đường dẫn được **tính ra từ id** lúc map, `documents.file_url` giữ nguyên
URL R2 và vẫn được `StorageUrlSupport.objectKeyFor` phân giải khi đọc file. Dữ liệu cũ chạy
nguyên trạng.

Đuôi file được giữ lại trong đường dẫn (`content.pdf`, `content.docx`) vì frontend phân biệt
"xem được trong app" hay "tải về" bằng `isPdfDocument()` → `endsWith(".pdf")`, dùng ở ~15 chỗ.
Bỏ đuôi là PDF thôi mở trong trình xem. `DocumentUrlsTest` khoá đúng điều này lại.

Ảnh bìa cũng phải đi qua backend (`/api/documents/{id}/thumbnail`), nếu không thì bìa biến mất
ngay khi bucket chuyển sang private — mà đó chính là bước làm lỗ hổng này thực sự đóng lại.

Tài liệu trong bài học đi đường riêng (`/api/lessons/{lessonId}/documents/{id}/content.{ext}`):
quyền đến từ việc đang học bài đó, không từ audience của tài liệu, nên dùng chung endpoint
`/api/documents` sẽ chặn nhầm học sinh.

## Chi tiết HT-44

Trước lát này, `assignments` có `due_at` nhưng **không chỗ nào trên server đọc nó**. Bốn hệ quả:

1. **Lộ đề.** `/api/student/assignments` không lọc `status`, nên bài `DRAFT` giáo viên đang soạn
   hiện thẳng trong danh sách học sinh **kèm toàn bộ câu hỏi** — `statement_latex` và cả bốn
   phương án.
2. **Hạn nộp chỉ là chữ.** Nộp muộn bao lâu cũng được.
3. **Nộp lại vô hạn** cho tới khi giáo viên bấm trả bài.
4. **Không có giờ mở, không có giờ công bố điểm** — giáo viên phải trả điểm từng bài một.

Luật vòng đời nay nằm gọn trong `AssignmentWindow`, năm hàm thuần không phụ thuộc Spring:
`stateOf`, `attemptsLeft`, `requireSubmittable`, `applyLatePenalty`, `scoreVisible`. Mọi màn hình
đều hỏi cùng đối tượng đó thay vì tự suy luận lại.

**Lỗ thứ hai, không có trong kế hoạch, tìm thấy khi làm.** `GET /api/student/classes/{classId}/tasks`
lọc `DRAFT` bằng SQL nhưng lại **viết lại luật hiện điểm** thành `case when ap.returned_at is not null`,
và không biết `open_at` là gì. Hậu quả: đề của bài hẹn giờ lộ ở màn hình lớp dù đã kín ở màn hình
bài tập, còn `publish_score_at` thì bị bỏ qua ở đây trong khi được tôn trọng ở kia. Hai chỗ cùng
một luật, viết hai lần, lệch nhau — đúng kiểu lỗi mà việc tách `AssignmentRows` sinh ra để chặn:
nay cả hai màn hình chạy SQL viết tay đều dựng lại entity bằng một hàm và hỏi cùng một `AssignmentWindow`.

Vài quyết định đáng ghi lại:

- **`raw_score` tách khỏi `score`.** Giữ điểm gốc trước khi trừ phần trăm để (a) giải thích được
  cho học sinh vì sao 8.00 thành 6.40, và (b) chấm lại **không nhân trừ chồng lên nhau** — có một
  ca test riêng cho việc này.
- **`max_attempts = 0` nghĩa là không giới hạn**, chứ không phải cấm nộp. Ràng buộc DB chỉ chặn số âm.
- **Migration vá dữ liệu cũ**: bài đã nộp trước khi có cột `attempt_no` được đặt thành 1, nếu không
  thì ngày triển khai ai cũng được nộp thêm một lần nữa dù `max_attempts = 1`.
- **`lesson_id` cố ý không bị che** khi bài chưa tới giờ mở — bài học được xuất bản theo đường
  riêng, che đi là hỏng nút "Vào bài học".
- **`assignmentGate()` ở frontend là hình chiếu, không phải nguồn luật.** Mọi đường nó khoá đều
  được `requireSubmittable` chặn độc lập trên server; sửa file đó không mở được cửa nào.

`src/teacher/AssignmentManager.tsx` bị xoá trong lát này: không file nào import, và nó là bản sao
cũ của `ClassTaskPanel` vẫn gọi `saveAssignment` theo hình dạng cũ. Vì các trường mới đều tuỳ chọn
nên nó sẽ **biên dịch sạch mà vẫn sai** — đúng loại bẫy như `src/admin/AdminShell.tsx`.

Đã kiểm bằng chứng: tạm sửa `AssignmentWindow` sáu kiểu (`isLate` luôn false; `attemptsLeft` luôn
null; bỏ trừ điểm; `scoreVisible` luôn true; bỏ nhánh DRAFT; bỏ nhánh `returnedAt`) — cả sáu lần
suite đều đỏ (4, 2, 3, 3, 1, 1 ca), rồi khôi phục file về nguyên trạng.

**Ranh giới xác minh, nói rõ để khỏi hiểu nhầm:** 83 test backend xanh và `npm run build` sạch
chứng minh *luật* đúng và mã biên dịch được. Chúng **không** chứng minh migration chạy được —
file SQL đó chưa từng được thi hành. Tôi đã đối chiếu tay từng cột với entity (`open_at`,
`max_attempts`, `late_policy`, `late_penalty_percent`, `publish_score_at`, `attempt_no`,
`submitted_late`, `raw_score`) nên `ddl-auto: validate` sẽ không kêu, nhưng đối chiếu tay không
phải bằng chứng tự động. Chạy được lần đầu là khi có embedded PostgreSQL (Lát 1) hoặc khi bạn
đồng ý cho chạy lên Neon staging.

## Chi tiết HT-51

Luật chấm trắc nghiệm trước đây được viết **ba lần** — lúc học sinh nộp, lúc giáo viên bấm "Chấm
lại", lúc dựng bảng tỉ lệ đúng — và ba bản đã lệch nhau thật:

| Tình huống | nộp bài | chấm lại | thống kê |
|---|---|---|---|
| đề có câu chưa nhập đáp án | báo lỗi | **tính cả lớp là sai** | **báo câu đó 0% đúng** |
| đáp án ngoài A–D | báo lỗi | bỏ qua | bỏ qua |
| thiếu câu trả lời | báo lỗi | tính là sai | tính là sai |

Cột giữa là hỏng dữ liệu im lặng: giáo viên thêm một câu, quên nhập đáp án đúng, bấm "Chấm lại"
— câu đó bị tính là cả lớp làm sai **nhưng vẫn chia cho đủ số câu**, nên điểm cả lớp tụt mà không
một lời báo. Rồi bảng thống kê tô đỏ chính câu đó là "0% đúng", đẩy giáo viên đi sửa một câu vốn
không sai. Nay `requireGradable` chặn hẳn phép chấm lại, và `missingAnswerKey` tách "đề hỏng" khỏi
"cả lớp làm sai".

Nhân đó siết luôn phép soát bài nộp. Cách cũ so `request.answers().size() != items.size()` — gửi
đủ 20 đáp án nhưng mang id câu hỏi của phiếu khác thì vẫn lọt, rồi bị chấm 0 điểm không hiểu vì
sao. `requireCompleteAnswers` nay soát theo từng câu của chính đề đó.

Và bỏ hai chỗ N+1: `regrade` gọi `problems.findById` trong vòng lặp học sinh × câu hỏi — chấm lại
một lớp 40 em đề 20 câu là 800 lượt hỏi cơ sở dữ liệu. Nay `WorksheetAnswerKeys` nạp cả phiếu một
lần.

Đã kiểm bằng chứng: tạm sửa `McqGrading` bảy kiểu (bỏ soát đề thiếu đáp án; không chuẩn hoá bài
làm; bỏ câu trống khỏi mẫu số; quay lại chỉ đếm số lượng đáp án; không cắt khoảng trắng; làm tròn
xuống thay vì làm tròn gần nhất; đề rỗng không bị chặn) — cả bảy lần suite đều đỏ, rồi khôi phục
file về nguyên trạng (`diff` xác nhận giống hệt byte).

Dòng này đạt **A** vì không cần migration nào: `raw_score`, `correct_count`, `total_questions`
đều là cột đã có. Bốn chân đủ — API, UI, test, và không có schema mới nào chưa chạy.

Một chỗ đáng nói về UI: `getItemAnalysis` và `regradeAssignment` đã nằm trong `api.ts` từ trước
nhưng **không màn nào gọi**. Backend làm đúng mà giáo viên không có đường bấm tới thì tính năng
coi như không có — nên lát này mới dựng `AssignmentAnalysisDialog`. Nút "Chấm lại cả lớp" bị khoá
ngay tại chỗ khi đề còn câu trống đáp án, kèm danh sách số thứ tự câu thiếu; đó là bản chiếu của
luật server chứ không phải nơi kiểm.

## Việc vận hành còn nợ

- **Chuyển bucket Cloudflare R2 sang private.** Mã nguồn nay không phát tán URL R2 nữa, nhưng
  các URL đã lộ trước đây vẫn mở được chừng nào bucket còn public. Đây là việc trên bảng điều
  khiển Cloudflare, không nằm trong repo.
