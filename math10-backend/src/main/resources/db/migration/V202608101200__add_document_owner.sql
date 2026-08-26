alter table documents
    add column if not exists owner_id bigint references users(id);

create index if not exists idx_documents_owner_created
    on documents(owner_id, created_at desc)
    where deleted_at is null;
