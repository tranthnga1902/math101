-- Neo bài giao vào buổi, và tách "giao cho ai" khỏi "giao ở lớp nào".
--
-- Trước lát này, assignments chỉ biết hai mốc tuyệt đối open_at/due_at. Giáo viên nói "nộp trước
-- buổi sau" thì phải tự dịch ra ngày, và mỗi lần dời lịch lại phải dịch lại bằng tay từng bài.
-- anchor_period_id ghi lại *luật*, còn open_at/due_at vẫn là câu trả lời đã vật hóa — màn hình
-- và luật vòng đời đọc y như cũ, chỉ có thêm một người sinh ra hai cột ấy.
--
-- Không cột nào bị xóa, và mọi mặc định dưới đây bằng đúng hành vi đang chạy, nên không có dòng
-- nào cần backfill: bài giao cũ vẫn là bài cả lớp, vẫn chỉ hiện đáp án sau khi trả bài.

alter table assignments
    -- Neo vào tiết của chương trình (program_periods), không neo vào ngày. Rỗng = ngày tuyệt đối
    -- như cũ.
    add column if not exists anchor_period_id    bigint      references program_periods(id),
    -- Đệm trước buổi sau. Mặc định 2 tiếng: hạn 0h00 sáng ngày học là hạn mà không ai kịp.
    add column if not exists due_buffer_minutes  int         not null default 120,
    add column if not exists task_kind           varchar(20) not null default 'BAI_TAP',
    add column if not exists answer_reveal       varchar(20) not null default 'AFTER_RETURN',
    add column if not exists counts_in_gradebook boolean     not null default true,
    add column if not exists target_scope        varchar(10) not null default 'CLASS';

-- task_kind chỉ chọn *bộ mặc định* lúc mở biểu mẫu; mọi ô sau đó vẫn sửa được. Nó không được
-- rẽ nhánh trong luật vòng đời — hai bộ mặc định, không phải hai mô hình dữ liệu.
alter table assignments add constraint ck_assignment_task_kind
    check (task_kind in ('BAI_TAP','BAI_KIEM_TRA','LUYEN_TU_DO'));
-- AFTER_RETURN là luật đang chạy (thấy điểm khi giáo viên trả bài hoặc tới giờ công bố).
alter table assignments add constraint ck_assignment_answer_reveal
    check (answer_reveal in ('AFTER_SUBMIT','AFTER_RETURN','IMMEDIATE'));
alter table assignments add constraint ck_assignment_target_scope
    check (target_scope in ('CLASS','SELECTED'));
alter table assignments add constraint ck_assignment_due_buffer
    check (due_buffer_minutes >= 0);

-- Đường đọc thật: "chốt tiết này xong thì phải dịch những bài nào".
create index idx_assignment_anchor on assignments(anchor_period_id)
    where deleted_at is null and anchor_period_id is not null;

-- Giao cho một nhóm học sinh (học bù, thi lại). Cả lớp thì KHÔNG sinh dòng nào ở đây.
--
-- Đó là lý do chọn phạm vi thay vì danh sách: học sinh vào lớp muộn tự động có bài mà không cần
-- job chép thêm dòng, học sinh rời lớp tự động rụng qua class_students.deleted_at, còn bài đã nộp
-- vẫn nằm nguyên ở assignment_progress để vào sổ điểm. Chép danh sách lúc giao thì cả ba việc ấy
-- đều phải nhớ làm bằng tay, và sẽ có lần quên.
create table assignment_targets (
    id bigserial primary key,
    assignment_id bigint not null references assignments(id),
    student_id    bigint not null references users(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

create unique index uq_assignment_target on assignment_targets(assignment_id, student_id)
    where deleted_at is null;
create index idx_assignment_target_student on assignment_targets(student_id)
    where deleted_at is null;
