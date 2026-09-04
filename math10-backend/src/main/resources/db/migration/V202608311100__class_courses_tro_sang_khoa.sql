-- Lớp gắn vào KHÓA, không gắn thẳng vào chương trình.
--
-- Quyết định đã chốt: một khóa nhiều lớp. Khóa là lần triển khai chương trình trong một năm học —
-- lịch dạy nằm ở đó. Lớp là nhóm học sinh và giáo viên. Admin xếp lịch một lần cho khóa, mọi lớp
-- dùng chung; lớp nào chạy lệch thì ghi ở bảng tiến độ riêng của lớp, không đẻ ra lịch thứ hai.
--
-- Hôm nay class_courses trỏ thẳng courses, nghĩa là lớp gắn vào chương trình chứ không vào năm
-- học nào cả. Hệ quả là không có chỗ nào trả lời được "lớp 10A năm nay học theo lịch nào" — hai
-- lớp của hai năm học khác nhau nhìn giống hệt nhau trong CSDL.

alter table class_courses add column course_instance_id bigint references course_instances(id);

-- Chuyển dữ liệu cũ. Mỗi chương trình đang được lớp nào đó dùng phải có một khóa để trỏ tới.
--
-- Chỗ này phải sinh dữ liệu, và dữ liệu sinh ra thì luôn có nguy cơ trông y như dữ liệu ai đó đã
-- cân nhắc rồi đặt vào. Nên: khóa sinh tự động để trạng thái DRAFT và mang tên nói thẳng rằng nó
-- chưa xong, để nó nổi lên trong màn hình khóa của Admin thay vì nằm im giả làm khóa thật. Ngày
-- tháng lấy từ lịch chương trình đang có nếu có — đó là ngày người thật đã nhập; chỉ khi không có
-- lịch nào mới rơi về mốc năm học (1/8 → 31/5), và đó cũng là mốc hệ thống vẫn dùng.
--
-- Vòng lặp chạy trên cả dòng đã xoá mềm: dòng lịch sử cũng phải có khóa, nếu không câu
-- "set not null" bên dưới sẽ đỏ. Không nới cột thành nullable để né — cột nullable ở đây nghĩa là
-- "lớp có thể không thuộc khóa nào", và đó lại là đúng cái mô hình vừa bỏ.
do $$
declare
    r record;
    mau_id bigint;
    khoa_id bigint;
    tu date;
    den date;
    nam int;
begin
    for r in select distinct course_id from class_courses loop
        select ci.id into khoa_id
        from course_instances ci
        join program_templates pt on pt.id = ci.template_id and pt.deleted_at is null
        where pt.program_id = r.course_id and ci.deleted_at is null
        order by ci.starts_on desc, ci.id desc
        limit 1;

        if khoa_id is null then
            select id into mau_id from program_templates
            where program_id = r.course_id and deleted_at is null
            order by id desc limit 1;

            if mau_id is null then
                insert into program_templates (program_id, name, description, status, created_at, updated_at)
                values (r.course_id, 'Mẫu chuyển đổi',
                        'Sinh tự động khi lớp chuyển từ trỏ thẳng chương trình sang trỏ khóa. Cần rà soát.',
                        'DRAFT', now(), now())
                returning id into mau_id;
            end if;

            select min(starts_on), max(ends_on) into tu, den
            from program_schedules where course_id = r.course_id and deleted_at is null;

            if tu is null then
                nam := case when extract(month from current_date) >= 8
                            then extract(year from current_date)::int
                            else extract(year from current_date)::int - 1 end;
                tu := make_date(nam, 8, 1);
                den := make_date(nam + 1, 5, 31);
            else
                nam := case when extract(month from tu) >= 8
                            then extract(year from tu)::int
                            else extract(year from tu)::int - 1 end;
                if den is null or den < tu then den := make_date(nam + 1, 5, 31); end if;
            end if;

            insert into course_instances (template_id, name, school_year, starts_on, ends_on, status, created_at, updated_at)
            values (mau_id, 'Khóa tạm — cần đặt lịch', nam || '-' || (nam + 1), tu, den, 'DRAFT', now(), now())
            returning id into khoa_id;
        end if;

        update class_courses set course_instance_id = khoa_id, updated_at = now()
        where course_id = r.course_id;
    end loop;
end $$;

alter table class_courses alter column course_instance_id set not null;
alter table class_courses drop constraint uq_class_courses;
alter table class_courses drop column course_id;

-- Ràng buộc cũ là ràng buộc bảng nên nó tính cả dòng đã xoá mềm: gỡ khóa khỏi lớp rồi gán lại thì
-- CSDL từ chối, trong khi màn hình không hiện khóa nào để người dùng gỡ. Đường ghi lại càng khó
-- đoán hơn — nó hỏi qua thực thể có lọc deleted_at nên tưởng chưa gán, rồi insert và vỡ 500.
-- Chỉ mục từng phần trả lại chỗ cho dòng đã xoá mà vẫn cấm hai dòng sống trùng nhau.
create unique index uq_class_courses on class_courses(class_id, course_instance_id) where deleted_at is null;
create index idx_class_courses_instance on class_courses(course_instance_id) where deleted_at is null;
