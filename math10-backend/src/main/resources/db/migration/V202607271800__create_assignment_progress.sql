create table assignment_progress (
    id bigserial primary key,
    assignment_id bigint not null references assignments(id),
    student_id bigint not null references users(id),
    opened_at timestamp,
    completed_at timestamp,
    completion_percent int not null default 0,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_assignment_progress unique(assignment_id, student_id)
);
create index idx_assignment_progress_student on assignment_progress(student_id) where deleted_at is null;
