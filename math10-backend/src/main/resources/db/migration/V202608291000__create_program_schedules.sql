-- Lịch chương trình là dữ liệu hệ thống, áp dụng giống nhau cho mọi học sinh.
-- Tiến độ cá nhân không tham gia xác định chương hiện hành.
create table program_schedules (
    id bigserial primary key,
    course_id bigint not null references courses(id),
    chapter_id bigint not null references chapters(id),
    starts_on date not null,
    ends_on date not null,
    status varchar(20) not null default 'ACTIVE',
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint ck_program_schedules_dates check (starts_on <= ends_on),
    constraint ck_program_schedules_status check (status in ('ACTIVE', 'INACTIVE'))
);

create unique index uq_program_schedule_chapter
    on program_schedules(course_id, chapter_id) where deleted_at is null;
create index idx_program_schedule_current
    on program_schedules(course_id, starts_on, ends_on)
    where deleted_at is null and status = 'ACTIVE';
