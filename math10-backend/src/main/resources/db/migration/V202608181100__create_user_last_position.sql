-- Vị trí học gần nhất của mỗi người dùng. Lưu ở server chứ không phải localStorage để
-- đổi máy vẫn học tiếp được. Mỗi người đúng một dòng nên user_id làm luôn khóa chính.
-- context để jsonb: sau này muốn lưu thêm trang PDF đang xem hay câu số mấy thì không phải migrate lại.

create table if not exists user_last_position (
    user_id bigint primary key references users(id) on delete cascade,
    route varchar(512) not null,
    context jsonb,
    updated_at timestamp not null default now()
);
