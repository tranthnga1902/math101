-- ============================================================
-- V202607310000__add_textbook_fields_and_page_mapping.sql
-- Mở rộng bảng documents cho Danh mục Sách giáo khoa (SGK/SBT)
-- + Bảng document_page_mappings cho khớp trang chi tiết
-- ============================================================

-- 1. Thêm các column mới cho bảng documents
alter table documents add column if not exists status varchar(30) not null default 'DRAFT';
alter table documents add column if not exists subject_id bigint references subjects(id);
alter table documents add column if not exists total_pages int;
alter table documents add column if not exists base_page_offset int not null default 1;

-- 2. Index cho truy vấn nhanh theo status + doc_type
create index if not exists idx_documents_status_type
    on documents(status, doc_type) where deleted_at is null;

-- 3. Bảng document_page_mappings
-- Dùng khi cần khớp trang không đều (bìa La Mã, phụ lục, trang lệch)
create table if not exists document_page_mappings (
    id bigserial primary key,
    document_id bigint not null references documents(id),
    pdf_page_number int not null,
    book_page_label varchar(30),
    page_type varchar(30) default 'CONTENT',  -- COVER, TABLE_OF_CONTENTS, CONTENT, APPENDIX, BLANK
    chapter_title varchar(255),
    lesson_title varchar(255),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    deleted_at timestamp,
    constraint uq_document_pdf_page unique (document_id, pdf_page_number)
);

create index if not exists idx_document_page_mappings_document
    on document_page_mappings(document_id) where deleted_at is null;
