create table class_days_off (
    id bigserial primary key,
    class_id bigint not null references classes(id),
    starts_on date not null,
    ends_on date not null,
    reason varchar(500),
    created_at timestamp not null default now(),
    constraint ck_class_days_off_range check (ends_on >= starts_on)
);
create index idx_class_days_off_class on class_days_off(class_id, starts_on);
