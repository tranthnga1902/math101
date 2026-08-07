create table if not exists documents (
    id bigserial primary key,
    title varchar(255) not null,
    doc_type varchar(30) not null,
    audience varchar(30) not null,
    file_url varchar(1024) not null,
    grade_id bigint references grades(id),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    deleted_at timestamp
);

create table if not exists lesson_documents (
    id bigserial primary key,
    lesson_id bigint not null references lessons(id),
    document_id bigint not null references documents(id),
    is_required boolean not null default false,
    teacher_note text,
    display_order int not null,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    deleted_at timestamp,
    constraint uq_lesson_documents_order unique (lesson_id, display_order)
);

create index if not exists idx_documents_grade_type on documents(grade_id, doc_type) where deleted_at is null;
create index if not exists idx_lesson_documents_lesson_order on lesson_documents(lesson_id, display_order) where deleted_at is null;

update grades
set code = 'GRADE_10',
    grade_number = 10,
    name = 'Lớp 10',
    updated_at = now()
where code = 'GRADE_9' and deleted_at is null;

insert into grades (code, grade_number, name, created_at, updated_at)
select 'GRADE_10', 10, 'Lớp 10', now(), now()
where not exists (select 1 from grades where code = 'GRADE_10' and deleted_at is null);

insert into metadata_options (category, value, label, sort_order) values
('DOCUMENT_TYPE', 'SGK', 'Sách giáo khoa', 10),
('DOCUMENT_TYPE', 'SBT', 'Sách bài tập', 20),
('DOCUMENT_TYPE', 'KHBD', 'Kế hoạch bài dạy', 30),
('DOCUMENT_TYPE', 'VIDEO', 'Video', 40),
('DOCUMENT_AUDIENCE', 'TEACHER_ONLY', 'Chỉ giáo viên', 10),
('DOCUMENT_AUDIENCE', 'STUDENT_ALLOWED', 'Cho học sinh xem', 20)
on conflict (category, value) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    active = true,
    updated_at = now();
