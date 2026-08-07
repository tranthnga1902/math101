create table problem_progress (
    id bigserial primary key,
    student_id bigint not null references users(id),
    problem_id bigint not null references problems(id),
    status varchar(30) not null default 'IN_PROGRESS',
    opened_at timestamp,
    completed_at timestamp,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_problem_progress unique(student_id, problem_id),
    constraint ck_problem_progress_status check(status in ('IN_PROGRESS', 'COMPLETED'))
);

create index idx_problem_progress_student on problem_progress(student_id) where deleted_at is null;
