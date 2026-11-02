-- I1: Namespace for periods/lessons + chapter inference tracking
-- Breaks uq_program_period_no and recreates it with namespace included.

alter table program_periods
    add column if not exists namespace varchar(30) not null default 'MAIN';

alter table lessons
    add column if not exists namespace varchar(30) not null default 'MAIN';

alter table lessons
    add column if not exists chapter_inferred_by varchar(10) not null default 'DATA';

alter table lessons
    add constraint ck_lessons_chapter_inferred
        check (chapter_inferred_by in ('DATA', 'INHERITED', 'MISSING'));

-- Rebuild unique index to include namespace
drop index if exists uq_program_period_no;
create unique index uq_program_period_no
    on program_periods(strand_id, term, period_no, namespace)
    where deleted_at is null;

create index if not exists idx_periods_namespace on program_periods(namespace)
    where deleted_at is null;
create index if not exists idx_lessons_namespace on lessons(namespace)
    where deleted_at is null;

comment on column program_periods.namespace is 'MAIN = chính khóa, CĐ = chuyên đề, tên khác = module tùy chỉnh';
comment on column lessons.chapter_inferred_by is 'DATA = ghi rõ trong file, INHERITED = kế thừa bài liền trước, MISSING = không có tiền tố chương';
