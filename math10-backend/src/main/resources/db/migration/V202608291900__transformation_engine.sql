alter table question_variants add column if not exists options_json jsonb not null default '{}'::jsonb;
alter table question_variants add column if not exists rule_code varchar(50);
alter table question_variants add column if not exists validation_json jsonb not null default '{}'::jsonb;

create table question_transformations (
 id bigserial primary key,
 source_question_id bigint not null references extracted_questions(id),
 variant_id bigint references question_variants(id),
 rule_code varchar(50) not null,
 input_parameters jsonb not null default '{}'::jsonb,
 generated_parameters jsonb not null default '{}'::jsonb,
 validation_result jsonb not null default '{}'::jsonb,
 created_by bigint not null references users(id),
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp
);
create index idx_question_transform_audit on question_transformations(source_question_id,created_at desc)
where deleted_at is null;
