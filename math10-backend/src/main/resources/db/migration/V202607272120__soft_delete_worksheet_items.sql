alter table worksheet_items drop constraint uq_worksheet_items_order;
alter table worksheet_items drop constraint uq_worksheet_problem;

create unique index uq_worksheet_items_order_active
    on worksheet_items(worksheet_id,order_index)
    where deleted_at is null;
create unique index uq_worksheet_problem_active
    on worksheet_items(worksheet_id,problem_id)
    where deleted_at is null;
