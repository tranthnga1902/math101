-- Chốt buổi: lớp nào đã học xong tiết nào, lúc mấy giờ.
--
-- Buổi vẫn KHÔNG mang ngày. Bảng này không ghi lịch dự kiến mà ghi một sự kiện đã xảy ra —
-- giáo viên bấm "hoàn thành buổi 7" thì lúc bấm là dữ liệu, còn buổi 7 vẫn là buổi 7 của chương
-- trình, dùng chung cho mọi lớp. Đây chính là "bảng tiến độ riêng của lớp" mà
-- V202608311100__class_courses_tro_sang_khoa.sql đã hứa: lớp chạy lệch thì ghi ở đây, không đẻ
-- ra lịch thứ hai.
--
-- Có bảng này thì hạn nộp mới nói được câu "nộp trước buổi sau" — thứ giáo viên thật sự nói —
-- thay vì bắt họ gõ tay một ngày cho từng bài giao rồi sửa lại từng bài mỗi lần đổi lịch.

create table class_period_progress (
    id bigserial primary key,
    class_id  bigint not null references classes(id),
    period_id bigint not null references program_periods(id),
    -- Giờ chốt là mốc mở bài giao neo vào tiết này, nên nó là dữ liệu chứ không phải dấu vết:
    -- không dùng created_at, vì dạy bù xong mới bấm thì hai giờ ấy khác nhau.
    closed_at timestamp not null,
    closed_by bigint not null references users(id),
    note varchar(500),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

-- Một lớp chốt một tiết đúng một lần. Chốt hai lần là mở lại bài giao đã mở với một mốc giờ mới,
-- và không có gì báo — nên chặn ở CSDL chứ không chỉ ở tầng ứng dụng.
create unique index uq_class_period_closed on class_period_progress(class_id, period_id)
    where deleted_at is null;

-- Đường đọc thật của màn Buổi học: "lớp này chốt tới đâu rồi", tức là các mốc gần nhất.
create index idx_class_period_recent on class_period_progress(class_id, closed_at desc)
    where deleted_at is null;
