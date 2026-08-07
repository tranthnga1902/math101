alter table lessons add column content_html text;
update lessons set content_html = coalesce(summary, '') where content_html is null;

alter table worksheets add column lesson_id bigint references lessons(id);
create index idx_worksheets_lesson on worksheets(lesson_id) where deleted_at is null;
