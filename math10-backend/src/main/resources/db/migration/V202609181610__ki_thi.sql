-- Kì thi: một vật chứa ở trên bài giao, không phải một hệ thống nộp bài song song.
--
-- Admin ra đề chung cho cả khóa, giáo viên ra đề cho riêng lớp mình. Hai việc ấy khác nhau ở
-- *tầm với* (reach), không khác nhau ở cách học sinh làm bài: phát hành xong, kì thi rơi xuống
-- thành assignments bình thường (task_kind='BAI_KIEM_TRA'), nên vòng đời nộp/chấm/sổ điểm,
-- màn làm bài và cổng đọc đều dùng lại nguyên vẹn. Nếu dựng luồng nộp bài riêng cho thi thì
-- sẽ có hai bộ luật hạn nộp, hai bộ luật lộ đáp án, và chúng sẽ trôi lệch nhau.
--
-- Kì thi giữ *ý định* (đề nào, bao nhiêu phút, neo vào tiết nào); bài giao con giữ *câu trả lời
-- đã vật hóa* cho từng lớp — vì mỗi lớp chốt buổi vào ngày khác nhau, một dòng không giữ nổi
-- hai cặp mốc giờ.

create table exams (
    id bigserial primary key,
    -- COURSE = kì thi chung của khóa (admin). CLASS = kì thi của một lớp (giáo viên).
    scope varchar(10) not null,
    course_instance_id bigint references course_instances(id),
    class_id           bigint references classes(id),
    title       varchar(255) not null,
    description text,
    -- Đề đã phát hành. worksheet_version_id mới là thứ học sinh làm: bản chụp bất biến, sửa câu
    -- gốc về sau không đổi đề đã thi.
    worksheet_id         bigint references worksheets(id),
    worksheet_version_id bigint references worksheet_versions(id),
    duration_minutes int,
    open_at timestamp,
    due_at  timestamp,
    -- Neo vào tiết chương trình thay vì ngày tuyệt đối. Buổi không gắn ngày; ngày là của lớp.
    anchor_period_id bigint references program_periods(id),
    max_attempts        int         not null default 1,
    late_policy         varchar(20) not null default 'REJECT',
    answer_reveal       varchar(20) not null default 'AFTER_RETURN',
    counts_in_gradebook boolean     not null default true,
    status varchar(20) not null default 'DRAFT',
    created_by bigint not null references users(id),
    created_at timestamp not null default now(),
    updated_at timestamp not null default now(),
    deleted_at timestamp,
    constraint ck_exam_scope check (scope in ('COURSE','CLASS')),
    constraint ck_exam_status check (status in ('DRAFT','PUBLISHED','CLOSED')),
    constraint ck_exam_answer_reveal check (answer_reveal in ('AFTER_SUBMIT','AFTER_RETURN','IMMEDIATE')),
    -- Tầm với phải khớp với cột chứa nó: kì thi của khóa thì không được đồng thời là của một lớp,
    -- nếu không thì lúc phát hành không biết nên rơi xuống bao nhiêu lớp.
    constraint ck_exam_reach check (
        (scope = 'COURSE' and course_instance_id is not null and class_id is null)
     or (scope = 'CLASS'  and class_id is not null and course_instance_id is null))
);

create index idx_exam_course on exams(course_instance_id) where deleted_at is null;
create index idx_exam_class  on exams(class_id)           where deleted_at is null;

alter table assignments add column if not exists exam_id bigint references exams(id);

-- Phát hành lại một kì thi là chuyện thường (sửa giờ, thêm lớp vào khóa). Chỉ mục này làm cho
-- lần phát hành thứ hai cập nhật đúng bài cũ thay vì đẻ thêm bài trùng cho cùng một lớp.
create unique index uq_assignment_exam_class on assignments(exam_id, class_id)
    where deleted_at is null and exam_id is not null;
