-- Nhóm nội dung: "chưa phân loại" phải nói ra được, và chỉ nhận đúng bốn giá trị.
--
-- Cột này ra đời với `not null default 'REFERENCE'`. Nghĩa là mọi tài liệu trong kho — sách giáo
-- khoa, đề thi, kế hoạch bài dạy — lập tức mang nhãn "Tham khảo" mà không một ai chọn nhãn đó. Cái
-- hỏng không phải là nhãn sai, mà là nhãn sai trông y hệt nhãn đúng: bộ lọc sẽ báo "0 tài liệu Lý
-- thuyết" trong khi kho đầy tài liệu lý thuyết, và người nhìn không có cách nào phân biệt nhãn máy
-- dán với nhãn người chọn. Để trống thì thiếu dữ liệu hiện ra đúng như nó là: thiếu.
--
-- Đổ null cho toàn bộ dòng đang mang 'REFERENCE' chứ không dò xem dòng nào là nhãn thật: entity
-- Document không hề ánh xạ cột này và không câu SQL nào trong mã ghi vào nó, nên đến giờ chưa từng
-- có một dòng nào do người chọn. Đoán bằng `updated_at = created_at` sẽ lại là một lớp dữ liệu bịa
-- nữa chồng lên lớp cũ. Chừa lại các giá trị khác 'REFERENCE' (nếu ai đó từng sửa tay bằng SQL) —
-- xoá cả những dòng đó mới đúng là phá dữ liệu người ta cố ý nhập.
alter table documents alter column content_group drop default;
alter table documents alter column content_group drop not null;
update documents set content_group = null where content_group = 'REFERENCE';

-- Video cũng phải để trống được, vì cùng một lý do và thêm một lý do nữa: đường ghi video nhận
-- thẳng giá trị người dùng gửi lên, gửi thiếu thì cột not null ném lỗi CSDL 500 chứ không nói được
-- "chưa phân loại". Ở đây không đổ null: video có đường ghi thật, nên 'THEORY' trong bảng videos
-- có thể là do người chọn — không được phép đoán ngược lại.
alter table videos alter column content_group drop default;
alter table videos alter column content_group drop not null;

-- Một danh sách dùng chung cho cả hai bảng. Bốn giá trị này trả lời "dùng vào lúc nào trong quá
-- trình học", cố ý không lặp lại doc_type (SGK/SBT/KHBD/VIDEO/DE_THI) vốn trả lời "đây là loại ấn
-- phẩm gì". Một quyển SBT có thể đóng vai PRACTICE, một đề thi cũ có thể đóng vai PRACTICE chứ
-- không phải ASSESSMENT — hai cột trả lời hai câu hỏi khác nhau thì mới đứng cạnh nhau được; trùng
-- câu hỏi là sớm muộn hai cột nói ngược nhau và không ai biết tin cột nào.
alter table documents add constraint ck_documents_content_group
    check (content_group is null or content_group in ('THEORY','PRACTICE','ASSESSMENT','REFERENCE'));
alter table videos add constraint ck_videos_content_group
    check (content_group is null or content_group in ('THEORY','PRACTICE','ASSESSMENT','REFERENCE'));
