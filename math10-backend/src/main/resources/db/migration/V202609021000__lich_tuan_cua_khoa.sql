-- Lịch tuần: nối số tuần của chương trình với ngày tháng của một khóa cụ thể.
--
-- Chương trình nói "tuần 12 Thống kê vào thay chỗ Hình học" mà không biết tuần 12 rơi vào ngày nào,
-- và đó là đúng — chương trình dùng lại cho nhiều khóa, mỗi khóa khai giảng một ngày khác. Bảng này
-- là chỗ duy nhất hai thứ ấy gặp nhau, nên nó gắn vào khóa triển khai chứ không vào chương trình.
--
-- Không có bảng này thì "tuần này là tuần mấy" phải tính bằng một công thức trừ ngày ở mỗi màn hình
-- cần nó, và mọi công thức ấy sẽ cùng sai vào tuần đầu tiên sau Tết.

create table course_weeks (
    id bigserial primary key,
    course_instance_id bigint not null references course_instances(id),
    week_no int,
    starts_on date not null,
    ends_on date not null,
    is_break boolean not null default false,
    break_label varchar(200),
    edited_by_hand boolean not null default false,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint ck_course_week_dates check (starts_on <= ends_on),
    constraint ck_course_week_no    check (week_no is null or week_no >= 1),
    -- Tuần nghỉ KHÔNG tiêu số tuần. Nghỉ Tết một tuần thì tuần học kế tiếp vẫn là tuần tiếp theo
    -- trong chương trình, chỉ lùi ngày lại — nên tuần nghỉ có mặt trong lịch nhưng không mang số,
    -- còn tuần học thì bắt buộc mang số. Ràng buộc này ở CSDL chứ không chỉ trong bộ sinh, vì đây
    -- là chỗ mà một dòng sai sẽ làm lệch toàn bộ phần lịch còn lại mà không báo gì.
    constraint ck_course_week_break check (is_break = (week_no is null))
);

-- Hai tuần không được bắt đầu cùng ngày trong một khóa, và một số tuần không được xuất hiện hai lần.
-- Chỉ mục thứ hai lọc dòng nghỉ ra vì tuần nghỉ vốn không mang số, mà nhiều dòng null thì không
-- phải là trùng.
create unique index uq_course_week_start on course_weeks(course_instance_id, starts_on)
    where deleted_at is null;
create unique index uq_course_week_no on course_weeks(course_instance_id, week_no)
    where deleted_at is null and week_no is not null;

-- Đường đọc thật là "khóa này, hôm nay rơi vào tuần nào", tức là dò một ngày nằm giữa hai cột ngày.
create index idx_course_week_lookup on course_weeks(course_instance_id, starts_on, ends_on)
    where deleted_at is null;

-- edited_by_hand là cột cứu mạng. Nghỉ bão, dạy bù, lệch lịch trường — chắc chắn sẽ xảy ra, và
-- công thức thuần không xử lý được. Khi admin sinh lại lịch, những tuần mang cờ này giữ nguyên ngày
-- của chúng và lượt sinh phải báo rõ đã bỏ qua bao nhiêu tuần. Không có cột này thì người ta chỉnh
-- tay xong, tuần sau bấm sinh lại, và mất sạch mà không biết mình vừa mất gì.
