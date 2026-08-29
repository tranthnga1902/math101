alter table teacher_source_documents add column if not exists page_count integer not null default 0;
alter table teacher_source_documents add column if not exists text_coverage numeric(5,4) not null default 0;
alter table teacher_source_documents add column if not exists question_confidence numeric(5,4) not null default 0;
alter table teacher_source_documents add column if not exists math_confidence numeric(5,4) not null default 0;
alter table teacher_source_documents add column if not exists warning_count integer not null default 0;
alter table teacher_source_documents add column if not exists quality_label varchar(20) not null default 'PENDING';
alter table teacher_source_documents add column if not exists pipeline_stage varchar(30) not null default 'UPLOADED';
alter table teacher_source_documents add column if not exists parser_type varchar(30);
alter table teacher_source_documents add column if not exists block_count integer not null default 0;
alter table teacher_source_documents add column if not exists math_question_count integer not null default 0;
alter table teacher_source_documents add column if not exists answered_question_count integer not null default 0;

alter table extracted_questions add column if not exists question_type varchar(30) not null default 'UNKNOWN';
alter table extracted_questions add column if not exists options_json jsonb not null default '{}'::jsonb;
alter table extracted_questions add column if not exists source_start integer;
alter table extracted_questions add column if not exists source_end integer;

alter table math_fragments add column if not exists confidence numeric(5,4) not null default 0;
alter table math_fragments add column if not exists review_decision varchar(20) not null default 'PENDING';
alter table math_fragments add column if not exists reviewed_by bigint references users(id);
alter table math_fragments add column if not exists reviewed_at timestamp;

create table question_boundary_events (
 id bigserial primary key,
 source_document_id bigint not null references teacher_source_documents(id),
 question_id bigint references extracted_questions(id),
 action varchar(30) not null,
 before_json jsonb not null default '{}'::jsonb,
 after_json jsonb not null default '{}'::jsonb,
 created_by bigint not null references users(id),
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp
);
