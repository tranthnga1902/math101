alter table problems add column problem_kind varchar(20);
alter table problems add column content_html text;
alter table problems add column easier_problem_id bigint references problems(id);
alter table problems add column equivalent_problem_id bigint references problems(id);
alter table problems add column harder_problem_id bigint references problems(id);

update problems
set problem_kind = 'PRACTICE',
    content_html = statement_latex
where problem_kind is null;

alter table problems alter column problem_kind set not null;
alter table problems alter column problem_kind set default 'PRACTICE';
alter table problems alter column qr_slug drop not null;

alter table problems add constraint ck_problems_kind
    check (problem_kind in ('PRACTICE', 'EXAM'));
alter table problems add constraint ck_problems_qr_by_kind
    check ((problem_kind = 'PRACTICE' and qr_slug is not null)
        or (problem_kind = 'EXAM' and qr_slug is null));
alter table problems add constraint ck_problems_similar_distinct
    check (
        (easier_problem_id is null or easier_problem_id <> id)
        and (equivalent_problem_id is null or equivalent_problem_id <> id)
        and (harder_problem_id is null or harder_problem_id <> id)
    );

create index idx_problems_kind on problems(problem_kind) where deleted_at is null;
