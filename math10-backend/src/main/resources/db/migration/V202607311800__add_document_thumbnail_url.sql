ALTER TABLE documents
    ADD COLUMN thumbnail_url VARCHAR(1024);

COMMENT ON COLUMN documents.thumbnail_url IS 'URL ảnh bìa (page 1) do backend render từ PDF để hiển thị list';