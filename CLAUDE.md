# Math10 — bối cảnh

Trung tâm dạy thêm, không phải trường học.
Spring Boot + React/TS, Neon PG17, Flyway, Cloudflare R2.

## Bất di bất dịch
- Buổi KHÔNG gắn ngày. Ngày ở course_sessions theo lớp.
- Quyền đọc nằm trong MỘT hàm duy nhất, trong câu query.
- Reach (đi tới đâu) tách khỏi audience (ai đọc được).
- Không migration nào xóa cột.
- Thêm khối (11, 12) phải là một câu INSERT, không phải một commit.
- Mỗi lần giáo viên sửa đầu ra của mô hình đều ghi lại cặp trước/sau. Ghi đè là mất vĩnh viễn.

## Đang làm
Lát #23 — neo bài giao vào buổi.

## Đề tài phần B — khung đã chốt
`DE-TAI-QWEN3.md` (chốt 19/09/2026). Ba chức năng cho **giáo viên**: bóc tách đề có vòng
lặp tự sửa, gắn nhãn chương trình, sinh lời giải cho câu đã biết đáp án. Mọi đầu ra của mô
hình đều có hàm kiểm chứng tự động và vào hệ thống ở trạng thái nháp. Việc không nằm trong
file đó thì không làm — muốn thêm thì sửa file đó trước.

## Đã bác bỏ (đừng đề xuất lại)
- Elasticsearch — Postgres FTS đủ dùng
- Vai trò phụ huynh — dùng báo cáo gửi đi
- Chống gian lận bằng chặn tab
- Gia sư ảo cho học sinh — mô hình 3–4B bịa lời giải toán trôi chảy
- API AI ngoài (Gemini/OpenAI/Mathpix/Coze cloud) — chạy cục bộ hết
- Coze Studio trong sản phẩm — kéo theo Elasticsearch + Milvus + MySQL + MinIO
- LLM sinh câu hỏi mới — rule + sympy giữ nguyên