alter table learning_progress add column worksheet_id bigint references worksheets(id);
alter table learning_progress add column status varchar(30);

update learning_progress
set status = case
    when completed_at is not null then 'COMPLETED'
    when opened_at is not null then 'IN_PROGRESS'
    else 'NOT_STARTED'
end;

alter table learning_progress alter column status set not null;
alter table learning_progress alter column status set default 'NOT_STARTED';
alter table learning_progress alter column lesson_id drop not null;
alter table learning_progress drop constraint uq_learning_progress;
alter table learning_progress add constraint ck_learning_progress_target
    check ((lesson_id is not null and worksheet_id is null)
        or (lesson_id is null and worksheet_id is not null));
alter table learning_progress add constraint ck_learning_progress_status
    check (status in ('NOT_STARTED','IN_PROGRESS','COMPLETED'));

create unique index uq_learning_progress_lesson
    on learning_progress(student_id,lesson_id)
    where lesson_id is not null;
create unique index uq_learning_progress_worksheet
    on learning_progress(student_id,worksheet_id)
    where worksheet_id is not null;
