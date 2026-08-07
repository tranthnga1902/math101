create table assignments (
    id bigserial primary key,
    class_id bigint not null references classes(id),
    lesson_id bigint references lessons(id),
    title varchar(255) not null,
    due_at timestamp,
    status varchar(30) not null,
    created_by bigint not null references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);
create index idx_assignments_class on assignments(class_id) where deleted_at is null;
