-- G7: Weekly schedule slots per class
-- Each slot = one teaching session (day + time + duration + periods taught).
-- Derived fields (sessions/week, total periods/week) computed, never stored.

create table if not exists class_schedule_slots (
    id            bigserial primary key,
    class_id      bigint    not null references classes(id),
    day_of_week   int       not null check (day_of_week between 1 and 7), -- 1=Mon, 7=Sun
    start_time    time      not null,
    duration_min  int       not null check (duration_min > 0),
    periods       int       not null check (periods > 0) default 2,
    created_at    timestamptz not null default now(),
    updated_at    timestamptz not null default now()
);

create index if not exists idx_schedule_slots_class on class_schedule_slots(class_id);

comment on table  class_schedule_slots is 'Mẫu lịch tuần: mỗi dòng là một buổi học cố định trong tuần';
comment on column class_schedule_slots.day_of_week is '1=Thứ Hai … 7=Chủ nhật';
comment on column class_schedule_slots.periods     is 'Số tiết dạy trong buổi này (có thể khác giữa các slot)';

-- G11: Holiday / day-off table
create table if not exists holidays (
    id           bigserial primary key,
    holiday_date date         not null,
    name         varchar(255) not null,
    is_day_off   boolean      not null default true,
    year         int          not null,
    note         varchar(500),
    unique (holiday_date)
);

comment on table holidays is 'Ngày lễ / ngày nghỉ. Admin nhập; không tính bằng công thức vì âm lịch và nghỉ bù thay đổi hằng năm.';

-- Seed 2026
insert into holidays(holiday_date,name,is_day_off,year) values
 ('2026-01-01','Tết Dương lịch',true,2026),
 ('2026-01-27','Tết Nguyên đán (29 tháng Chạp)',true,2026),
 ('2026-01-28','Tết Nguyên đán (30 tháng Chạp)',true,2026),
 ('2026-01-29','Tết Nguyên đán (Mùng 1)',true,2026),
 ('2026-01-30','Tết Nguyên đán (Mùng 2)',true,2026),
 ('2026-01-31','Tết Nguyên đán (Mùng 3)',true,2026),
 ('2026-02-01','Tết Nguyên đán (Mùng 4)',true,2026),
 ('2026-02-02','Tết Nguyên đán (Mùng 5)',true,2026),
 ('2026-04-07','Giỗ Tổ Hùng Vương',true,2026),
 ('2026-04-30','Ngày Giải phóng miền Nam',true,2026),
 ('2026-05-01','Ngày Quốc tế Lao động',true,2026),
 ('2026-09-02','Quốc khánh',true,2026),
 ('2026-09-03','Nghỉ bù Quốc khánh',true,2026)
on conflict(holiday_date) do nothing;

-- Seed 2027
insert into holidays(holiday_date,name,is_day_off,year) values
 ('2027-01-01','Tết Dương lịch',true,2027),
 ('2027-02-15','Tết Nguyên đán (29 tháng Chạp)',true,2027),
 ('2027-02-16','Tết Nguyên đán (30 tháng Chạp)',true,2027),
 ('2027-02-17','Tết Nguyên đán (Mùng 1)',true,2027),
 ('2027-02-18','Tết Nguyên đán (Mùng 2)',true,2027),
 ('2027-02-19','Tết Nguyên đán (Mùng 3)',true,2027),
 ('2027-02-20','Tết Nguyên đán (Mùng 4)',true,2027),
 ('2027-02-21','Tết Nguyên đán (Mùng 5)',true,2027),
 ('2027-03-27','Giỗ Tổ Hùng Vương',true,2027),
 ('2027-04-30','Ngày Giải phóng miền Nam',true,2027),
 ('2027-05-01','Ngày Quốc tế Lao động',true,2027),
 ('2027-09-02','Quốc khánh',true,2027)
on conflict(holiday_date) do nothing;

-- Seed 2028
insert into holidays(holiday_date,name,is_day_off,year) values
 ('2028-01-01','Tết Dương lịch',true,2028),
 ('2028-02-04','Tết Nguyên đán (29 tháng Chạp)',true,2028),
 ('2028-02-05','Tết Nguyên đán (30 tháng Chạp)',true,2028),
 ('2028-02-06','Tết Nguyên đán (Mùng 1)',true,2028),
 ('2028-02-07','Tết Nguyên đán (Mùng 2)',true,2028),
 ('2028-02-08','Tết Nguyên đán (Mùng 3)',true,2028),
 ('2028-02-09','Tết Nguyên đán (Mùng 4)',true,2028),
 ('2028-02-10','Tết Nguyên đán (Mùng 5)',true,2028),
 ('2028-04-15','Giỗ Tổ Hùng Vương',true,2028),
 ('2028-04-30','Ngày Giải phóng miền Nam',true,2028),
 ('2028-05-01','Ngày Quốc tế Lao động',true,2028),
 ('2028-09-02','Quốc khánh',true,2028)
on conflict(holiday_date) do nothing;
