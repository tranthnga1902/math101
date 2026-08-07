create table if not exists lesson_document_questions (
    id bigserial primary key,
    lesson_document_id bigint not null references lesson_documents(id),
    question_text text not null,
    option_a text not null,
    option_b text not null,
    option_c text not null,
    option_d text not null,
    correct_option varchar(1) not null,
    explanation text,
    display_order integer not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint ck_lesson_document_questions_correct_option check (correct_option in ('A','B','C','D'))
);

create index if not exists idx_lesson_document_questions_document
    on lesson_document_questions(lesson_document_id, display_order)
    where deleted_at is null;

create table if not exists lesson_document_progress (
    id bigserial primary key,
    lesson_document_id bigint not null references lesson_documents(id),
    student_id bigint not null references users(id),
    status varchar(30) not null default 'NOT_OPENED',
    opened_at timestamptz,
    last_opened_at timestamptz,
    open_count integer not null default 0,
    total_seconds integer not null default 0,
    quiz_score integer,
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    deleted_at timestamptz,
    constraint ck_lesson_document_progress_status check (status in ('NOT_OPENED','IN_PROGRESS','NEEDS_REVIEW','COMPLETED')),
    constraint uq_lesson_document_progress_student unique (lesson_document_id, student_id)
);
