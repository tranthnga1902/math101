-- Batch B-C: kho nội dung chuẩn và thứ tự học thống nhất.
alter table documents add column if not exists description text;
alter table documents add column if not exists content_group varchar(30) not null default 'REFERENCE';
alter table documents add column if not exists program_id bigint references courses(id);
alter table documents add column if not exists lesson_id bigint references lessons(id);
alter table documents add column if not exists storage_key varchar(1024);

create table videos (
 id bigserial primary key, title varchar(255) not null, description text,
 video_url varchar(1024), storage_key varchar(1024), thumbnail_url varchar(1024), duration_seconds int,
 program_id bigint not null references courses(id), chapter_id bigint references chapters(id), lesson_id bigint references lessons(id),
 content_group varchar(30) not null default 'THEORY', status varchar(30) not null default 'DRAFT',
 created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp,
 constraint ck_videos_duration check(duration_seconds is null or duration_seconds >= 0)
);

create table special_topics (
 id bigserial primary key, title varchar(255) not null, description text,
 program_id bigint not null references courses(id), related_chapter_id bigint references chapters(id),
 status varchar(30) not null default 'DRAFT', created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp
);

create table program_resources (
 id bigserial primary key, lesson_id bigint not null references lessons(id), exercise_type_id bigint references exercise_types(id),
 resource_type varchar(30) not null, resource_ref_id bigint not null, title varchar(255) not null,
 order_index int not null, status varchar(30) not null default 'DRAFT',
 created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp,
 constraint ck_program_resources_type check(resource_type in ('VIDEO','DOCUMENT','EXERCISE','SPECIAL_TOPIC'))
);
create unique index uq_program_resources_order on program_resources(lesson_id,order_index) where deleted_at is null;
create unique index uq_program_resources_ref on program_resources(lesson_id,resource_type,resource_ref_id) where deleted_at is null;
create index idx_program_resources_lesson on program_resources(lesson_id,order_index) where deleted_at is null;

-- Batch D: mẫu tái sử dụng và lần triển khai theo năm học.
create table program_templates (
 id bigserial primary key, program_id bigint not null references courses(id), name varchar(255) not null,
 description text, status varchar(30) not null default 'DRAFT', created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp
);
create table program_template_chapters (
 id bigserial primary key, template_id bigint not null references program_templates(id), chapter_id bigint not null references chapters(id),
 order_index int not null, recommended_days int not null,
 created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp,
 constraint ck_template_chapter_days check(recommended_days > 0)
);
create unique index uq_template_chapter_order on program_template_chapters(template_id,order_index) where deleted_at is null;
create unique index uq_template_chapter_ref on program_template_chapters(template_id,chapter_id) where deleted_at is null;

create table course_instances (
 id bigserial primary key, template_id bigint not null references program_templates(id), name varchar(255) not null,
 school_year varchar(20) not null, starts_on date not null, ends_on date not null, status varchar(30) not null default 'DRAFT',
 created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp,
 constraint ck_course_instance_dates check(starts_on <= ends_on)
);

-- Batch H: tài nguyên cá nhân không bao giờ trở thành ProgramResource.
create table teacher_resources (
 id bigserial primary key, owner_teacher_id bigint not null references users(id), lesson_id bigint references lessons(id),
 exercise_type_id bigint references exercise_types(id), resource_type varchar(30) not null, title varchar(255) not null,
 description text, storage_key varchar(1024), external_url varchar(1024), moderation_status varchar(30) not null default 'PENDING',
 status varchar(30) not null default 'ACTIVE', created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp
);
create index idx_teacher_resources_owner on teacher_resources(owner_teacher_id,created_at desc) where deleted_at is null;

create table resource_shares (
 id bigserial primary key, teacher_resource_id bigint not null references teacher_resources(id), class_id bigint not null references classes(id),
 shared_by bigint not null references users(id), available_from timestamp, available_until timestamp, status varchar(30) not null default 'ACTIVE',
 created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp,
 constraint ck_resource_share_window check(available_from is null or available_until is null or available_from <= available_until)
);
create unique index uq_resource_share_pair on resource_shares(teacher_resource_id,class_id) where deleted_at is null;

-- Batch I: version worksheet và submission nhiều lượt, không ghi đè progress.
alter table worksheets add column if not exists status varchar(30) not null default 'DRAFT';
alter table worksheets add column if not exists version int not null default 1;
alter table worksheets add column if not exists parent_worksheet_id bigint references worksheets(id);
alter table worksheets add column if not exists exercise_type_id bigint references exercise_types(id);
alter table worksheets add constraint ck_worksheet_version check(version > 0);

create table submissions (
 id bigserial primary key, assignment_id bigint not null references assignments(id), student_id bigint not null references users(id),
 attempt_no int not null, status varchar(30) not null default 'IN_PROGRESS', submitted_at timestamp,
 raw_score numeric(7,2), final_score numeric(7,2), created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp,
 constraint ck_submission_attempt check(attempt_no > 0)
);
create unique index uq_submission_attempt on submissions(assignment_id,student_id,attempt_no) where deleted_at is null;

create table submission_answers (
 id bigserial primary key, submission_id bigint not null references submissions(id), worksheet_item_id bigint not null references worksheet_items(id),
 answer_json jsonb, score numeric(7,2), teacher_feedback text, created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp
);
create unique index uq_submission_answer on submission_answers(submission_id,worksheet_item_id) where deleted_at is null;

create table submission_events (
 id bigserial primary key, submission_id bigint not null references submissions(id), actor_id bigint references users(id),
 action varchar(30) not null, metadata jsonb, created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp
);

-- Batch G: tracking tách theo đối tượng; không bảng nào được tham gia truy vấn schedule.
create table student_resource_progress (
 id bigserial primary key, student_id bigint not null references users(id), program_resource_id bigint not null references program_resources(id),
 status varchar(30) not null default 'NOT_STARTED', last_opened_at timestamp, completed_at timestamp,
 created_at timestamp not null, updated_at timestamp not null, deleted_at timestamp
);
create unique index uq_student_resource_progress on student_resource_progress(student_id,program_resource_id) where deleted_at is null;
