-- Định dạng file của tài liệu — trả lời "file này mở bằng gì", tách khỏi doc_type ("ấn phẩm gì").
-- Phải lưu thành cột chứ không suy từ đuôi file: SCORM và xAPI đều là .zip, chỉ phân biệt được
-- bằng cách nhìn vào bên trong gói lúc tải lên.
alter table documents add column if not exists file_format varchar(20);

alter table documents drop constraint if exists documents_file_format_check;
alter table documents add constraint documents_file_format_check
    check (file_format is null or file_format in ('WORD','EXCEL','POWERPOINT','PDF','VIDEO','SCORM','XAPI'));

-- Điền cho dữ liệu cũ theo đuôi file. Dòng không đoán được giữ null ("Khác"), không gán bừa.
update documents set file_format = case
    when doc_type = 'VIDEO' then 'VIDEO'
    when lower(file_url) ~ '\.pdf$' then 'PDF'
    when lower(file_url) ~ '\.docx?$' then 'WORD'
    when lower(file_url) ~ '\.xlsx?$' then 'EXCEL'
    when lower(file_url) ~ '\.pptx?$' then 'POWERPOINT'
    when lower(file_url) ~ '\.(mp4|webm|mov|m4v)$' then 'VIDEO'
end
where file_format is null;

create index if not exists idx_documents_file_format on documents(file_format);
