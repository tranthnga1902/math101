-- Nhịp dạy: số tiết mỗi tuần admin chọn cho một khóa, để tự tính tuần cần và ngày học xong.
-- NULL = theo SGK (max week_no của chương trình) — không nén cũng không giãn lịch.
alter table course_instances add column if not exists tiet_moi_tuan int;
alter table course_instances add constraint ck_course_instance_nhip
    check (tiet_moi_tuan is null or tiet_moi_tuan between 1 and 20);
