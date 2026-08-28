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
| HT-44 | Bài giao — vòng đời (giờ mở, hạn nộp, số lượt, giờ công bố điểm) và trừ điểm nộp muộn | **A** | `AssignmentWindow` (một bản luật duy nhất), `AssignmentState`, `LatePolicy`, `AssignmentRows`; gọi từ `AssignmentProgressController`, `TeacherSubmissionController`, `StudentLearningController`, `StudentClassController`. UI: `ClassTaskPanel.tsx` (đặt lịch + tự kiểm mâu thuẫn), `assignmentGate()` trong `format.ts` dùng ở `AssignmentsPage`, `MyClassesPage`, `WorksheetRunner`. Test: `AssignmentWindowTest` (26 ca) — kiểm bằng mutation, **6/6 phép sửa đều làm suite đỏ**; `AssignmentProgressControllerTest` thêm 2 ca chặn DRAFT và quá hạn. Migration `V202608271000__assignment_lifecycle.sql` nay **đã chạy thật** trên PostgreSQL rỗng qua `SchemaMigrationTest` (xem HT-90) | `assignmentGate` không có test vì frontend chưa có test runner. Chưa có `assignment_targets` (giao theo nhóm / từng học sinh) |
| HT-51 | Chấm trắc nghiệm — một bản luật cho nộp bài, chấm lại và thống kê | **A** | `McqGrading` (chuẩn hoá đáp án, soát đề chấm được, soát bài nộp đủ câu, tính điểm thang 10); `WorksheetAnswerKeys` nạp đáp án cả phiếu bằng một truy vấn. Gọi từ `AssignmentProgressController.submit/saveAnswers` và `TeacherSubmissionController.regrade/analysis`. UI: `AssignmentAnalysisDialog.tsx` mở từ nút "Tỉ lệ đúng" trong `ClassTaskPanel.tsx`. Test: `McqGradingTest` (21 ca) — kiểm bằng mutation, **7/7 phép sửa đều làm suite đỏ** | Chưa có test cho `AssignmentAnalysisDialog` vì frontend chưa có test runner. Đề tự luận vẫn chỉ có điểm tổng + nhận xét chung, chưa chấm theo từng câu (#54) |
| HT-90 | Hạ tầng test — chạy migration trên PostgreSQL thật, không cần Docker | **A** | `pom.xml` thêm `io.zonky.test:embedded-database-spring-test` + `embedded-postgres` + binary `windows-amd64`; `src/test/resources/application-test.properties`; `SchemaMigrationTest` (7 ca) dựng cả ứng dụng trên CSDL rỗng. Kiểm bằng mutation: bỏ một cột khỏi migration, và bỏ một ràng buộc — cả hai lần suite đều đỏ | Chưa có `@DataJpaTest` cho tầng repository, và chưa có test runner cho frontend |
| HT-91 | Quyền — ma trận vai trò × endpoint | **A** | `PermissionMatrixTest`: 31 endpoint nhạy cảm × 4 tư cách (khách / học sinh / giáo viên / quản trị) = **123 ô**, dựng cả ứng dụng nên dùng đúng `SecurityConfig` và `@EnableMethodSecurity` của bản chạy thật. Kiểm bằng mutation, **3/3 phép sửa đều đỏ đúng chỗ**: gỡ guard của `/api/admin/dashboard` → 2 ô, nới guard của `/api/teacher/documents` → 1 ô, gỡ `@EnableMethodSecurity` → **38 ô** | Chỉ phủ cổng vai trò. Quyền theo từng bản ghi (giáo viên A đọc lớp của giáo viên B) chưa tách được khỏi cổng vai trò vì cần dữ liệu thật — ma trận IDOR ở Lát 2 |
| HT-92 | Quyền — ma trận IDOR, quyền theo từng bản ghi | **A** | `IdorMatrixTest`: dựng hai lớp học thật song song (giáo viên A/B, học sinh A/B, bài giao, phiếu, bài nộp, tài liệu) rồi cho mọi người gọi chéo sang phần của người kia — **162 ô**. Gồm 120 ô ma trận theo lớp (12 đường × 5 người × 2 lớp), 30 ô ma trận theo bản ghi, 6 phép thử đường ghi (mỗi phép soi lại CSDL để chắc lượt gọi bị chặn không kịp sửa gì), 4 nhóm quyền đọc file tài liệu, 2 ca điểm chưa công bố. Kiểm bằng mutation, **5/5 đợt sửa đều đỏ đúng số ô dự tính**: `ClassAccessGuard` → 36, `WorksheetController.owned` + `TeacherSubmissionController.checkClass` → 8, nhánh giáo viên của `DocumentServiceImpl.checkCanRead` → 3, `ownedDocument` + nhánh học sinh → 4, `AssignmentController.checkClassAccess` + `TeacherWorkspaceController.check` + `AssignmentProgressController.get` → 9 | Đường ghi chỉ chạy chiều chặn (chiều cho phép sẽ phá dữ liệu nền); bằng chứng "chủ sở hữu vào được" lấy từ các đường đọc tương ứng. Chưa phủ `/api/documents/{id}/thumbnail` và các đường quản trị lớp của Admin |
| HT-93 | Phiên đăng nhập — làm mới, đăng xuất, và thu hồi được token | **A** | Migration `V202608281000__refresh_token_index.sql`. API: `AuthController.refresh/logout`, `AuthServiceImpl` (token mờ 256 bit, chỉ lưu bản băm SHA-256, xoay vòng mỗi lượt làm mới, phát hiện token bị dùng lại thì cắt sạch phiên), `JwtService` chặn cấu hình sai ngay lúc khởi động, `SecurityConfig` mở `/api/auth/refresh` + `/api/auth/logout`. UI: `api.ts` (`refreshSession`, `logoutSession`, `accessTokenExpiresAt`), `App.tsx` tự làm mới trước hạn 2 phút và đăng xuất có gọi máy chủ, `ChangePasswordDialog` báo mọi phiên cũ đã bị thu hồi. Test: `AuthSessionLifecycleTest` (13 ca, chạy trên PostgreSQL nhúng) + `JwtServiceTest` (2 ca mới). Kiểm bằng mutation, **5/5 đợt sửa đều đỏ, không đợt nào xanh giả**: bỏ xoay vòng → 2, bỏ `noRollbackFor` → 2, `logout` không thu hồi → 2, lưu token gốc thay vì bản băm → 6, nới hạn access token → 2 | Chưa kiểm bằng trình duyệt: khởi động backend cục bộ sẽ áp migration mới lên Neon staging, mà việc đó đang bị hoãn. Chưa có danh sách thiết bị đang đăng nhập cho người dùng tự thu hồi, và chưa có việc dọn định kỳ các dòng `refresh_tokens` hết hạn |

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

**Ranh giới xác minh — đã khép lại.** Khi lát này vừa xong, migration chưa từng được thi hành ở
đâu; tôi mới chỉ đối chiếu tay từng cột với entity. Đối chiếu tay không phải bằng chứng tự động,
nên dòng này khi đó chấm **B**. Sau khi dựng embedded PostgreSQL (HT-90), `SchemaMigrationTest`
chạy cả 34 migration lên một CSDL rỗng rồi bắt `ddl-auto=validate` soi lại — nay là **A**.

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

## Chi tiết HT-90

Trước lát này repo có 38 controller, 55 entity, 34 migration — và **0 test nào chạm vào cơ sở dữ
liệu**. Toàn bộ test là Mockito thuần, nghĩa là không phép thử nào chứng minh được một migration
chạy được hay schema khớp entity. Mọi file SQL mới là lời hứa chưa kiểm.

Máy này **không có Docker**, nên Testcontainers không dùng được. Zonky tải binary PostgreSQL thật
về chạy trực tiếp, có bản Windows — đó là lý do chọn nó.

**Chỗ nguy hiểm nhất khi dựng, ghi lại để đừng ai gỡ nhầm:** `application.yml` cho Flyway một
chuỗi kết nối *riêng* (`spring.flyway.url: ${DATABASE_DIRECT_URL:${DATABASE_URL}}`). Nếu để
nguyên, test sẽ mở kết nối riêng của Flyway và **chạy migration thẳng lên Neon staging dùng
chung**, bất kể ứng dụng đang dùng CSDL nhúng. Nên có hai lớp chặn:

1. `pom.xml` trỏ `MATH10_ENV_FILE` sang một đường dẫn không tồn tại, nên phép import
   `optional:file:../.env.staging` rỗng — test không bao giờ cầm được chuỗi kết nối thật.
2. `application-test.properties` để trống `spring.flyway.url/user/password`, buộc Flyway dùng
   DataSource của ứng dụng, tức là CSDL nhúng.

Bằng chứng cả hai lớp đều ăn: log chạy test in `jdbc:postgresql://localhost:64358/twwxhqpklrmt`,
và `ddl-auto=validate` xanh — validate chỉ xanh được nếu Flyway đã dựng bảng **ở chính CSDL nhúng
đó**. Nếu Flyway đi nhầm sang staging thì CSDL nhúng sẽ trống trơn và validate đỏ ngay.

Phép đếm `số migration đã chạy == số file V*.sql` là để bắt lỗi đặt sai tên phiên bản: file nằm
đúng thư mục nhưng Flyway không nhặt, và loại lỗi đó im lặng cho tới lúc triển khai thật.

Đã kiểm bằng chứng: bỏ dòng tạo cột `open_at` khỏi migration → suite đỏ (`validate` báo thiếu
cột); bỏ ràng buộc `ck_assignments_open_before_due` → suite đỏ. Khôi phục xong `diff` xác nhận
file migration giống hệt byte.

## Chi tiết HT-91

Repo có 38 controller. Trước lát này **không phép thử nào gọi một endpoint bằng sai vai trò để
xem có bị chặn không** — toàn bộ quyền chỉ là chú thích `@PreAuthorize` chưa ai bấm thử.

`PermissionMatrixTest` gọi 31 endpoint nhạy cảm bằng cả bốn tư cách (khách, học sinh, giáo viên,
quản trị), 123 ô, mỗi ô một ca test có tên đọc được kiểu `HOC_SINH · GET /api/admin/dashboard →
chặn`.

**Vì sao dựng cả ứng dụng thay vì `@WebMvcTest` như kế hoạch ghi.** `@EnableMethodSecurity` nằm
trên `Math10BackendApplication`, chuỗi lọc thật nằm trong `SecurityConfig`. Lát cắt web dựng lại
một phiên bản gần đúng của hai thứ đó, nên nó có thể xanh trong khi bản chạy thật đang hở — đúng
loại sai lầm mà một ma trận quyền phải không được mắc. Phép thử mutation thứ ba dưới đây cho thấy
điều này không phải lo xa: gỡ `@EnableMethodSecurity` làm **38 ô đỏ**, mà một `@WebMvcTest` rất
có thể vẫn xanh. Cái giá là test cần CSDL nhúng của HT-90, chạy thêm khoảng 20 giây.

Quy ước khẳng định: bị chặn → **đúng 403**; đi qua → mã bất kỳ *trừ* 401/403. Ô "đi qua" phần lớn
trả 200 với danh sách rỗng, hoặc 404/400 vì id trong bảng cố tình là 999999. Như vậy là đủ, vì
câu hỏi duy nhất ở đây là "cổng vai trò có chặn không", không phải "endpoint trả đúng dữ liệu
chưa".

Bảng chỉ nhận những endpoint mà cổng vai trò là thứ **duy nhất** chặn. Chỗ nào còn một lớp kiểm
chủ sở hữu phía sau thì gỡ `@PreAuthorize` ra vẫn bị lớp kia đỡ, và ô đó sẽ xanh giả. Bốn đường
dẫn theo lớp (`/api/classes/**`, `/api/assignments?classId=`, `/api/teacher/submissions?classId=`)
vì thế nằm riêng ở nhóm "Quyền theo lớp", chỉ khẳng định hành vi quan sát được: quản trị đi tắt
qua cả hai lớp, ba vai còn lại đều 403. Tách hai lớp đó ra khỏi nhau cần dữ liệu thật (giáo viên A
và giáo viên B) — đó là việc của ma trận IDOR ở Lát 2.

Đã kiểm bằng chứng, cả ba phép sửa đều làm suite đỏ đúng chỗ:

1. Gỡ `@PreAuthorize("hasRole('ADMIN')")` khỏi `AdminDashboardController.dashboard` → đỏ đúng 2 ô
   (học sinh và giáo viên). Ô khách vẫn 403 — chuỗi lọc vẫn đòi đăng nhập, hai lớp là khác nhau.
2. Nới `@PreAuthorize` của `TeacherDocumentController` từ `hasRole('TEACHER')` sang
   `hasAnyRole('ADMIN','TEACHER')` → đỏ đúng 1 ô (quản trị).
3. Gỡ `@EnableMethodSecurity` khỏi `Math10BackendApplication` → **38 ô đỏ**.

Khôi phục xong `git status` xác nhận không file nguồn nào còn lệch.

Hai điều bảng này ghim lại, không phải lỗi nhưng nên biết:

- **Khách chưa đăng nhập nhận 403, không phải 401.** Chuỗi lọc không khai báo `formLogin` hay
  `httpBasic` nên Spring Security dùng `Http403ForbiddenEntryPoint`. Client vì thế không phân
  biệt được "chưa đăng nhập" với "sai vai trò". Token rác thì đúng 401, do
  `JwtAuthenticationFilter` tự trả.
- **Quản trị không vào được `/api/teacher/documents` và `/api/teacher/document-folders`** (chỉ
  `hasRole('TEACHER')`), trong khi vẫn vào được `/api/teacher/dashboard` và `/api/worksheets`.
  Bảng ghim đúng hành vi hiện tại; nếu đây là ngoài ý muốn thì sửa chú thích rồi sửa bảng.

## Chi tiết HT-92

HT-91 chỉ trả lời được "vai này có được gọi đường dẫn này không". Câu hỏi đắt hơn nằm ngoài tầm
của nó: **giáo viên B, một tài khoản hoàn toàn hợp lệ, có đọc được lớp của giáo viên A khi đoán
ra id không.** Muốn tách hai lớp chặn đó ra thì phải có dữ liệu thật, nên `IdorMatrixTest` dựng
hẳn hai lớp học song song và cho mọi người gọi chéo:

```
lớp A ── giáo viên A ── học sinh A ── bài giao A ── phiếu A ── tài liệu riêng A
lớp B ── giáo viên B ── học sinh B ── bài giao B ── phiếu B ── tài liệu riêng B
quản trị: không thuộc lớp nào, nhưng đi tắt qua mọi kiểm chủ sở hữu
```

Kỳ vọng của mỗi ô tính bằng một công thức duy nhất, không có ngoại lệ chép tay:
`qua = vaiHieuLuc.contains(vai) && (là quản trị || lớp của người gọi == lớp đang gọi)`. Công thức
này tự nó dự đoán đúng cả chỗ **quản trị bị chặn** ở `/api/student/classes/**` — cổng vai trò ở
đó chỉ mở cho `STUDENT`.

Ba quyết định đáng ghi lại, vì mỗi cái đều là cách né một loại xanh giả:

- **Cột `vaiHieuLuc` ghi theo hành vi thật, không chép `@PreAuthorize`.** `/api/classes/{id}/progress`
  khai báo cả ba vai ở cổng, nhưng `requireTeacher` phía sau loại học sinh ra, nên bảng ghi hai
  vai. Đợt mutation đầu tiên chứng minh việc này có giá trị: gỡ `ClassAccessGuard` làm đỏ **12 ô
  học sinh** — đúng những ô mà một bảng chép theo chú thích sẽ bỏ sót.
- **Tài liệu nền đều để `file_url` rỗng.** Nhờ vậy lượt gọi đi qua được guard sẽ dừng ở "tài liệu
  này không có file để xem" → **400**, còn bị chặn thì **403**. Khẳng định chốt được chính xác
  lượt gọi dừng ở đâu thay vì chỉ nói "không phải 403", và không cần khoá R2 nào. Đợt mutation
  thứ ba báo lỗi đúng dạng đó: `expected: 403 but was: 400`.
- **Đường ghi chọn loại không có thân yêu cầu** (`DELETE /api/assignments/{id}`,
  `PATCH .../return`, `PATCH .../archive`…). Tầng phân giải tham số chạy *trước* method security,
  nên một `@RequestBody` thiếu hoặc sai sẽ trả 400 cho mọi vai và che mất cổng quyền. Riêng
  `POST /api/classes/{id}/curriculum` gửi thân tối thiểu hợp lệ để qua tầng kiểm dữ liệu.

Đã kiểm bằng chứng. Năm đợt sửa, mỗi đợt nhắm một cổng ở một module khác nhau, **cả năm đều đỏ
đúng số ô dự tính từ trước — không dư, không thiếu**:

| Đợt | Chỗ vô hiệu hoá | Số ô đỏ | Vì sao đúng chừng đó |
|---|---|---|---|
| 1 | `ClassAccessGuard.requireTeacher` + `requireMember` | **36** | 22 ô chéo lớp trên 9 đường dùng guard, cộng 12 ô học sinh chạm vào 3 đường chỉ-giáo-viên của `ClassContentController`, cộng 2 phép thử ghi |
| 2 | `WorksheetController.owned` + `TeacherSubmissionController.checkClass` | **8** | 2 ô `submissions?classId`, 2 ô `worksheets/{id}`, 2 ô `analysis`, 2 phép thử ghi. `gradebook` vẫn xanh vì nó có bản kiểm lớp riêng |
| 3 | Nhánh giáo viên của `DocumentServiceImpl.checkCanRead` | **3** | Tài liệu riêng, tài liệu kho chung đã ẩn, tài liệu gắn lớp. Tài liệu kho chung đã xuất bản vẫn xanh vì vốn ai cũng đọc được |
| 4 | `ownedDocument` + nhánh học sinh của `checkCanRead` | **4** | 3 nhóm đọc tài liệu phía học sinh, cộng phép thử lưu trữ |
| 5 | `AssignmentController.checkClassAccess` + `TeacherWorkspaceController.check` + `AssignmentProgressController.get` | **9** | 4 ô `assignments?classId`, 2 ô `gradebook`, 2 ô `result`, 1 phép thử xoá bài giao |

Khôi phục xong, toàn bộ 396 phép thử xanh và `git status` xác nhận không file nguồn nào còn lệch.

Hai điều bảng này ghim lại:

- **Quyền đọc tài liệu của học sinh đến từ việc gắn lớp, không từ thuộc tính tài liệu.** Học sinh
  lớp A mở được tài liệu riêng của giáo viên A khi nó đã được gắn vào lớp A, dù `audience` vẫn là
  `TEACHER_ONLY`; học sinh lớp B thì không. Đây là hành vi cố ý, và là chỗ dễ sửa hỏng nhất khi
  ai đó dọn lại `checkCanRead`.
- **Điểm đã chấm nhưng chưa trả thì không lộ.** Học sinh gọi `/api/assignment-progress/{id}/result`
  nhận 200 với `gradingStatus = GRADED` nhưng `score` và `teacherFeedback` đều null, trong khi
  giáo viên phụ trách vẫn thấy đủ. Điều kiện là `returned_at` còn trống *và* `publish_score_at`
  còn ở tương lai.

## Chi tiết HT-93

Trước lát này, **một phiên đăng nhập đã cấp ra thì không có cách nào thu hồi**. Mất máy, khoá tài
khoản, đổi mật khẩu — token cũ vẫn dùng được cho tới khi hết hạn. Mà "cho tới khi hết hạn" là
**~41,7 ngày**: `application.yml` khai `jwt-expiration: 3600000` với tên biến môi trường
`JWT_EXPIRATION`, ai đọc cũng hiểu là mili-giây, còn `JwtService` cộng thẳng con số đó vào trường
`exp` của JWT — đơn vị **giây**. `SecurityConfig` thì đã mở sẵn `/api/auth/refresh` từ trước, chỉ
là endpoint chưa bao giờ tồn tại; entity `RefreshToken` và bảng `refresh_tokens` cũng có sẵn mà
không service nào đụng tới, nên `logout` ở frontend chỉ xoá `localStorage` — giấu token đi chứ
không giết nó.

Sáu quyết định đáng ghi lại:

- **Đổi hẳn tên biến môi trường**, `JWT_EXPIRATION` → `JWT_ACCESS_TTL_SECONDS` +
  `JWT_REFRESH_TTL_SECONDS`. Chỉ sửa giá trị mặc định là không đủ: giá trị `3600000` còn sót trên
  bảng điều khiển Render/Vercel sẽ lặng lẽ đè lên mặc định mới và bug quay lại nguyên vẹn. Đổi tên
  thì giá trị cũ hoá vô hại vì không ai đọc nó nữa. Kèm theo, `JwtService` **từ chối khởi động**
  với mọi giá trị ≤ 0 hoặc > 86400 — hỏng cấu hình thì gãy ngay lúc dựng bean, không chạy im ru
  suốt một tháng. Hai ca trong `JwtServiceTest` giữ chỗ này vĩnh viễn.
- **Refresh token là chuỗi ngẫu nhiên 256 bit, không phải JWT.** JWT tự xác thực bằng chữ ký, tức
  là không thu hồi được — đúng cái tính chất khiến access token nguy hiểm. Token mờ phải tra CSDL
  mới dùng được, mà đã tra CSDL thì thu hồi được. Trong bảng **chỉ có bản băm SHA-256**: đọc trộm
  `refresh_tokens` cũng không dựng lại được token gốc.
- **Xoay vòng mỗi lượt làm mới, và token bị dùng lại thì cắt sạch phiên.** Đổi token cũ lấy cặp
  mới xong thì token cũ chết ngay. Nếu về sau có ai xuất trình lại đúng token đã thu hồi, chỉ có
  hai khả năng — bản sao bị đánh cắp, hoặc bản gốc bị đánh cắp — và cả hai đều đáng thu hồi **toàn
  bộ** phiên của người đó chứ không chỉ lượt gọi này.
- **`@Transactional(noRollbackFor = BusinessException.class)`.** Đây là cái bẫy suýt làm biện pháp
  trên thành vô nghĩa. Nhánh phát hiện dùng lại vừa ghi thu hồi vừa ném `BusinessException`, mà
  Spring mặc định cuốn ngược giao dịch khi gặp `RuntimeException` — lệnh thu hồi bị xoá sạch, API
  vẫn trả lỗi đúng, nhìn bên ngoài không thấy gì bất thường. Đợt mutation thứ hai chứng minh chỗ
  này có giá trị: gỡ `noRollbackFor` làm đỏ 2 ca, đúng hai nhánh có ghi-rồi-ném (dùng lại token và
  tài khoản bị khoá).
- **`/auth/logout` để `permitAll`.** Access token hết hạn rồi thì vẫn phải đăng xuất được, nếu
  không thì đúng lúc cần thu hồi nhất lại là lúc không thu hồi nổi. Bản thân refresh token chính
  là bằng chứng sở hữu phiên cần thu hồi, không cần thêm bằng chứng nào khác.
- **Một thông điệp lỗi duy nhất cho mọi lý do refresh hỏng**, và logout luôn trả 200 dù token có
  tồn tại hay không. Phân biệt "token không tồn tại" với "token đã hết hạn" là biếu không cho
  người dò một kênh đếm token.

Phía frontend, `App.tsx` hẹn giờ đổi token trước hạn 2 phút, nhưng **chặn trên ở 25 phút**. Lý do
không hiển nhiên: phiên cũ còn trong `localStorage` mang access token 41,7 ngày, khoảng chờ tính ra
vượt 2^31 mili-giây, và `setTimeout` quá ngưỡng đó thì trình duyệt **kích hoạt ngay lập tức** thay
vì chờ — thành vòng lặp gọi API liên tục.

Đã kiểm bằng chứng. Năm đợt sửa, cả năm đều đỏ:

| Đợt | Chỗ vô hiệu hoá | Dự tính | Thực tế |
|---|---|---|---|
| 1 | Bỏ xoay vòng (không thu hồi token cũ sau khi đổi) | 2 | **2** |
| 2 | Bỏ `noRollbackFor` | 1 | **2** |
| 3 | `logout` không thu hồi gì | 2 | **2** |
| 4 | Lưu token gốc thay vì bản băm | 1 | **6** |
| 5 | Hạ TTL access token 1800 → 86400 | 2 | **2** |

Hai đợt đỏ nhiều hơn dự tính đều có lý do đúng, không phải khẳng định dính chùm. Đợt 2: nhánh tài
khoản bị khoá cũng ghi-rồi-ném theo đúng cơ chế đó. Đợt 4: ghi token gốc trong khi tra theo bản băm
làm gãy cả đường tra cứu, nên hỏng lan sang mọi ca dùng refresh — ô riêng về cách lưu trữ
(`chiLuuBanBam`) nằm trong số đó.

**Chưa kiểm bằng trình duyệt, và đây là chỗ hụt thật chứ không phải đã kiểm mà quên ghi.** Chạy
backend cục bộ sẽ áp migration mới lên Neon staging, việc đang bị hoãn có chủ đích. Bằng chứng
của tính năng này là 13 phép thử tích hợp trên PostgreSQL nhúng cộng với `npm run build` sạch;
luồng trình duyệt sẽ kiểm khi staging mở lại.

## Việc vận hành còn nợ

- **Chuyển bucket Cloudflare R2 sang private.** Mã nguồn nay không phát tán URL R2 nữa, nhưng
  các URL đã lộ trước đây vẫn mở được chừng nào bucket còn public. Đây là việc trên bảng điều
  khiển Cloudflare, không nằm trong repo.
- **Đặt lại biến môi trường tuổi thọ token trên Render/Vercel.** `JWT_EXPIRATION` **không còn được
  đọc nữa**; thay bằng `JWT_ACCESS_TTL_SECONDS=1800` và `JWT_REFRESH_TTL_SECONDS=2592000` (đơn vị
  giây). Nếu không đặt thì backend dùng đúng hai giá trị mặc định đó, nên không có nguy cơ gãy —
  nhưng giá trị cũ `3600000` để nguyên trên bảng điều khiển sẽ chỉ nằm đó gây hiểu nhầm, cần xoá.
