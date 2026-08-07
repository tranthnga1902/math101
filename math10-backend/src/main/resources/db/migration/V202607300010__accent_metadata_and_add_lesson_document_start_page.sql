update metadata_options set label = 'Đang hoạt động', updated_at = now() where category = 'USER_STATUS' and value = 'ACTIVE';
update metadata_options set label = 'Đã khóa', updated_at = now() where category = 'USER_STATUS' and value = 'LOCKED';
update metadata_options set label = 'Tạm ngưng', updated_at = now() where category = 'USER_STATUS' and value = 'INACTIVE';
update metadata_options set label = 'Lưu trữ', updated_at = now() where category = 'USER_STATUS' and value = 'ARCHIVED';

update metadata_options set label = 'Nháp', updated_at = now() where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'DRAFT';
update metadata_options set label = 'Đã xuất bản', updated_at = now() where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'PUBLISHED';
update metadata_options set label = 'Đã ẩn', updated_at = now() where category in ('COURSE_STATUS', 'PUBLISH_STATUS') and value = 'HIDDEN';
update metadata_options set label = 'Lưu trữ', updated_at = now() where category in ('COURSE_STATUS', 'PUBLISH_STATUS', 'CLASS_STATUS') and value = 'ARCHIVED';

update metadata_options set label = 'Đang học', updated_at = now() where category = 'CLASS_STATUS' and value = 'ACTIVE';
update metadata_options set label = 'Đã khóa', updated_at = now() where category = 'CLASS_STATUS' and value = 'LOCKED';
update metadata_options set label = 'Tài liệu', updated_at = now() where category = 'RESOURCE_TYPE' and value = 'DOCUMENT';
update metadata_options set label = 'Hình ảnh', updated_at = now() where category = 'RESOURCE_TYPE' and value = 'IMAGE';
update metadata_options set label = 'Liên kết', updated_at = now() where category = 'RESOURCE_TYPE' and value = 'LINK';
update metadata_options set label = 'Nội dung text', updated_at = now() where category = 'RESOURCE_TYPE' and value = 'TEXT';
update metadata_options set label = 'Củng cố', updated_at = now() where category = 'PROBLEM_DIFFICULTY' and value = 'REINFORCEMENT';
update metadata_options set label = 'Nâng cao', updated_at = now() where category = 'PROBLEM_DIFFICULTY' and value = 'ADVANCED';
update metadata_options set label = 'Thử thách', updated_at = now() where category = 'PROBLEM_DIFFICULTY' and value = 'CHALLENGE';
update metadata_options set label = 'Bài luyện tập', updated_at = now() where category = 'PROBLEM_KIND' and value = 'PRACTICE';
update metadata_options set label = 'Bài kiểm tra', updated_at = now() where category = 'PROBLEM_KIND' and value = 'EXAM';

alter table lesson_documents
    add column if not exists start_page integer;
