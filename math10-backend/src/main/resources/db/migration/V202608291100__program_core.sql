-- Batch A: courses tiếp tục là physical table của Program để giữ tương thích.
alter table courses add column if not exists published_by bigint references users(id);
alter table courses add column if not exists published_at timestamp;
alter table chapters add column if not exists description text;

create table exercise_types (
    id bigserial primary key,
    lesson_id bigint not null references lessons(id),
    name varchar(180) not null,
    description text,
    order_index int not null,
    status varchar(30) not null default 'DRAFT',
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);
create unique index uq_exercise_types_order on exercise_types(lesson_id, order_index) where deleted_at is null;
create index idx_exercise_types_lesson on exercise_types(lesson_id) where deleted_at is null;
