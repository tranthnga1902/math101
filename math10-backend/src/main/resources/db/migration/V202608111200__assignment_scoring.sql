alter table problems add column if not exists option_a text;
alter table problems add column if not exists option_b text;
alter table problems add column if not exists option_c text;
alter table problems add column if not exists option_d text;
alter table problems add column if not exists correct_option varchar(1);
alter table problems add constraint ck_problems_correct_option check (correct_option is null or correct_option in ('A','B','C','D'));

alter table assignment_progress add column if not exists answer_json text;
alter table assignment_progress add column if not exists submitted_at timestamp;
alter table assignment_progress add column if not exists graded_at timestamp;
alter table assignment_progress add column if not exists returned_at timestamp;
alter table assignment_progress add column if not exists score numeric(5,2);
alter table assignment_progress add column if not exists max_score numeric(5,2) not null default 10;
alter table assignment_progress add column if not exists correct_count int;
alter table assignment_progress add column if not exists total_questions int;
alter table assignment_progress add column if not exists teacher_feedback text;
alter table assignment_progress add column if not exists grading_status varchar(20) not null default 'NOT_SUBMITTED';
alter table assignment_progress add constraint ck_assignment_grading_status check (grading_status in ('NOT_SUBMITTED','SUBMITTED','GRADED','RETURNED'));
