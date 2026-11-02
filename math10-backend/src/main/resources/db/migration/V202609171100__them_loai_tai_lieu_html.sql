-- Thêm loại tài liệu HTML và nội dung bài học HTML vào danh mục tài liệu.
insert into metadata_options (category, value, label, sort_order) values
('DOCUMENT_TYPE', 'HTML', 'Tài liệu HTML', 50),
('DOCUMENT_TYPE', 'HTML_LESSON_CONTENT', 'Bài học HTML', 55)
on conflict (category, value) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    active = true,
    updated_at = now();
