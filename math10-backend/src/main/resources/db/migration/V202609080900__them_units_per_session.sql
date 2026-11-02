-- =============================================================================
-- V202609080900: Tách units_per_session khỏi tiet_moi_tuan
--
-- tiet_moi_tuan (course_instances): nhịp dạy theo tuần — số tiết mỗi tuần
--   AdminchonH để tính số tuần cần và ngày học xong. Dùng bởi CourseWeekController.
--
-- units_per_session (mới): số tiết (program_period) gộp vào MỘT buổi học
--   (course_delivery_session). Đây là thông tin của Course layer (cách chia
--   nội dung thành buổi), dùng bởi CourseDeliverySessionGenerator.
--
-- Hai khái niệm này KHÁC NHAU về mặt ngữ nghĩa:
--   - tiet_moi_tuan: 3 tiết/tuần → bao nhiêu tuần dạy xong chương trình
--   - units_per_session: 3 tiết/buổi → mỗi buổi dạy 3 nội dung
--
-- Nguyên tắc additive: chỉ ADD COLUMN, không DROP, không thay đổi ràng buộc.
-- =============================================================================

-- Thêm cột units_per_session vào course_instances.
-- NULL = chưa cấu hình; hệ thống sẽ fallback về tiet_moi_tuan (tương thích ngược)
-- rồi cuối cùng fallback về 1 (mỗi tiết là một buổi riêng).
alter table course_instances
    add column if not exists units_per_session int;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'ck_ci_units_per_session') then
        alter table course_instances
            add constraint ck_ci_units_per_session
            check (units_per_session is null or (units_per_session >= 1 and units_per_session <= 20));
    end if;
end $$;

comment on column course_instances.units_per_session is
    'Số tiết (program_period) gộp vào một buổi học (course_delivery_session). '
    'NULL = dùng tiet_moi_tuan nếu có, nếu cũng NULL thì mặc định 1. '
    'Khác với tiet_moi_tuan (nhịp dạy tiết/tuần — dùng để tính lịch tuần).';
