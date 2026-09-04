-- PPCT is the single, immutable curriculum reference. Class delivery dates live elsewhere.
alter table courses add column if not exists subject varchar(120);
alter table courses add column if not exists grade_number int;
alter table courses add column if not exists total_periods int;
alter table courses add column if not exists total_weeks int;
alter table courses add column if not exists version int not null default 1;

alter table program_strands add column if not exists total_periods int not null default 0;

alter table chapters add column if not exists strand_id bigint references program_strands(id);
alter table chapters add column if not exists numeral varchar(30);

alter table lessons alter column chapter_id drop not null;
alter table lessons add column if not exists course_id bigint references courses(id);
alter table lessons add column if not exists name_normalized varchar(255);
alter table lessons add column if not exists lesson_kind varchar(20) not null default 'LESSON';
alter table lessons add column if not exists total_periods int not null default 0;
alter table lessons add constraint ck_lessons_kind
    check (lesson_kind in ('LESSON','REVIEW','EXAM','PRACTICE'));

update lessons l set course_id=c.course_id from chapters c
where l.chapter_id=c.id and l.course_id is null;
update lessons set name_normalized=lower(regexp_replace(trim(title), '\s+', ' ', 'g'))
where name_normalized is null;

create index if not exists idx_chapters_strand on chapters(strand_id, order_index)
    where deleted_at is null;
create index if not exists idx_lessons_course_normalized on lessons(course_id, name_normalized)
    where deleted_at is null;
create index if not exists idx_periods_lesson_strand on program_periods(lesson_id, strand_id)
    where deleted_at is null;

-- The curriculum numbers periods independently in every strand and semester.
drop index if exists uq_program_period_no;
create unique index uq_program_period_no on program_periods(strand_id, term, period_no)
    where deleted_at is null;
