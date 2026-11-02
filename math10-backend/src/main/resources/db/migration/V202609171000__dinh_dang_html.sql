-- Thêm định dạng HTML: trang web một file (.html) hoặc gói .zip có index.html kèm ảnh/CSS/JS.
-- Chỉ nới ràng buộc, không đổi cột.
alter table documents drop constraint if exists documents_file_format_check;
alter table documents add constraint documents_file_format_check
    check (file_format is null or file_format in ('WORD','EXCEL','POWERPOINT','PDF','VIDEO','SCORM','XAPI','HTML'));

update documents set file_format = 'HTML'
where file_format is null and lower(file_url) ~ '\.html?$';
