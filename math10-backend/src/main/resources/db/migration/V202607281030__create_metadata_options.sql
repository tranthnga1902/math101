create table if not exists metadata_options (
    id bigserial primary key,
    category varchar(80) not null,
    value varchar(80) not null,
    label varchar(255) not null,
    sort_order integer not null default 0,
    active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uk_metadata_options_category_value unique (category, value)
);

insert into metadata_options (category, value, label, sort_order) values
('USER_STATUS', 'ACTIVE', 'Dang hoat dong', 10),
('USER_STATUS', 'LOCKED', 'Da khoa', 20),
('USER_STATUS', 'INACTIVE', 'Tam ngung', 30),
('USER_STATUS', 'ARCHIVED', 'Luu tru', 40),
('COURSE_STATUS', 'DRAFT', 'Nhap', 10),
('COURSE_STATUS', 'PUBLISHED', 'Da xuat ban', 20),
('COURSE_STATUS', 'HIDDEN', 'Da an', 30),
('COURSE_STATUS', 'ARCHIVED', 'Luu tru', 40),
('PUBLISH_STATUS', 'DRAFT', 'Nhap', 10),
('PUBLISH_STATUS', 'PUBLISHED', 'Da xuat ban', 20),
('PUBLISH_STATUS', 'HIDDEN', 'Da an', 30),
('PUBLISH_STATUS', 'ARCHIVED', 'Luu tru', 40),
('CLASS_STATUS', 'ACTIVE', 'Dang hoc', 10),
('CLASS_STATUS', 'LOCKED', 'Da khoa', 20),
('CLASS_STATUS', 'ARCHIVED', 'Luu tru', 30),
('RESOURCE_TYPE', 'VIDEO', 'Video', 10),
('RESOURCE_TYPE', 'PDF', 'PDF', 20),
('RESOURCE_TYPE', 'DOCUMENT', 'Tai lieu', 30),
('RESOURCE_TYPE', 'IMAGE', 'Hinh anh', 40),
('RESOURCE_TYPE', 'LINK', 'Lien ket', 50),
('RESOURCE_TYPE', 'TEXT', 'Noi dung text', 60),
('PROBLEM_DIFFICULTY', 'REINFORCEMENT', 'Cung co', 10),
('PROBLEM_DIFFICULTY', 'ADVANCED', 'Nang cao', 20),
('PROBLEM_DIFFICULTY', 'CHALLENGE', 'Thu thach', 30),
('PROBLEM_KIND', 'PRACTICE', 'Bai luyen tap', 10),
('PROBLEM_KIND', 'EXAM', 'Bai kiem tra', 20)
on conflict (category, value) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    active = true,
    updated_at = now();
