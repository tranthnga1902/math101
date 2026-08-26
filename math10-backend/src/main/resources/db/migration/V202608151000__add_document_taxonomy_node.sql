-- Gắn tài liệu vào một mục trong cây phân loại (Chuyên đề / Bài / Dạng).
-- Cột nullable: tài liệu cũ trong Kho Tài Liệu vẫn hợp lệ, chỉ là chưa gắn vào mục nào.
ALTER TABLE documents ADD COLUMN taxonomy_node_id BIGINT NULL REFERENCES taxonomy_node(id);
CREATE INDEX idx_documents_taxonomy_node ON documents(taxonomy_node_id) WHERE deleted_at IS NULL;
