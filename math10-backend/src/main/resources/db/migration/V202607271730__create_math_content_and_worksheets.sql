create table topics (
    id bigserial primary key,
    name varchar(180) not null,
    description text,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table problem_types (
    id bigserial primary key,
    topic_id bigint not null references topics(id),
    name varchar(180) not null,
    recognition_signs text,
    general_method text,
    solution_outline text,
    common_mistakes text,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table problems (
    id bigserial primary key,
    problem_type_id bigint not null references problem_types(id),
    public_code varchar(30) not null unique,
    qr_slug varchar(8) not null unique,
    statement_latex text not null,
    difficulty varchar(30) not null,
    status varchar(30) not null,
    created_by bigint references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table problem_hints (
    id bigserial primary key,
    problem_id bigint not null references problems(id),
    content_latex text not null,
    order_index int not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_problem_hints_order unique(problem_id, order_index)
);

create table solution_steps (
    id bigserial primary key,
    problem_id bigint not null references problems(id),
    title varchar(180) not null,
    content_latex text not null,
    order_index int not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_solution_steps_order unique(problem_id, order_index)
);

create table worksheets (
    id bigserial primary key,
    name varchar(255) not null,
    columns_count int not null default 1,
    show_qr boolean not null default true,
    show_student_fields boolean not null default true,
    created_by bigint not null references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table worksheet_items (
    id bigserial primary key,
    worksheet_id bigint not null references worksheets(id),
    problem_id bigint not null references problems(id),
    order_index int not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_worksheet_items_order unique(worksheet_id, order_index),
    constraint uq_worksheet_problem unique(worksheet_id, problem_id)
);

alter table assignments add column worksheet_id bigint references worksheets(id);
create index idx_problem_types_topic on problem_types(topic_id) where deleted_at is null;
create index idx_problems_type_status on problems(problem_type_id, status) where deleted_at is null;
create index idx_hints_problem_order on problem_hints(problem_id, order_index) where deleted_at is null;
create index idx_solutions_problem_order on solution_steps(problem_id, order_index) where deleted_at is null;
create index idx_worksheet_items_order on worksheet_items(worksheet_id, order_index) where deleted_at is null;
