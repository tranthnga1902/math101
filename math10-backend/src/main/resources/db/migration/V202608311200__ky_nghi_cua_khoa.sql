-- Kỳ nghỉ của khóa: những ngày nằm trong lịch nhưng không ai học.
--
-- Quyết định đã chốt: tuần nghỉ lễ ghi thành bảng riêng của khóa, không nhét vào lịch chương.
-- Hai cách kia đều tệ hơn. Cắt lịch chương làm hai đoạn để chừa Tết ra thì Tết biến mất khỏi CSDL —
-- còn lại là một khoảng trống không ai giải thích được, và sang năm phải cắt lại bằng tay. Trừ ngày
-- nghỉ khi tính tiến độ thì ngày nghỉ chỉ tồn tại trong đầu người viết công thức.
--
-- Gắn vào khóa chứ không vào chương trình: hai khóa của cùng chương trình nghỉ khác nhau là chuyện
-- thường (trường tư nghỉ hè sớm hơn). Đây cũng là tầng duy nhất được phép mang ngày tháng.
create table academic_breaks (
    id bigserial primary key,
    course_instance_id bigint not null references course_instances(id),
    starts_on date not null,
    ends_on date not null,
    reason varchar(200) not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint ck_academic_breaks_dates check (starts_on <= ends_on)
);

-- Đường đọc luôn là "khóa này, ngày này có nghỉ không", nên chỉ mục đi theo đúng cặp đó. Lọc dòng
-- đã xoá mềm ngay trong chỉ mục vì mọi câu hỏi đều chỉ hỏi kỳ nghỉ đang còn hiệu lực.
create index idx_academic_breaks_lookup on academic_breaks(course_instance_id, starts_on, ends_on)
    where deleted_at is null;

-- Không cấm hai kỳ nghỉ chồng nhau. Nghỉ Tết chín ngày rồi nghỉ bù thêm một ngày nằm trong đó là
-- dữ liệu người ta thật sự nhập, và hợp của hai khoảng vẫn là một khoảng nghỉ — cấm thì chỉ tạo ra
-- một lỗi khó hiểu cho một tình huống không hề sai.
