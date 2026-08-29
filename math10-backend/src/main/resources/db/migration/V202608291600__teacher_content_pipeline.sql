create table teacher_source_documents (
 id bigserial primary key, owner_teacher_id bigint not null references users(id), title varchar(255) not null,
 file_type varchar(12) not null check(file_type in ('PDF','DOCX','TEX','TXT')), storage_key text not null,
 original_filename varchar(255) not null, status varchar(20) not null default 'UPLOADED', failure_reason text,
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp
);
create index idx_teacher_source_owner on teacher_source_documents(owner_teacher_id,created_at desc) where deleted_at is null;
create table document_blocks (
 id bigserial primary key, source_document_id bigint not null references teacher_source_documents(id), block_type varchar(20) not null,
 raw_content text not null, normalized_content text, order_index integer not null, page_number integer,
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp,
 unique(source_document_id,order_index)
);
create table extracted_questions (
 id bigserial primary key, source_document_id bigint not null references teacher_source_documents(id),
 start_block_id bigint references document_blocks(id), end_block_id bigint references document_blocks(id),
 question_text text not null, option_a text, option_b text, option_c text, option_d text, answer_text text, solution_text text,
 confidence numeric(4,3) not null default 0, status varchar(20) not null default 'DETECTED',
 transform_level varchar(10) not null default 'LEVEL_0', curriculum_chapter_id bigint references chapters(id),
 curriculum_lesson_id bigint references lessons(id), exercise_type_id bigint references exercise_types(id), curriculum_confirmed boolean not null default false,
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp
);
create index idx_extracted_source on extracted_questions(source_document_id,id) where deleted_at is null;
create table math_fragments (
 id bigserial primary key, question_id bigint not null references extracted_questions(id), raw_value text not null,
 latex_value text not null, ast_json jsonb, order_index integer not null, status varchar(20) not null default 'DETECTED',
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp,
 unique(question_id,order_index)
);
create table question_variants (
 id bigserial primary key, source_question_id bigint not null references extracted_questions(id), transformation_type varchar(30) not null,
 content text not null, answer text, solution text, parameters_json jsonb not null default '{}'::jsonb,
 validation_status varchar(20) not null, teacher_accepted boolean not null default false,
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp
);
create table worksheet_versions (
 id bigserial primary key, worksheet_id bigint not null references worksheets(id), version integer not null,
 status varchar(20) not null default 'DRAFT', published_at timestamp, created_by bigint not null references users(id),
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp,
 unique(worksheet_id,version)
);
alter table worksheet_items add column if not exists worksheet_version_id bigint references worksheet_versions(id);
alter table worksheet_items add column if not exists source_question_id bigint references extracted_questions(id);
alter table worksheet_items add column if not exists question_variant_id bigint references question_variants(id);
alter table worksheet_items add column if not exists content_snapshot text;
alter table worksheet_items add column if not exists option_a_snapshot text;
alter table worksheet_items add column if not exists option_b_snapshot text;
alter table worksheet_items add column if not exists option_c_snapshot text;
alter table worksheet_items add column if not exists option_d_snapshot text;
alter table worksheet_items add column if not exists answer_snapshot text;
alter table worksheet_items add column if not exists solution_snapshot text;
alter table worksheet_items alter column problem_id drop not null;

create or replace function snapshot_pipeline_question_options() returns trigger language plpgsql as $$
begin
  if new.source_question_id is not null then
    select option_a,option_b,option_c,option_d
      into new.option_a_snapshot,new.option_b_snapshot,new.option_c_snapshot,new.option_d_snapshot
      from extracted_questions where id=new.source_question_id;
  end if;
  return new;
end $$;
drop trigger if exists trg_snapshot_pipeline_question_options on worksheet_items;
create trigger trg_snapshot_pipeline_question_options before insert on worksheet_items
for each row execute function snapshot_pipeline_question_options();
create table document_templates (
 id bigserial primary key, owner_teacher_id bigint references users(id), name varchar(150) not null, template_type varchar(30) not null,
 header_json jsonb not null default '{}'::jsonb, layout_json jsonb not null default '{}'::jsonb, status varchar(20) not null default 'ACTIVE',
 created_at timestamp not null default now(), updated_at timestamp not null default now(), deleted_at timestamp
);
alter table assignments add column if not exists worksheet_version_id bigint references worksheet_versions(id);
insert into document_templates(name,template_type,header_json,layout_json,status) values
 ('Phiếu bài tập','WORKSHEET','{}','{"columns":1}','ACTIVE'),
 ('Kiểm tra 15 phút','QUIZ_15','{}','{"columns":1,"duration":15}','ACTIVE'),
 ('Kiểm tra 45 phút','TEST_45','{}','{"columns":1,"duration":45}','ACTIVE'),
 ('Bài tập về nhà','HOMEWORK','{}','{"columns":1}','ACTIVE');

insert into worksheet_versions(worksheet_id,version,status,published_at,created_by,created_at,updated_at)
select w.id,coalesce(w.version,1),case when w.status='PUBLISHED' then 'PUBLISHED' else 'DRAFT' end,
       case when w.status='PUBLISHED' then w.updated_at else null end,w.created_by,w.created_at,w.updated_at
from worksheets w where w.deleted_at is null
on conflict(worksheet_id,version) do nothing;
update worksheet_items wi set worksheet_version_id=(select wv.id from worksheet_versions wv where wv.worksheet_id=wi.worksheet_id order by wv.version limit 1)
where wi.worksheet_version_id is null;
