-- 3-Tier: Class Schedule & Course Delivery Sessions
--
-- Đây là migration cho mô hình 3 tầng: Program → Course → Class.
-- Program sở hữu nội dung (program_periods).
-- Course sở hữu cách chia nội dung thành các buổi (course_delivery_sessions).
-- Class sở hữu toàn bộ lịch thực tế (class_schedule).
--
-- Không xóa, không sửa bảng cũ. Các bảng mới hoàn toàn độc lập.

-- 1. Ngày khai giảng của lớp.
--    Admin nhập; không thể suy ra từ bất kỳ dữ liệu nào khác.
alter table classes add column if not exists start_date date;
comment on column classes.start_date is
    'Ngày khai giảng thực tế của lớp. Admin nhập; dùng để sinh class_schedule.';

-- 2. Buổi học của Khóa — không mang ngày.
--    Một khóa chia program_periods thành các buổi theo nhịp (tiet_moi_tuan).
--    Hai lớp cùng course_instance dùng chung bảng này;
--    lịch ngày thực của từng lớp nằm ở class_schedule.
create table if not exists course_delivery_sessions (
    id                 bigserial primary key,
    course_instance_id bigint not null references course_instances(id),
    seq                int not null,
    session_type       varchar(30) not null default 'TEACHING',
    title              varchar(255),
    note               varchar(500),
    source             varchar(20) not null default 'GENERATED',
    created_at         timestamp not null,
    updated_at         timestamp not null,
    deleted_at         timestamp,
    constraint ck_cds_seq  check (seq >= 1),
    constraint ck_cds_type check (session_type in
        ('TEACHING','REVIEW','EXAM','ACTIVITY')),
    constraint ck_cds_source check (source in ('GENERATED','MANUAL'))
);
create unique index if not exists uq_cds_seq
    on course_delivery_sessions(course_instance_id, seq)
    where deleted_at is null;
create index if not exists idx_cds_instance
    on course_delivery_sessions(course_instance_id)
    where deleted_at is null;

comment on table  course_delivery_sessions is
    'Buổi học của Khóa. Không mang ngày — lịch ngày thực nằm ở class_schedule.';
comment on column course_delivery_sessions.seq is
    'Thứ tự buổi trong khóa, tăng từ 1. Unique per course_instance.';
comment on column course_delivery_sessions.source is
    'GENERATED = máy sinh; MANUAL = admin điều chỉnh. Lượt sinh lại chỉ ghi đè GENERATED.';

-- 3. Các tiết (program_periods) trong một buổi.
--    Một tiết chỉ thuộc đúng một buổi TRONG CÙNG KHÓA (unique trên course_instance_id +
--    program_period_id) — một mẫu chương trình mở nhiều năm học (nhiều course_instance)
--    thì mỗi năm vẫn phải chia lại được toàn bộ program_periods của mình.
--    course_instance_id lưu trùng (denormalize) từ course_delivery_sessions để unique index
--    dùng được — bảng này không tự join sang đó.
create table if not exists course_delivery_session_units (
    id                          bigserial primary key,
    course_delivery_session_id  bigint not null
                                references course_delivery_sessions(id),
    course_instance_id         bigint not null
                                references course_instances(id),
    program_period_id           bigint not null
                                references program_periods(id),
    order_in_session            int not null,
    created_at                  timestamp not null,
    updated_at                  timestamp not null,
    deleted_at                  timestamp,
    constraint ck_cdsu_order check (order_in_session >= 1)
);
-- Một tiết chỉ thuộc đúng một buổi trong cùng khóa (khác course_instance thì được dùng lại)
create unique index if not exists uq_cdsu_period
    on course_delivery_session_units(course_instance_id, program_period_id)
    where deleted_at is null;
create unique index if not exists uq_cdsu_order
    on course_delivery_session_units(course_delivery_session_id, order_in_session)
    where deleted_at is null;
create index if not exists idx_cdsu_session
    on course_delivery_session_units(course_delivery_session_id)
    where deleted_at is null;

comment on table course_delivery_session_units is
    'Các tiết (program_periods) thuộc một buổi học. Một tiết chỉ xuất hiện trong một buổi.';

-- 4. Lịch ngày thực của Lớp.
--    Mỗi dòng = một buổi của lớp, có ngày cụ thể.
--    Hai lớp cùng course_instance có class_schedule hoàn toàn khác nhau.
--    Buổi bù (is_makeup=true) được phép trùng course_delivery_session_id.
create table if not exists class_schedule (
    id                          bigserial primary key,
    class_id                    bigint not null references classes(id),
    course_delivery_session_id  bigint not null
                                references course_delivery_sessions(id),
    seq                         int not null,
    scheduled_date              date not null,
    start_time                  time,
    status                      varchar(30) not null default 'PLANNED',
    taught_by                   bigint references users(id),
    completed_at                timestamp,
    completed_source            varchar(30),
    edited_manually             boolean not null default false,
    is_makeup                   boolean not null default false,
    note                        varchar(500),
    created_at                  timestamp not null,
    updated_at                  timestamp not null,
    deleted_at                  timestamp,
    constraint ck_cs_status check (status in
        ('PLANNED','COMPLETED','POSTPONED','CANCELLED')),
    constraint ck_cs_complete check (
        completed_at is null or status = 'COMPLETED'),
    constraint ck_cs_source check (
        completed_source is null or completed_source in
        ('TEACHER_ACTION','ADMIN_OVERRIDE')),
    constraint ck_cs_seq check (seq >= 1)
);
-- Mỗi buổi chỉ xếp một lần / lớp (trừ buổi bù)
create unique index if not exists uq_class_schedule_session
    on class_schedule(class_id, course_delivery_session_id)
    where deleted_at is null and is_makeup = false;
-- Đọc lịch theo ngày
create index if not exists idx_class_schedule_date
    on class_schedule(class_id, scheduled_date)
    where deleted_at is null;
-- Đọc tiến độ: planned vs actual
create index if not exists idx_class_schedule_status
    on class_schedule(class_id, status, seq)
    where deleted_at is null;
-- Đường tra ngày kết thúc dự kiến
create index if not exists idx_class_schedule_seq_desc
    on class_schedule(class_id, seq desc)
    where deleted_at is null;

comment on table  class_schedule is
    'Lịch ngày thực của Lớp. Hai lớp cùng khóa có class_schedule hoàn toàn khác nhau.';
comment on column class_schedule.edited_manually is
    'true = admin/GV chỉnh tay; regenerate không được ghi đè dòng này.';
comment on column class_schedule.is_makeup is
    'true = buổi dạy bù; cho phép trùng course_delivery_session_id trong cùng lớp.';
comment on column class_schedule.completed_source is
    'Ai/cái gì xác nhận hoàn thành: TEACHER_ACTION hoặc ADMIN_OVERRIDE.';
