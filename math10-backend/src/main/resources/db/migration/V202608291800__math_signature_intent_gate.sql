alter table extracted_questions add column if not exists math_signature varchar(40) not null default 'UNSUPPORTED';
alter table extracted_questions add column if not exists signature_confidence numeric(5,4) not null default 0;
alter table extracted_questions add column if not exists question_intent varchar(40) not null default 'UNKNOWN';
alter table extracted_questions add column if not exists intent_confidence numeric(5,4) not null default 0;
alter table extracted_questions add column if not exists math_parse_valid boolean not null default false;
alter table extracted_questions add column if not exists structure_valid boolean not null default false;
alter table extracted_questions add column if not exists transformable boolean not null default false;
alter table extracted_questions add column if not exists transform_block_reason varchar(255);
alter table extracted_questions add column if not exists analysis_version varchar(30) not null default 'SIGNATURE_INTENT_V1';

create index idx_extracted_transformable on extracted_questions(source_document_id,transformable)
where deleted_at is null;
