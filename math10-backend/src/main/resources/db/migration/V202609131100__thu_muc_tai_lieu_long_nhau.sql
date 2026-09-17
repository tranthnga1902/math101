-- Thư mục tài liệu lồng nhau (cha/con) và thư mục dùng chung của kho quản trị.
--
-- owner_id null  = thư mục của thư viện dùng chung (admin quản lý), cùng quy ước với documents.owner_id.
-- parent_id null = thư mục gốc.
-- Không xóa cột nào; chỉ nới NOT NULL và thay chỉ mục duy nhất để hai thư mục con khác cha được trùng tên.

alter table document_folders alter column owner_id drop not null;
alter table document_folders add column if not exists parent_id bigint references document_folders(id);

drop index if exists uq_document_folder_owner_name;
create unique index uq_document_folder_owner_parent_name
    on document_folders (coalesce(owner_id, 0), coalesce(parent_id, 0), lower(name))
    where deleted_at is null;

create index if not exists idx_document_folders_parent on document_folders(parent_id) where deleted_at is null;
create index if not exists idx_document_folders_shared on document_folders(id) where owner_id is null and deleted_at is null;
