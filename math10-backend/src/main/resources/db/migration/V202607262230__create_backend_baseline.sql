create table roles (
    id bigserial primary key,
    code varchar(50) not null unique,
    name varchar(120) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table users (
    id bigserial primary key,
    email varchar(180) not null unique,
    password_hash varchar(255) not null,
    full_name varchar(120) not null,
    phone varchar(30),
    role_code varchar(30) not null,
    status varchar(30) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table refresh_tokens (
    id bigserial primary key,
    user_id bigint not null references users(id),
    token_hash varchar(255) not null unique,
    expires_at timestamp not null,
    revoked_at timestamp,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table subjects (
    id bigserial primary key,
    code varchar(50) not null unique,
    name varchar(120) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table grades (
    id bigserial primary key,
    code varchar(50) not null unique,
    grade_number int not null,
    name varchar(120) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table courses (
    id bigserial primary key,
    code varchar(50) not null unique,
    name varchar(255) not null,
    description text,
    status varchar(30) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table course_teachers (
    id bigserial primary key,
    course_id bigint not null references courses(id),
    teacher_id bigint not null references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_course_teachers unique (course_id, teacher_id)
);

create table chapters (
    id bigserial primary key,
    course_id bigint not null references courses(id),
    title varchar(255) not null,
    order_index int not null,
    status varchar(30) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_chapters_order unique (course_id, order_index)
);

create table lessons (
    id bigserial primary key,
    chapter_id bigint not null references chapters(id),
    title varchar(255) not null,
    public_code varchar(80) unique,
    summary text,
    order_index int not null,
    status varchar(30) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_lessons_order unique (chapter_id, order_index)
);

create table file_assets (
    id bigserial primary key,
    file_name varchar(255) not null,
    file_url varchar(1024) not null,
    mime_type varchar(255) not null,
    file_size bigint not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table lesson_resources (
    id bigserial primary key,
    lesson_id bigint not null references lessons(id),
    type varchar(30) not null,
    title varchar(255) not null,
    external_url varchar(1024),
    file_asset_id bigint references file_assets(id),
    text_content text,
    order_index int not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_lesson_resources_order unique (lesson_id, order_index)
);

create table classes (
    id bigserial primary key,
    code varchar(50) not null unique,
    name varchar(120) not null,
    grade_id bigint not null references grades(id),
    status varchar(30) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create table class_teachers (
    id bigserial primary key,
    class_id bigint not null references classes(id),
    teacher_id bigint not null references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_class_teachers unique (class_id, teacher_id)
);

create table class_students (
    id bigserial primary key,
    class_id bigint not null references classes(id),
    student_id bigint not null references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_class_students unique (class_id, student_id)
);

create table class_courses (
    id bigserial primary key,
    class_id bigint not null references classes(id),
    course_id bigint not null references courses(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_class_courses unique (class_id, course_id)
);

create table learning_progress (
    id bigserial primary key,
    student_id bigint not null references users(id),
    lesson_id bigint not null references lessons(id),
    opened_at timestamp,
    completed_at timestamp,
    completion_percent int not null default 0,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint uq_learning_progress unique (student_id, lesson_id)
);

create table audit_logs (
    id bigserial primary key,
    actor_user_id bigint references users(id),
    action varchar(80) not null,
    target_type varchar(80) not null,
    target_id bigint,
    metadata text,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

insert into roles (code, name, created_at, updated_at) values
('ADMIN', 'Administrator', now(), now()),
('TEACHER', 'Teacher', now(), now()),
('STUDENT', 'Student', now(), now());

insert into subjects (code, name, created_at, updated_at) values
('MATH', 'Toan hoc', now(), now());

insert into grades (code, grade_number, name, created_at, updated_at) values
('GRADE_9', 9, 'Lop 9', now(), now());

create index idx_users_role_status on users(role_code, status) where deleted_at is null;
create index idx_courses_status on courses(status) where deleted_at is null;
create index idx_chapters_course_order on chapters(course_id, order_index) where deleted_at is null;
create index idx_lessons_chapter_order on lessons(chapter_id, order_index) where deleted_at is null;
create index idx_resources_lesson_order on lesson_resources(lesson_id, order_index) where deleted_at is null;
create index idx_progress_student on learning_progress(student_id) where deleted_at is null;
create index idx_audit_target on audit_logs(target_type, target_id);
