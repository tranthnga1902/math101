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

## Việc vận hành còn nợ

- **Chuyển bucket Cloudflare R2 sang private.** Mã nguồn nay không phát tán URL R2 nữa, nhưng
  các URL đã lộ trước đây vẫn mở được chừng nào bucket còn public. Đây là việc trên bảng điều
  khiển Cloudflare, không nằm trong repo.
