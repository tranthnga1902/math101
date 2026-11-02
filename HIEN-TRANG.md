# Hiện trạng thật của MATH10

File này ghi **mức xác minh** của từng phần, dựa trên bằng chứng đọc được trong mã nguồn —
không dựa trên trạng thái tự khai trong bảng tính kế hoạch.

Bảng được **bồi dần theo từng tính năng**: mỗi lần một tính năng được làm khép kín
(DB → API → UI → test) thì thêm/cập nhật đúng dòng của nó. Phần chưa soát thì để trống,
không đoán — một dòng đoán còn hại hơn một dòng trống.

> **Đọc chữ "chưa commit" trong file này như một mốc thời gian, không phải trạng thái.**
> Suốt thời gian soạn file này, toàn bộ module chương trình học và xưởng nội dung — 10 migration,
> hai module Java, ba trang giao diện — chỉ nằm trên đĩa, không có trong lịch sử git. Nhiều đoạn
> dưới đây lập luận dựa trên đúng điều đó ("migration chưa chạy ở đâu nên sửa tại chỗ được").
> Lập luận ấy đúng **vào lúc viết**. Nay đã commit thành sáu bản ghi, `7bde517` → `b57baeb`, nên từ
> giờ mỗi lần sửa schema là **một migration vá**, không sửa tại chỗ được nữa.

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
| HT-51 | Chấm trắc nghiệm — một bản luật cho nộp bài, chấm lại và thống kê | **A** | `McqGrading` (chuẩn hoá đáp án, soát đề chấm được, soát bài nộp đủ câu, tính điểm thang 10); `WorksheetAnswerKeys` nạp đáp án cả phiếu bằng một truy vấn. Gọi từ `AssignmentProgressController.submit/saveAnswers` và `TeacherSubmissionController.regrade/analysis`. UI: `AssignmentAnalysisDialog.tsx` mở từ nút "Tỉ lệ đúng" trong `ClassTaskPanel.tsx`. Test: `McqGradingTest` (**27 ca**, thêm 6 ca phân loại trắc nghiệm/tự luận ở lát HT-54) — kiểm bằng mutation, **7/7 phép sửa đều làm suite đỏ** | Chưa có test cho `AssignmentAnalysisDialog` vì frontend chưa có test runner. Phần tự luận nay tách sang **HT-54** |
| HT-54 | Chấm tự luận theo từng câu — cả đường nộp bài tự luận lẫn đường chấm | **A** | Migration `V202608281200__submission_item_grades.sql` (điểm để trống ≠ 0 điểm; dòng bị **xoá thẳng** vì ràng buộc duy nhất không tính `deleted_at`). Luật gom vào `WorksheetScoring` (trần điểm mỗi câu, chuẩn hoá bài tự luận, soát bài nộp phiếu trộn, tổng hợp về thang 10 theo **tỉ lệ**); `McqGrading.laTracNghiem` là chỗ duy nhất phân loại câu, dùng chung cho cả đường JDBC lẫn JPA. API: `PUT /api/teacher/submissions/{id}/grade-items`, `GET .../items`, bài nộp của học sinh nhận văn bản tự do cho câu tự luận, `GET /api/assignment-progress/{id}/result` trả bảng từng câu **sau khi trả bài** và không mang theo đáp án. Entity `SubmissionItemGrade` + repository. UI: `useGradingSheet.ts` (một chỗ quyết định chấm từng câu hay chấm cả bài) + `GradingSheetItems.tsx` dùng chung cho **hai** màn hình chấm (`TeacherSubmissionView`, `ClassGradingPanel`); `WorksheetRunner.tsx` cho học sinh gõ lời giải. Test: `WorksheetScoringTest` (27 ca) + `EssayGradingFlowTest` (20 ca, PostgreSQL nhúng, đi hết dây nộp → chấm dở → chốt → trả bài). Kiểm bằng mutation **6 đợt, 6/6 đều đỏ**, dự tính khớp thực tế 5/6 lần | Chưa kiểm bằng trình duyệt vì lý do như HT-93 (khởi động backend cục bộ sẽ áp migration lên Neon staging). Trần độ dài bài tự luận 5000 ký tự là số chọn tay, chưa có dữ liệu thật để hiệu chỉnh. Chưa có ô nhập công thức cho bài làm tự luận — học sinh gõ văn bản thuần |
| HT-59/60 | Sổ điểm — bảng lớp × bài giao, trạng thái chấm, và hàng đợi chấm bài | **A** | Truy vấn `/api/teacher/gradebook` trong `TeacherWorkspaceController` bỏ bài **nháp**, thêm cột `graded_items` (đếm câu đã có điểm), và đặt thứ tự đủ chặt để không đổi giữa hai lượt gọi (`full_name, u.id, created_at, a.id`). UI: `GradebookMatrix.tsx` tra ô bằng `Map` thay cho `rows.find` lồng nhau, bốn tầng `z-index` cho ô góc / hàng tiêu đề / cột tên, thêm cột trung bình; `TeacherGradingView.tsx` bỏ khung chấm **giả** (bốn ô "Câu 1…Câu 4" khoá cứng kèm dòng chữ báo chưa có endpoint lưu điểm — nay sai) và dùng thẳng `ClassGradingPanel`; `ClassGradingPanel.tsx` thêm ô tìm học sinh/bài. Test: `GradebookViewTest` (**13 ca**, PostgreSQL nhúng) — hình dạng bảng, trạng thái chấm, lớp 40 em × 12 bài. Kiểm bằng mutation **2 đợt, 2/2 đều đỏ**: bỏ lọc DRAFT → 1 ca, `graded_items` thành hằng số → 3 ca | Ba màn hình chấm cùng một bài nộp (`TeacherSubmissionView`, `ClassGradingPanel`, và sổ điểm) vẫn là ba nơi phải nhớ cùng một luật. Cột trung bình tính trên các bài **đã chốt điểm**, bài chấm dở không vào — chưa hỏi giáo viên xem có đúng ý không. Chưa kiểm bằng trình duyệt vì lý do như HT-93 |
| HT-95 | Ảnh bìa tài liệu — hiện được sau khi bucket chuyển private | **B** | `src/lib/authedImage.tsx`: `resolveApiUrl` (đường dẫn API là tương đối với backend, không phải với trang đang mở), `useAuthedImage` (tải kèm `Authorization`, đổi sang data URL, cache LRU 60 ảnh dùng chung), `AuthedImage`. Thay cho `<img src={thumbnailUrl}>` thô ở **5 chỗ**: `TextbookManagement`, `TeacherDocumentLibrary`, `AssignmentsPage`, và hai chỗ trong `StudentExperience`. `PdfThumbnail.tsx` bỏ bản sao riêng của `resolveUrl`/`blobToDataUrl`/`cache`, dùng chung mô-đun mới, và **khi ảnh bìa tải hỏng thì vẽ lấy trang 1 của PDF** thay vì trả ô xám. `npm run build` sạch | **Chưa có test** — frontend chưa có test runner, nên chỉ ở mức B. Sách tải lên **trước** khi có bước render bìa vẫn không có ảnh; đường sửa là `POST /api/admin/documents/backfill-thumbnails`, nhưng chạy nó là đụng dữ liệu thật nên chờ bạn quyết |
| HT-90 | Hạ tầng test — chạy migration trên PostgreSQL thật, không cần Docker | **A** | `pom.xml` thêm `io.zonky.test:embedded-database-spring-test` + `embedded-postgres` + binary `windows-amd64`; `src/test/resources/application-test.properties`; `SchemaMigrationTest` (7 ca) dựng cả ứng dụng trên CSDL rỗng. Kiểm bằng mutation: bỏ một cột khỏi migration, và bỏ một ràng buộc — cả hai lần suite đều đỏ | Chưa có `@DataJpaTest` cho tầng repository, và chưa có test runner cho frontend |
| HT-91 | Quyền — ma trận vai trò × endpoint | **A** | `PermissionMatrixTest`: 31 endpoint nhạy cảm × 4 tư cách (khách / học sinh / giáo viên / quản trị) = **123 ô**, dựng cả ứng dụng nên dùng đúng `SecurityConfig` và `@EnableMethodSecurity` của bản chạy thật. Kiểm bằng mutation, **3/3 phép sửa đều đỏ đúng chỗ**: gỡ guard của `/api/admin/dashboard` → 2 ô, nới guard của `/api/teacher/documents` → 1 ô, gỡ `@EnableMethodSecurity` → **38 ô** | Chỉ phủ cổng vai trò. Quyền theo từng bản ghi (giáo viên A đọc lớp của giáo viên B) chưa tách được khỏi cổng vai trò vì cần dữ liệu thật — ma trận IDOR ở Lát 2 |
| HT-92 | Quyền — ma trận IDOR, quyền theo từng bản ghi | **A** | `IdorMatrixTest`: dựng hai lớp học thật song song (giáo viên A/B, học sinh A/B, bài giao, phiếu, bài nộp, tài liệu) rồi cho mọi người gọi chéo sang phần của người kia — **162 ô**. Gồm 120 ô ma trận theo lớp (12 đường × 5 người × 2 lớp), 30 ô ma trận theo bản ghi, 6 phép thử đường ghi (mỗi phép soi lại CSDL để chắc lượt gọi bị chặn không kịp sửa gì), 4 nhóm quyền đọc file tài liệu, 2 ca điểm chưa công bố. Kiểm bằng mutation, **5/5 đợt sửa đều đỏ đúng số ô dự tính**: `ClassAccessGuard` → 36, `WorksheetController.owned` + `TeacherSubmissionController.checkClass` → 8, nhánh giáo viên của `DocumentServiceImpl.checkCanRead` → 3, `ownedDocument` + nhánh học sinh → 4, `AssignmentController.checkClassAccess` + `TeacherWorkspaceController.check` + `AssignmentProgressController.get` → 9 | Đường ghi chỉ chạy chiều chặn (chiều cho phép sẽ phá dữ liệu nền); bằng chứng "chủ sở hữu vào được" lấy từ các đường đọc tương ứng. Chưa phủ `/api/documents/{id}/thumbnail` và các đường quản trị lớp của Admin |
| HT-93 | Phiên đăng nhập — làm mới, đăng xuất, và thu hồi được token | **A** | Migration `V202608281000__refresh_token_index.sql`. API: `AuthController.refresh/logout`, `AuthServiceImpl` (token mờ 256 bit, chỉ lưu bản băm SHA-256, xoay vòng mỗi lượt làm mới, phát hiện token bị dùng lại thì cắt sạch phiên), `JwtService` chặn cấu hình sai ngay lúc khởi động, `SecurityConfig` mở `/api/auth/refresh` + `/api/auth/logout`. UI: `api.ts` (`refreshSession`, `logoutSession`, `accessTokenExpiresAt`), `App.tsx` tự làm mới trước hạn 2 phút và đăng xuất có gọi máy chủ, `ChangePasswordDialog` báo mọi phiên cũ đã bị thu hồi. Test: `AuthSessionLifecycleTest` (13 ca, chạy trên PostgreSQL nhúng) + `JwtServiceTest` (2 ca mới). Kiểm bằng mutation, **5/5 đợt sửa đều đỏ, không đợt nào xanh giả**: bỏ xoay vòng → 2, bỏ `noRollbackFor` → 2, `logout` không thu hồi → 2, lưu token gốc thay vì bản băm → 6, nới hạn access token → 2 | Chưa kiểm bằng trình duyệt: khởi động backend cục bộ sẽ áp migration mới lên Neon staging, mà việc đó đang bị hoãn. Chưa có danh sách thiết bị đang đăng nhập cho người dùng tự thu hồi, và chưa có việc dọn định kỳ các dòng `refresh_tokens` hết hạn |
| HT-94 | Nhật ký hoạt động — phủ hết thao tác đổi điểm và đổi quyền, lọc chạy dưới CSDL | **A** | Migration `V202608281100__audit_log_search.sql` (dựng lại `idx_audit_target` có thêm `created_at`, thêm `idx_audit_created`). API: nhật ký mở rộng từ 4 loại đối tượng lên **7** — thêm `ASSIGNMENT` (CREATE/UPDATE/DELETE/REGRADE), `SUBMISSION` (GRADE/RETURN), `DOCUMENT` (ARCHIVE/RESTORE/PUBLISH/HIDE/DELETE) và 6 thao tác `CLASS` về thành viên và tài liệu; `AuditController` lọc 6 tiêu chí dưới CSDL và **tự đặt thứ tự mặc định** `createdAt desc, id desc`. UI: `AuditManagement.tsx` lọc phía máy chủ + phân trang thật. Test: `AuditTrailTest` **16 ca** trên PostgreSQL nhúng. Chính bộ test này bắt được một lỗi thật: truy vấn lọc **trả 500 ở mọi lượt gọi** trên PostgreSQL. Kiểm bằng mutation 2 đợt, **7/7 phép sửa đều đỏ**: dự tính 3 → thực tế 4, dự tính 4 → thực tế 6 | Chưa gộp tên đối tượng thành hằng số dùng chung; lượt bị từ chối 403 chưa để lại dấu vết; `addCurriculum`/`removeCurriculum` cố ý chưa ghi; chưa kiểm bằng trình duyệt vì lý do như HT-93 |
| HT-96 | Chương trình học — ba tầng chương trình / mẫu / khóa theo năm | **C** | 7 migration (`V202608291000` → `V202608291600`) tạo **22 bảng**, `alter` 6 bảng cũ; 7 controller = **62 endpoint** (`programs/` 39, `teachercontent/` 17, học liệu giáo viên 6); UI `ProgramResourcePage.tsx`; `PermissionMatrixTest` đã phủ 9 endpoint. Test chức năng: 2 — `LichKhoaHocTheoNamTest` (1 ca) và `TeacherContentPipelineTest` (1 ca, đi hết dây tải lên → tách câu → duyệt → biến thể → dựng phiếu) — mở hai khóa 2026/2027 và 2027/2028 từ cùng một mẫu, mỗi khóa giữ lịch riêng. Chính nó bắt được lỗi Đ1 và là bằng chứng đỏ-rồi-xanh: trước khi sửa `PUT /api/admin/courses/2/schedule → 500 duplicate key … uq_program_schedule_chapter`, sau khi sửa xanh. Lượt chạy đó cũng là lần đầu **cả 45 migration chạy trên CSDL rỗng** — sạch; sau khi sửa, cả bộ `Tests run: 554, Failures: 0, Errors: 0` | Mức **C** chứ không phải B: **20/22 bảng không có entity**, chỉ chạm qua `JdbcTemplate`, nên `ddl-auto=validate` không canh được gì ở đây — 62 endpoint chạy trên vùng không ai canh. Chồng lịch nay đã chặn ở tầng CSDL nhưng bằng **trigger**, không chống được hai giao dịch đồng thời và canh chặt hơn bất biến đã phát biểu (Đ2); `worksheet_questions` là bảng chết đã đổ sẵn dữ liệu sai (Đ5), `documents.content_group` `not null default 'REFERENCE'` dán nhãn sai toàn bộ tài liệu cũ (Đ3). Toàn bộ **chưa commit**. Mục admin **"Khóa học"** (`KhoaHocManagement` trong `src/App.tsx`: bảng mẫu + tạo mẫu chương trình gọi `POST /api/admin/program-templates`, bảng khóa + tạo khóa, panel "Lịch chương" gọi `GET/PUT /api/admin/courses/{id}/schedule`) mới thêm, **chưa có test frontend** — chỉ dựa vào `LichKhoaHocTheoNamTest` canh phía máy chủ. Không có mẫu thì nút tạo khóa bị khoá; không có chương trình thì nút tạo mẫu bị khoá (dữ liệu seed `program_templates` chỉ sinh cho chương trình đã có lớp lúc chạy migration). Kế hoạch: [`docs/ke-hoach-admin-chuong-trinh.md`](docs/ke-hoach-admin-chuong-trinh.md) |
| HT-97 | Xưởng nội dung giáo viên — tải đề, tách câu hỏi, sinh biến thể, dựng phiếu | **C** | Migration `V202608291600`–`V202608291900` (9 bảng: `teacher_source_documents`, `document_blocks`, `extracted_questions`, `math_fragments`, `question_variants`, `worksheet_versions`, `document_templates`, `question_boundary_events`, `question_transformations`; thêm 7 cột snapshot vào `worksheet_items` và `assignments.worksheet_version_id`). API: `teachercontent/TeacherContentController` = **22 endpoint**. UI: `TeacherContentPipeline.tsx`, đã nối vào `App.tsx` ở mục `teacher-pipeline`. Test: `TeacherContentPipelineTest` — 1 ca đi trọn dây tải lên → tách khối → duyệt → biến thể → dựng phiếu, cộng 1 phép thử IDOR (giáo viên khác nhận 404); `QuestionMathAnalysisServiceTest` — 3 ca cho cổng chặn biến đổi; `QuestionTransformationServiceTest` — 40 biến thể của 4 dạng toán đều VALID; `QuestionTransformationEdgeCaseTest` — 3 ca biên (đáp án 0, đỉnh (0,0), `sin(x)` lọt cổng) | Mức **C**: 9 bảng, **0 entity**; 4 test cho 22 endpoint. Bước tách câu hỏi chạy bằng heuristic (`Cau 1.`, `A.`…`D.`, `Answer:`) và mới thử trên đúng một file đúng khuôn — đề thật sai khuôn sẽ tách sai **âm thầm**, không ném lỗi. `worksheet_versions` (#28/#45) đã nối vào đường giao bài và chấm điểm nhưng **chưa có test** chứng minh sửa phiếu sau khi giao không đổi bài đã nộp. Cổng chặn biến đổi phân loại dạng toán bằng khớp chuỗi nên `sin(x)` lọt qua thành biểu thức bậc nhất khi đề hỏi hệ số — đã có test chốt, **chưa sửa**. `validate()` của engine chỉ kiểm hình dạng (đủ bốn phương án khác nhau) chứ không kiểm toán, nên `VALID` không đồng nghĩa đề đúng. `question_boundary_events` chỉ ghi, không có đường đọc |

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

## Chi tiết HT-54

Việc này ghi trong bảng là "thêm ô chấm từng câu". Khi bắt tay vào mới thấy **hệ thống chưa có
đường tự luận nào cả**: bài nộp chỉ nhận A/B/C/D — `requireCompleteAnswers` từ chối mọi thứ khác —
và một bài chỉ có đúng một điểm tổng với một ô nhận xét chung. Không có gì để thêm ô chấm vào. Nên
lát này mở cả đường nộp trước, rồi mới có cái để chấm.

### Tổng điểm là tỉ lệ, không phải phép cộng

Chỗ này quyết định con số nằm trên học bạ, nên nói rõ. Trần điểm mỗi câu là `10 / số câu` làm tròn
hai chữ số. Đề 3 câu thì mỗi câu 3.33 — cộng thẳng lại là **9.99**, tức là học sinh làm đúng cả
bài vẫn không được 10.

Cách chữa quen thuộc là rải phần dư cho câu đầu (3.34 / 3.33 / 3.33). Cách đó còn hỏng nặng hơn:
hai em cùng đúng 2 trên 3 câu sẽ nhận điểm khác nhau tuỳ đúng câu nào — và đó là chỗ phụ huynh
hỏi mà không ai giải thích được. `tongHop` vì thế quy về tỉ lệ: `(Σ điểm) × 10 / (trần mỗi câu ×
số câu)`. Với đề toàn trắc nghiệm, công thức này **rút gọn về đúng** `số câu đúng / số câu × 10`,
nên **điểm của mọi bài đã chấm trước đây không đổi** — có một phép thử quét mọi cặp (đề 1…12 câu ×
đúng 0…n câu) đối chiếu thẳng với `McqGrading.grade` để giữ điều đó.

### "Chưa chấm" và "chấm rồi, được 0" là hai trạng thái khác nhau

`score` để trống trong `submission_item_grades` nghĩa là chưa ai đọc câu đó. Nếu gộp nó với 0 điểm
thì mọi bài giáo viên chưa mở ra đều tự chốt điểm — và con số ấy thấp hơn thật, hiện ra trước mắt
học sinh trong lúc giáo viên còn đang chấm dở. Nên `tongHop` trả `rawScore = null` khi còn câu
chưa chấm, bài ở lại trạng thái `SUBMITTED`, và chỉ chuyển `GRADED` khi `conThieu == 0`. Xoá trắng
một ô điểm đã chấm là **mở lại** bài, không phải cho 0.

Cột `max_score` được chép vào từng dòng lúc chấm chứ không tính lại từ số câu của đề mỗi lần đọc.
Thêm hay bớt một câu trong phiếu sau đó sẽ không lặng lẽ đổi thang điểm của những bài đã chấm xong.

### Hai màn hình chấm cùng một bài nộp

Đây là chỗ suýt hỏng. Có **hai** hộp chấm — mục "Chấm và trả điểm" và bảng chấm trong chi tiết lớp
— và `PUT /grade` (chấm cả bài) gọi `itemGrades.deleteByProgressId`. Nghĩa là giáo viên chấm 20 câu
tự luận ở màn hình này, đồng nghiệp gõ một điểm tổng ở màn hình kia, **toàn bộ điểm từng câu biến
mất** mà không ai được báo. Luật chọn đường chấm vì thế được nhấc lên `useGradingSheet` dùng chung,
để không màn hình nào tự quyết định lấy.

### Không để đáp án đi theo bảng chấm về phía học sinh

`GET /result` trả bảng từng câu, nhưng `publicCode`, `statement` và `correctOption` đều để trống —
học sinh cần biết mình mất điểm ở đâu, không cần đáp án của đề. Bài cho nộp nhiều lượt, hoặc giao
lệch giờ giữa các lớp, thì một em mở tab mạng của trình duyệt là cả khối có đáp án, mà không để lại
dấu vết nào. Phía giáo viên thì ngược lại, phải thấy đáp án mới chấm được — cùng một phép thử ghim
cả hai chiều.

### Đã kiểm bằng chứng. 6 đợt sửa, 6/6 đều đỏ

Suite xanh ngay lần chạy đầu, mà một phép thử chưa từng đỏ thì chưa chứng minh được gì. Sáu phép
sửa, mỗi phép nhắm đúng một khẳng định, dự tính trước rồi mới chạy:

| Phép sửa | Dự tính | Thực tế |
|---|---|---|
| Tổng = cộng thẳng thay vì tỉ lệ | ≥ 6 | **7** |
| Câu chưa chấm tính 0 điểm | 8 | **8** |
| `requireGradable` bỏ lưới trắc nghiệm thiếu đáp án | 1 | **1** |
| Bảng chấm phía học sinh mang theo đáp án | 1 | **1** |
| Nộp lại không xoá điểm từng câu lượt trước | 1 | **1** |
| Đường chấm từng câu quên trừ điểm nộp muộn | 1 | **1** |

Đợt đầu đỏ hơn dự tính một ca: `traRoiThiThay` — cùng một khẳng định về tỉ lệ, nhưng nhìn từ phía
học sinh. Đợt thứ tư đáng chú ý theo hướng khác: nó đỏ **đúng một ca trên toàn bộ 480**, nghĩa là
trước lát này không có lưới nào khác chặn đáp án lọt sang phía học sinh.

Toàn bộ suite backend: **480 ca, 0 lỗi** (trước lát này là 427). `npm run build` sạch.

### Cố ý chưa làm

- **Chưa có ô nhập công thức cho bài làm tự luận.** Học sinh gõ văn bản thuần. Làm tử tế thì phải
  kéo trình soạn công thức vào màn hình làm bài và soát lại phía máy chủ — là một lát riêng.
- **Trần 5000 ký tự là số chọn tay.** `answer_json` là cột text không giới hạn mà sổ điểm đọc cả
  cột đó cho từng bài, nên phải có trần; con số cụ thể chờ dữ liệu thật.
- **Chưa kiểm bằng trình duyệt.** Lý do như HT-93: chạy backend cục bộ sẽ áp migration mới lên Neon
  staging. Bằng chứng lát này là `EssayGradingFlowTest` đi hết dây trên PostgreSQL nhúng.

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

## Chi tiết HT-94

Trước lát này nhật ký ghi 4 loại đối tượng: `USER`, `COURSE`, `CLASS` (mỗi tạo/sửa/xoá lớp) và
`PROBLEM`. Nghĩa là **những thao tác đáng ngờ nhất trong một hệ thống dạy học lại không để lại dấu
vết nào**: chấm điểm, chấm lại cả lớp bằng một nút bấm, thêm và gỡ học sinh, gắn tài liệu vào lớp,
xuất bản hay ẩn tài liệu. Đổi điểm một học sinh, hay hạ điểm cả lớp vì sửa nhầm đáp án, đều không
có dòng nào nói ai làm và lúc nào. Lát này đưa số loại đối tượng lên **7** và phủ 30 điểm ghi.

### Lỗi thật mà bộ test bắt được: nhật ký trả 500 ở mọi lượt gọi

Đây là kết quả đáng giá nhất của lát. `AuditLogRepository.search` viết theo lối quen thuộc
`(:tham_so is null or cot = :tham_so)` cho cả sáu tiêu chí. Năm tiêu chí đầu là số và chuỗi nên
không sao. Tiêu chí thứ sáu là mốc thời gian, và ở đó câu truy vấn **gãy trên PostgreSQL**:

```
ERROR: could not determine data type of parameter $11
```

Nguyên nhân: trình điều khiển PostgreSQL không tự phân biệt được `timestamp` với `timestamptz`,
nên khi tham số thời gian mang giá trị null nó gửi kiểu "unspecified". Vế `? is null` đứng một
mình không có gì để CSDL suy ra kiểu, và cả câu truy vấn bị từ chối. Hệ quả: **`GET /api/audit-logs`
trả 500 ở *mọi* lượt gọi**, kể cả lượt không lọc gì — tức là màn hình nhật ký của quản trị viên
hỏng hoàn toàn, không phải hỏng ở một trường hợp biên.

Cách sửa: đưa tham số vào trong `coalesce` cạnh chính cột nó so sánh —
`l.createdAt >= coalesce(:from, l.createdAt)`. CSDL suy được kiểu từ cột, và khi không lọc ngày thì
vế này thành `created_at >= created_at`, luôn đúng.

Đáng nói là **lỗi này không thể lộ ra bằng unit test Mockito**, vì repository bị mock thì câu JPQL
không bao giờ chạm tới CSDL. Nó cũng không lộ ra ở H2 hay CSDL trong bộ nhớ. Phải là PostgreSQL
thật — đúng thứ mà HT-90 dựng lên — mới thấy.

### Thứ tự mặc định phải do máy chủ đặt

Truy vấn không có `order by`, và trước lát này **không chỗ nào cấp thứ tự mặc định**: không phải
repository, không phải service, không phải controller. Frontend thì tự gửi `sort=createdAt,desc`.
Hai chỗ hỏng:

- Bất kỳ lượt gọi nào không kèm tham số sắp xếp — công cụ khác, script, hay chính frontend sau một
  lần sửa — sẽ nhận về thứ tự tuỳ CSDL. Nhật ký không theo thời gian thì vô dụng.
- Ngay cả `createdAt,desc` cũng thiếu khoá phụ. Chấm lại cả lớp và nhập danh sách ghi **nhiều dòng
  trong cùng một thao tác**, cùng `created_at`. Sắp xếp chỉ theo thời gian thì thứ tự giữa những
  dòng đó không xác định, nên khi lật trang **cùng một dòng có thể hiện ở hai trang, hoặc không
  hiện ở trang nào** — đúng kiểu mất mát mà không ai để ý.

Nay `AuditController` khai `@PageableDefault(size = 50, sort = {"createdAt", "id"}, direction = DESC)`,
và `api.ts` **bỏ hẳn** tham số `sort` phía client — vì tham số của lời gọi đè lên mặc định, gửi
`createdAt,desc` chính là bỏ mất khoá phụ `id`.

### Hai chỗ dữ liệu nhạy cảm không được lọt vào nhật ký

Bảng nhật ký thì **mọi quản trị viên đều đọc được**, nên nó không phải chỗ đổ nguyên thân yêu cầu.

- `AddStudentRequest` mang **mật khẩu khởi tạo dạng chữ thường**. Nhật ký chỉ ghi mã học sinh và
  việc có tạo tài khoản mới hay không.
- `assignment_progress.answer_json` là **bài làm của học sinh**. Nhật ký chấm điểm chỉ ghi điểm và
  trạng thái.

Cả hai đều có ca test riêng, và mỗi ca có thêm một khẳng định "việc đó vẫn được ghi" để phép thử
phủ định không thể xanh giả vì đơn giản là chẳng có gì được ghi cả. Đợt mutation thứ hai chứng minh
cái chốt này hoạt động (xem bảng dưới).

### Đã kiểm bằng chứng. Hai đợt sửa, 7/7 phép sửa đều đỏ

| Đợt | Chỗ vô hiệu hoá | Dự tính | Thực tế |
|---|---|---|---|
| 1 | Bỏ thứ tự mặc định ở `AuditController` | 1 | **2** |
| 1 | `AuditServiceImpl` bỏ qua tham số `days` | 1 | **1** |
| 1 | Bỏ điều kiện vai trò trong truy vấn con | 1 | **1** |
| 2 | Bỏ ghi nhật ký `GRADE` | 1 | **2** |
| 2 | Bỏ ghi nhật ký `REGRADE` | 1 | **1** |
| 2 | Bỏ ghi nhật ký `DELETE DOCUMENT` | 1 | **1** |
| 2 | Đưa mật khẩu vào `new_data` của `ADD_STUDENT` | 1 | **2** |

Ba lần đỏ nhiều hơn dự tính, cả ba đều đúng chứ không phải khẳng định dính chùm:

- Bỏ thứ tự mặc định làm đỏ thêm `khongBiTrangDauNuot` — phép thử đó dựng sẵn nhiều dòng rồi lật
  trang để chứng minh không dòng nào bị nuốt, nên nó phụ thuộc vào thứ tự ổn định đúng như thiết kế.
- Bỏ ghi `GRADE` làm đỏ thêm `khongLoBaiLam`, ngay ở khẳng định chốt "việc chấm vẫn được ghi". Đây
  chính là chỗ đáng mừng: nó chứng minh phép thử "không lộ bài làm" không thể xanh giả.
- Rò mật khẩu làm đỏ thêm `thanhVienLop`, vì phép thử đó ghim nguyên chuỗi `new_data`. Hai lưới
  độc lập cùng bắt một lỗi.

Ngoài ra, chính lỗi 500 kể ở trên là một "đợt mutation tự nhiên": trước khi sửa, 5 ca trong nhóm
lọc đỏ hết; sau khi sửa, cả 16 ca xanh. Toàn bộ suite backend: **427 ca, 0 lỗi** (trước lát này là
411). `npm run build` sạch.

### Ba việc cố ý không làm trong lát này

Ghi lại để lát sau khỏi bàn lại:

- **Chưa gộp tên loại đối tượng thành hằng số dùng chung.** Sẽ phải sửa 5 module đã có từ trước,
  đụng vào code không thuộc lát này mà không thêm bằng chứng nào.
- **Chưa ghi nhật ký các lượt bị từ chối 403.** Về nguyên tắc thì đáng ghi, nhưng đặt vào
  `GlobalExceptionHandler` sẽ khiến ~285 ô của `PermissionMatrixTest` và `IdorMatrixTest` sinh ra
  dòng nhật ký trong lúc chạy. Cần tách kênh riêng trước, không làm kèm.
- **`addCurriculum`/`removeCurriculum` không ghi.** Đó là con trỏ chương trình học, không phải phép
  cấp quyền — khác hẳn `ATTACH_DOCUMENT` vốn mở đường cho học sinh đọc một tài liệu.

**Chưa kiểm bằng trình duyệt, cùng một lý do với HT-93**: khởi động backend cục bộ sẽ áp migration
mới lên Neon staging, việc đang bị hoãn có chủ đích. Bằng chứng của tính năng này là 16 phép thử
tích hợp trên PostgreSQL nhúng cộng `npm run build` sạch.

## Chi tiết HT-59/60

Sổ điểm đã chạy từ trước, nên lát này không thêm tính năng mới mà đi tìm chỗ nó **nói sai**. Tìm
được ba chỗ, cả ba đều thuộc loại không ai để ý cho tới lúc dùng thật.

### Bài nháp hiện trong sổ điểm của học sinh

Truy vấn `cross join assignments a` lấy **mọi** bài giao của lớp, kể cả bài `DRAFT`. Giáo viên soạn
dở một đề rồi để đó, thế là cả lớp có thêm một cột trắng trong sổ — trông y hệt một bài mà cả lớp
đều chưa làm. Không hỏng dữ liệu, nhưng nó biến sổ điểm thành thứ không đọc được: không phân biệt
được "chưa ai làm" với "chưa giao". Thêm `and a.status<>'DRAFT'`. Bài `CLOSED` thì **giữ lại** — đã
giao và đã chấm thì phải còn trong sổ, đóng cửa không phải là xoá.

### "Chờ chấm" và "chấm dở" trông giống hệt nhau

Bài chỉ chuyển sang `GRADED` khi **không còn câu nào trống điểm**. Nghĩa là một bài mới chấm 1 trong
2 câu tự luận vẫn mang `grading_status = SUBMITTED`, đúng như bài chưa ai đụng tới. Giáo viên chấm
dở 12 bài rồi nghỉ, hôm sau mở lên thấy con số "chờ chấm" y như cũ, không biết mình đã làm tới đâu.

Cột `graded_items` — đếm số dòng `submission_item_grades` đã có điểm — là thứ duy nhất tách được hai
nhóm đó, và `TeacherGradingView` nay hiện ba con số thay vì hai. Đây cũng là cột mà phép thử mutation
đánh mạnh nhất: đặt nó thành hằng số `0` làm **3 ca đỏ**, trong đó có ca "xoá điểm một câu thì bài mở
lại" — tức là cột này không chỉ để hiển thị, nó là bằng chứng cho cả chiều ngược của luồng chấm.

### Thứ tự các dòng đổi giữa hai lượt gọi

`order by u.full_name, a.created_at` không đủ chặt. Hai học sinh trùng tên — chuyện thường trong một
lớp 45 em — thì thứ tự giữa hai em do CSDL tuỳ ý quyết, và có thể **khác nhau ở hai lượt gọi liên
tiếp**. Sổ điểm là bảng người ta đọc bằng cách rà ngón tay theo hàng; hàng đổi chỗ sau khi bấm làm
mới là cách nhanh nhất để nhập nhầm điểm. Thêm `u.id` và `a.id` làm chốt chặn cuối.

### Khung chấm giả trong hàng đợi chấm bài

`TeacherGradingView` dựng bốn ô "Câu 1…Câu 4" khoá cứng, không liên quan gì tới đề thật, kèm một
dòng chữ báo rằng **chưa có endpoint lưu điểm**. Dòng đó nay sai — đường chấm từng câu đã có từ
HT-54 — và một màn hình nói với giáo viên rằng tính năng chưa tồn tại thì tệ hơn là không có màn
hình. Bỏ hẳn, dùng thẳng `ClassGradingPanel`. Cố ý **không** dựng bản sao thứ ba của hộp chấm: mỗi
màn hình chấm thêm là thêm một chỗ có thể quên luật "đề tự luận thì không gõ điểm cả bài", mà quên
một lần là `PUT /grade` xoá sạch bảng điểm từng câu bên kia vừa chấm.

### Lớp lớn

`GradebookMatrix` tra từng ô bằng `rows.find` lồng trong hai vòng lặp. Lớp 40 em × 12 bài là 480 ô,
mỗi ô quét trung bình nửa mảng 480 dòng — khoảng 115 nghìn phép so sánh mỗi lần vẽ lại, và vẽ lại
xảy ra ở mỗi lần gõ phím vào ô lọc. Thay bằng `Map` khoá `studentId:assignmentId`, dựng một lần.
Phép thử `bonMuoiEmMuoiHaiBai` chốt đúng 480 dòng và 480 ô **không trùng nhau**, nên nếu truy vấn
sau này sinh ra dòng thừa do join hỏng thì test đỏ chứ không phải người dùng phát hiện.

Ba tầng `z-index` cũng sai: ô góc, hàng tiêu đề và cột tên đều `sticky` nhưng không xếp hạng, nên
khi cuộn chéo thì cột tên vẽ đè lên hàng tiêu đề ở một số trình duyệt. Bốn tầng rõ ràng: góc 30,
tiêu đề cột 20, tiêu đề hàng 10, ô thường không đặt.

## Chi tiết HT-96

### Module này đã được code gần hết, và nằm ngoài git

Khảo sát cây làm việc cho ra con số không đọc được từ bảng tiến độ: **7 migration tạo
22 bảng, 7 controller mới mở 62 endpoint, và không có một dòng nào trong lịch sử git.** Mất máy là
mất trắng, và schema đã commit không khớp code.

Hai mươi hai bảng (con số của lúc khảo sát; `special_topics` đã bị bỏ ở Lát 5, còn 21):
14 bảng chương trình (`program_schedules`, `exercise_types`, `videos`,
`special_topics`, `program_resources`, `program_templates`, `program_template_chapters`,
`course_instances`, `teacher_resources`, `resource_shares`, `submissions`, `submission_answers`,
`submission_events`, `student_resource_progress`), 7 bảng xưởng nội dung giáo viên
(`teacher_source_documents`, `document_blocks`, `extracted_questions`, `math_fragments`,
`question_variants`, `worksheet_versions`, `document_templates`), và `worksheet_questions` —
một bảng không ai đọc.

### Vì sao mức C chứ không phải B

Mức B nghĩa là "đủ migration + API + UI, chỉ thiếu test". Ở đây thiếu nhiều hơn thế:
**20 trên 22 bảng không có entity JPA** — chỉ `ProgramSchedule` và `ExerciseType` có. Hai mươi bảng
còn lại chỉ được chạm qua chuỗi SQL trong `JdbcTemplate`.

Hệ quả không nằm ở chỗ "thiếu test": `ddl-auto=validate` — thứ đang canh cho 57 entity còn lại,
và là thứ đã bắt được lệch schema ở HT-90 — **không canh được gì ở vùng này**. Gõ sai tên cột trong
chuỗi SQL thì trình biên dịch im lặng, `validate` im lặng, và lỗi chỉ nổ khi có người dùng thật bấm
vào. Sáu mươi hai endpoint chạy trên vùng không ai canh, nên luồng chưa gọi là khép kín được.

### Lỗi đã bắt được: năm học thứ hai không xếp được lịch

`V202608291000` tạo `uq_program_schedule_chapter on program_schedules(course_id, chapter_id)`.
`V202608291300` thêm chỉ mục cho tầng khóa học **mà không gỡ chỉ mục cũ**, trong khi
`ProgramDeliveryController.saveSchedule` ghi cả hai cột — và mọi khóa của cùng một mẫu đều mang
chung một `course_id`.

Nên khóa 2026/2027 xếp Chương 1 thì qua, khóa 2027/2028 **cùng mẫu** xếp Chương 1 thì vỡ ràng
buộc. Tức là tách ba tầng ra rồi mà vẫn chỉ dùng được một năm — và lỗi im lặng suốt năm đầu, chạy
thử bằng tay không bao giờ thấy.

`LichKhoaHocTheoNamTest` dựng một mẫu, mở hai khóa, xếp lịch cho từng khóa. Dự tính viết ra trước
khi chạy: *hỏng ở lượt xếp lịch thứ hai*. Thực tế khớp:

```text
PUT /api/admin/courses/2/schedule → 500
duplicate key value violates unique constraint "uq_program_schedule_chapter"
Tests run: 1, Failures: 1
```

Sửa bằng cách thu hẹp chỉ mục cũ về đúng phạm vi nó còn cần — các dòng legacy chưa gắn khóa học
(`where deleted_at is null and course_instance_id is null`) — rồi chạy lại: `Tests run: 1,
Failures: 0`. Cặp đỏ-rồi-xanh này chính là bằng chứng mutation, không cần đợt gỡ guard riêng.

Lúc sửa, migration `V202608291300` còn chưa commit và **chưa chạy ở đâu**, kể cả staging, nên sửa được tại chỗ
mà không cần migration vá.

### Còn nợ, đã ghi thành quyết định trong kế hoạch

- **Đ2 — chồng lịch: đã xuống tầng CSDL, nhưng bằng trigger.** `V202608291500` thêm
  `program_schedule_no_overlap`, nên cả `ProgramScheduleController` (JPA) lẫn
  `ProgramDeliveryController` đều phải đi qua. Hai điều còn lại: trigger đọc bằng `SELECT` thường
  nên **hai giao dịch đồng thời vẫn lọt** (`exclude using gist` thì không có khe đó), và nó so mọi
  cặp dòng cùng khóa chứ không so theo chương — tức **cấm dạy song song hai chương**. Đó là một
  quyết định sư phạm đang nằm trong một trigger, chưa ai chốt và chưa có test nào nói là cố ý.
- **Đ5 — `worksheet_questions` là bảng chết đã đổ sẵn dữ liệu sai.** `V202608291500` tạo bảng rồi
  backfill từ `worksheet_items` với `question_type` đặt cứng `'FREE_RESPONSE'`, `answer_key` `NULL`,
  `max_score` `1` — trong khi ngân hàng có cả trắc nghiệm, có đáp án, và `WorksheetScoring` chấm
  theo trần điểm từng câu. Grep toàn repo ra **0 file đọc bảng này**, nên chưa hại ai; cái hại là
  người mở CSDL lần sau thấy một bảng đầy dữ liệu trông như đã dùng được. Phải quyết **trước khi
  commit**: bỏ bảng, hoặc giữ bảng nhưng bỏ backfill.
- **Đ3 — `documents.content_group not null default 'REFERENCE'`** biến mọi tài liệu đang có (SGK,
  đề thi, KHBD) thành "Tham khảo". Đó không phải "chưa phân loại", đó là **phân loại sai mà trông
  như đã phân loại** — bộ lọc sẽ báo "0 tài liệu Lý thuyết" trong khi kho đầy tài liệu lý thuyết.
- **`program_schedules.course_id` vẫn `not null`** dù suy được qua `course_instance_id`. Hai nguồn
  sự thật cho cùng một dữ kiện là mời chúng lệch nhau.

Kế hoạch đầy đủ, 20 lát và thứ tự làm, ở [`docs/ke-hoach-admin-chuong-trinh.md`](docs/ke-hoach-admin-chuong-trinh.md).

## Chi tiết HT-97

Module riêng, commit cùng đợt với HT-96 nhưng **không cùng phạm vi**: đây là xưởng soạn
nội dung của giáo viên (tải file → tách khối → nhận diện câu hỏi → sinh biến thể → dựng phiếu),
thuộc GĐ2/GĐ3 chứ không thuộc kế hoạch chương trình học.

`TeacherContentPipelineTest` đi trọn một dây thật trên PostgreSQL nhúng: nộp file `.txt`, kiểm
`document_blocks` và `math_fragments` có sinh ra, giáo viên khác gọi vào nhận **404**, duyệt câu,
sinh biến thể `PARAMETER_CHANGE` rồi soi `validation_status = 'VALID'`, cuối cùng dựng phiếu và
xác nhận `worksheet_items.content_snapshot` không rỗng. Một phép thử phủ được nhiều mắt xích là
tốt cho việc chốt "dây có nối" — nhưng khi nó đỏ thì không chỉ ra được mắt xích nào hỏng, và
17 endpoint thì còn 16 đường chưa đi.

Chỗ mỏng nhất là **bước tách câu hỏi**: nó đọc `Cau 1.`, `A.`…`D.`, `Answer:`, `Solution:` bằng
heuristic. Phép thử đang cho nó đúng một file đúng khuôn. Đề thật gõ bằng Word, chia hai cột, đánh
số `Câu 1:` hay `Bài 1.`, công thức nằm trong ảnh — mỗi cái là một đường sai **âm thầm**: không
ném lỗi, chỉ tách sai rồi ghi vào CSDL. Cần một bộ file mẫu thật trước khi tin con số
`confidence`.

`worksheet_versions` cũng nằm trong migration này và **đã nối thật** — `AssignmentController` chốt
version lúc giao bài, `WorksheetAnswerKeys` nạp đáp án theo version, `StudentLearningController` và
`AssignmentProgressController` đọc theo `worksheet_version_id`. Đây chính là #28/#45 (bản bất biến
của phiếu). Nhưng **chưa có test cho điều nó sinh ra để làm**: sửa phiếu sau khi giao thì bài đã
nộp có còn chấm theo bản gốc không. Một phép thử, chưa viết — nên chưa tính #28/#45 là xong.

### Cổng chặn biến đổi tự động — đúng hướng, còn một lỗ

`V202608291800` cộng `QuestionMathAnalysisService` dựng một **cổng chặn theo danh sách trắng**:
chỉ cho phép biến đổi tự động khi *dạng toán* và *ý định câu hỏi* đều nhận diện được với độ tin cậy
≥ 0.85, công thức parse được, cấu trúc câu đủ, **và** cặp (dạng, ý định) nằm trong bảng `compatible`.
Không đạt thì `transformable=false` kèm lý do bằng tiếng Việt. Đây là thiết kế đúng: **sai thì đóng**,
chứ không đoán bừa. `QuestionMathAnalysisServiceTest` phủ ba ca, trong đó có một ca bị chặn.

Lỗ nằm ở chỗ `signature()` phân loại bằng khớp chuỗi chứ không parse:

```java
boolean quadratic = x.matches(".*x(?:\\^2|²).*"), linear = x.matches(".*x.*") && !quadratic;
```

"Có chữ `x` và không có `x^2`" thì gọi là **biểu thức bậc nhất**. Nên `sin(x)` ra
`LINEAR_EXPRESSION` với confidence `.88` — chính test đang chốt hành vi này ở ca thứ ba. Ca đó
không nổ vì ý định là `UNKNOWN` nên cổng chặn lại. Nhưng đổi đề bài một chữ:

| Đề | signature | intent | Cổng |
|---|---|---|---|
| `Tính biểu thức sin(x)` | `LINEAR_EXPRESSION` .88 | `UNKNOWN` .20 | **chặn** (đúng) |
| `Tìm hệ số của sin(x)` | `LINEAR_EXPRESSION` .88 | `IDENTIFY_COEFFICIENT` .90 | **cho qua** |

Dòng thứ hai qua đủ năm điều kiện — `compatible` có cặp `LINEAR_EXPRESSION` × `IDENTIFY_COEFFICIENT`
— nên câu lượng giác được đánh dấu `transformable=true`, `transform_level='LEVEL_2'`.

**Đã dựng test, đã đỏ đúng chỗ dự đoán**: `QuestionTransformationEdgeCaseTest.trigonometryPassesGateThenEngineRefuses`
chốt cả bốn bước trên. Nhưng nó cũng cho thấy **thiệt hại nhỏ hơn tôi viết ban đầu**: engine
`generate()` phân nhánh theo `math_signature`, và `LINEAR_EXPRESSION` không có nhánh nào, nên rơi
vào `default -> throw new BusinessException("Dạng toán chưa có rule biến đổi")`. Tức là máy **không**
sinh ra biến thể lượng giác sai — nó ném lỗi. Hại thật sự chỉ là: giao diện báo câu đó "đủ điều
kiện biến đổi" (sai), giáo viên bấm thì thất bại, và trong biến đổi hàng loạt nó cộng vào cột
thất bại mà không rõ vì sao. Phiền, không phải hỏng dữ liệu. Tôi đã sửa lại câu này — bản trước
tôi viết là "an toàn để máy tự sinh biến thể", nói quá mức nguy hiểm.

Cách sửa rẻ nhất vẫn như cũ: bắt `linear` phải là *chỉ* gồm ký tự của biểu thức đa thức, thay vì
chỉ cần chứa `x`; mọi thứ khác rơi về `UNSUPPORTED`. Cùng lỗ này còn ăn cả `\max`, `\exp`,
`\text{...}` — bất cứ lệnh LaTeX nào có chữ `x`. **Chưa sửa**: quyết định cái gì được tính là "toán
hỗ trợ được" là quyết định thiết kế của người sở hữu module, không phải việc vá lén trong lúc đi
ngang.

### Lỗi phương án nhiễu bịa ra — đã sửa

`QuestionTransformationEdgeCaseTest.zeroAnswerStillGivesFourRealDistractors` và
`zeroVertexStillGivesFourRealDistractors` chốt lỗi thứ hai, nặng hơn vì nó **tới tận mắt học sinh**.
Bộ sinh phương án cũ lấy đúng bốn ứng viên rồi khử trùng lặp; hết thì chắp chuỗi cho đủ bốn:

```java
while(unique.size()<4) unique.add(a+" + "+n++);
```

Khi đáp án bằng 0 thì `"x = 0"` và `"x = -0"` là một, còn ba, nên phương án thứ tư sinh ra là
`"x = 0 + 1"`. Đỉnh `(0, 0)` là ca tệ nhất: cả bốn ứng viên rút về một chuỗi, ba phương án còn lại
đều là rác. Và `validate()` vẫn đóng dấu **VALID**, vì nó chỉ đếm "bốn chuỗi có khác nhau không" —
nó kiểm *hình dạng*, không kiểm *toán*.

Sửa: mỗi hàm sinh phương án nay đưa 6–7 ứng viên có nghĩa (thêm `correct±1`, `correct±2`, lệch từng
toạ độ), lấy bốn cái khác nhau đầu tiên; **hết ứng viên thì trả map rỗng** để `validate()` đánh
INVALID. Thà không sinh được biến thể còn hơn sinh ra phương án bịa rồi đưa cho học sinh chọn.

Ghi lại một giới hạn để khỏi đọc nhầm về sau: `validation_status='VALID'` **không** có nghĩa là đề
và đáp án đúng toán. Nó chỉ nói: có nội dung, có đáp án, đúng bốn phương án khác nhau, đáp án nằm
trong đó. Đúng toán là do công thức sinh đảm bảo, không do khâu kiểm này.

Cần đọc thêm một điều về con số "40/40 biến thể VALID": `QuestionTransformationServiceTest` ghi
thẳng `math_signature`/`transformable` vào CSDL bằng SQL, nên nó **không đi qua** cổng chặn
`QuestionMathAnalysisService`. 40/40 chứng minh engine sinh đúng khi đã biết dạng toán; nó không
chứng minh được hệ thống nhận dạng đúng dạng toán. Hai chuyện khác nhau.

## Việc vận hành còn nợ

- **Chuyển bucket Cloudflare R2 sang private.** Mã nguồn nay không phát tán URL R2 nữa, nhưng
  các URL đã lộ trước đây vẫn mở được chừng nào bucket còn public. Đây là việc trên bảng điều
  khiển Cloudflare, không nằm trong repo.
- **Chạy `POST /api/admin/documents/backfill-thumbnails` một lượt.** Sách và tài liệu tải lên
  **trước** khi có bước render bìa không có ảnh nào trong kho, nên dù HT-95 đã sửa đường tải ảnh,
  những cuốn đó vẫn hiện ô chữ thay cho bìa. Endpoint để sửa đã có sẵn; đây là lượt gọi ghi vào
  dữ liệu thật nên chờ bạn quyết, không tự chạy.
- **Đặt lại biến môi trường tuổi thọ token trên Render/Vercel.** `JWT_EXPIRATION` **không còn được
  đọc nữa**; thay bằng `JWT_ACCESS_TTL_SECONDS=1800` và `JWT_REFRESH_TTL_SECONDS=2592000` (đơn vị
  giây). Nếu không đặt thì backend dùng đúng hai giá trị mặc định đó, nên không có nguy cơ gãy —
  nhưng giá trị cũ `3600000` để nguyên trên bảng điều khiển sẽ chỉ nằm đó gây hiểu nhầm, cần xoá.
