-- ============================================================
-- V202608040500__create_textbook_mapping_progress.sql
-- Lưu tiến độ khớp trang SGK/SBT theo user + sách
-- + Lịch sử thao tác Lên/Xuống (ring buffer 100 entry)
-- Mục đích: resume sau reload/đổi máy/đổi tab, audit, đa admin
-- ============================================================

-- 1. Bảng tiến độ khớp trang hiện tại (UPSERT theo user + sách)
create table if not exists textbook_mapping_progress (
    id bigserial primary key,
    user_id bigint not null references users(id),
    document_id bigint not null references documents(id),
    pdf_page int not null,
    pdf_anchor int not null,
    book_anchor int not null,
    zoom int not null default 100,
    thumb_page int not null default 1,
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    deleted_at timestamp,
    constraint uq_textbook_mapping_progress_user_doc unique (user_id, document_id)
);

create index if not exists idx_textbook_mapping_progress_doc
    on textbook_mapping_progress(document_id) where deleted_at is null;

-- 2. Bảng lịch sử Lên/Xuống (ring buffer 100 entry gần nhất)
create table if not exists textbook_mapping_history (
    id bigserial primary key,
    user_id bigint not null references users(id),
    document_id bigint not null references documents(id),
    pdf_page int not null,
    pdf_anchor int not null,
    book_anchor int not null,
    action varchar(20) not null, -- GOTO | PREV | NEXT
    created_at timestamp not null default now(),
    constraint ck_textbook_mapping_history_action
        check (action in ('GOTO','PREV','NEXT'))
);

-- Index phục vụ tra cứu "vị trí stack" nhanh theo user + sách + thời gian
create index if not exists idx_textbook_mapping_history_user_doc_time
    on textbook_mapping_history(user_id, document_id, created_at desc);
