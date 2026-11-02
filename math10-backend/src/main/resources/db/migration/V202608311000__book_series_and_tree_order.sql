-- Bộ SGK và chốt chặn thứ tự cây chương trình.
--
-- Bộ SGK: cùng một khối lớp được dạy theo nhiều bộ sách (Cánh Diều / KNTT / CTST). Hôm nay điều đó
-- chỉ nằm trong tên chương trình dưới dạng chữ, nên không lọc được, không đếm được, và hai người
-- gõ hai kiểu là thành hai bộ sách khác nhau. Tách ra bảng riêng để chương trình trỏ tới.

create table book_series (
    id bigserial primary key,
    code varchar(50) not null,
    name varchar(180) not null,
    publisher varchar(180),
    status varchar(30) not null default 'ACTIVE',
    order_no int not null default 0,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint ck_book_series_status check (status in ('ACTIVE', 'INACTIVE'))
);
create unique index uq_book_series_code on book_series(code) where deleted_at is null;
create index idx_book_series_order on book_series(order_no) where deleted_at is null;

alter table courses add column if not exists book_series_id bigint references book_series(id);
create index idx_courses_book_series on courses(book_series_id) where deleted_at is null;

-- Thứ tự chương và bài: ràng buộc đã có từ baseline, nhưng là ràng buộc bảng nên nó tính cả dòng
-- đã xoá mềm. Hệ quả: xoá Chương 3 rồi tạo Chương 3 mới thì CSDL từ chối, vì dòng cũ vẫn giữ chỗ
-- số 3 mãi mãi. Người dùng thấy "số thứ tự đã tồn tại" trong khi trên màn hình không có chương nào
-- mang số đó — không có cách nào đoán ra, và không có cách nào chữa ngoài việc đổi số cả cây.
--
-- Đổi sang chỉ mục duy nhất từng phần: vẫn cấm hai chương đang sống trùng số, nhưng dòng đã xoá
-- thì trả lại chỗ. Đây là đúng hình dạng mà exercise_types và program_resources đã dùng.
alter table chapters drop constraint if exists uq_chapters_order;
create unique index uq_chapters_order on chapters(course_id, order_index) where deleted_at is null;

alter table lessons drop constraint if exists uq_lessons_order;
create unique index uq_lessons_order on lessons(chapter_id, order_index) where deleted_at is null;
