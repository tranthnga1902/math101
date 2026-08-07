alter table users add column username varchar(80);
create unique index uq_users_username_active
    on users(lower(username))
    where deleted_at is null and username is not null;
