create table document_folders (
    id bigserial primary key,
    owner_id bigint not null references users(id),
    name varchar(120) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);
create index idx_document_folders_owner on document_folders(owner_id) where deleted_at is null;
create unique index uq_document_folder_owner_name on document_folders(owner_id, lower(name)) where deleted_at is null;
alter table documents add column if not exists folder_id bigint references document_folders(id);
create index idx_documents_folder on documents(folder_id) where deleted_at is null;
