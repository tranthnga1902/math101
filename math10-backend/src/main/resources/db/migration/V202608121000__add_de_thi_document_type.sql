insert into metadata_options (category, value, label, sort_order) values
('DOCUMENT_TYPE', 'DE_THI', 'Đề thi', 35)
on conflict (category, value) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    updated_at = now();
