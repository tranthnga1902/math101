-- Nội dung học do Admin biên soạn: bỏ hẳn luồng "giáo viên đề xuất".
-- Sau thay đổi này không còn nơi nào tạo ra trạng thái PENDING nữa, nên các đề xuất
-- còn treo (nếu có) được đưa về ARCHIVED: dữ liệu vẫn còn nguyên, không tự động phát
-- hành nội dung chưa duyệt cho học sinh, và Admin có thể bấm "Khôi phục" nếu muốn giữ.
update taxonomy_node set status = 'ARCHIVED' where status = 'PENDING';

-- Ràng buộc unique (parent_id, slug) không bảo vệ được các Chuyên đề gốc: Postgres coi
-- mỗi NULL là một giá trị khác nhau nên hai mục gốc vẫn có thể trùng slug. Chỉ có tầng
-- Java đang chặn. Thêm index riêng cho nhánh gốc để cơ sở dữ liệu cũng chặn.
create unique index if not exists ux_taxonomy_root_slug
    on taxonomy_node (subject, slug)
    where parent_id is null and deleted_at is null;
