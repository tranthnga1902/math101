-- Module Lớp học: người tạo lớp, chương trình học của lớp, tài liệu gắn vào lớp,
-- phân loại bắt buộc/tự chọn cho nhiệm vụ, và nhật ký nộp bài.

alter table classes add column if not exists created_by bigint references users(id);
alter table classes add column if not exists description varchar(500);
create index if not exists idx_classes_created_by on classes(created_by) where deleted_at is null;

-- Chương trình học của lớp: tham chiếu tới cây chuyên đề (taxonomy_nodes), không copy nội dung.
create table class_curriculum (
    id bigserial primary key,
    class_id bigint not null references classes(id),
    taxonomy_node_id bigint not null references taxonomy_node(id),
    order_no int not null default 0,
    note varchar(500),
    created_by bigint references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);
create index idx_class_curriculum_class on class_curriculum(class_id) where deleted_at is null;
create unique index uq_class_curriculum_node on class_curriculum(class_id, taxonomy_node_id) where deleted_at is null;

-- Tài liệu của lớp: CHỈ lưu tham chiếu tới documents(id).
-- Nguồn (kho chung cấp trường hay tài liệu riêng của GV) suy ra từ documents.owner_id,
-- không lưu lại ở đây để tránh lệch dữ liệu khi tài liệu gốc đổi chủ.
-- Nhãn bắt buộc/tự chọn gắn ở cấp lớp nên nằm trên bảng này, không nằm trên tài liệu gốc.
create table class_documents (
    id bigserial primary key,
    class_id bigint not null references classes(id),
    document_id bigint not null references documents(id),
    requirement varchar(20) not null default 'TU_CHON',
    note varchar(500),
    attached_by bigint references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint ck_class_documents_requirement check (requirement in ('BAT_BUOC','TU_CHON'))
);
create index idx_class_documents_class on class_documents(class_id) where deleted_at is null;
create index idx_class_documents_document on class_documents(document_id) where deleted_at is null;
create unique index uq_class_documents_pair on class_documents(class_id, document_id) where deleted_at is null;

-- Nhiệm vụ: phân loại bắt buộc/tự chọn và cho phép giao thẳng một tài liệu (đề thi PDF).
alter table assignments add column if not exists requirement varchar(20) not null default 'BAT_BUOC';
alter table assignments add constraint ck_assignments_requirement check (requirement in ('BAT_BUOC','TU_CHON'));
alter table assignments add column if not exists document_id bigint references documents(id);
create index if not exists idx_assignments_document on assignments(document_id) where deleted_at is null;

-- Nhật ký nộp bài: mỗi lần học sinh nộp / giáo viên chấm / trả bài đều ghi một dòng.
create table assignment_submission_log (
    id bigserial primary key,
    assignment_id bigint not null references assignments(id),
    class_id bigint not null references classes(id),
    student_id bigint not null references users(id),
    actor_id bigint references users(id),
    action varchar(20) not null,
    requirement varchar(20) not null default 'BAT_BUOC',
    score numeric(5,2),
    note varchar(500),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint ck_submission_log_action check (action in ('SUBMITTED','GRADED','RETURNED')),
    constraint ck_submission_log_requirement check (requirement in ('BAT_BUOC','TU_CHON'))
);
create index idx_submission_log_class on assignment_submission_log(class_id, created_at desc) where deleted_at is null;
create index idx_submission_log_assignment on assignment_submission_log(assignment_id) where deleted_at is null;
create index idx_submission_log_student on assignment_submission_log(student_id) where deleted_at is null;
