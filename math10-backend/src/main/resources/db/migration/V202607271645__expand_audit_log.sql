alter table audit_logs add column ip_address varchar(64);
alter table audit_logs add column old_data text;
alter table audit_logs add column new_data text;
create index idx_audit_actor_created on audit_logs(actor_user_id, created_at desc);
