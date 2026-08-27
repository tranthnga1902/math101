-- Vòng đời bài giao: giờ mở, số lần làm, chính sách nộp muộn, giờ công bố điểm.
-- Trước đây assignments chỉ có due_at và due_at không được kiểm ở bất kỳ đâu trên server,
-- nên hạn nộp chỉ là chữ hiển thị trên màn hình.

alter table assignments add column if not exists open_at timestamp;
alter table assignments add column if not exists max_attempts int not null default 1;
alter table assignments add column if not exists late_policy varchar(20) not null default 'REJECT';
alter table assignments add column if not exists late_penalty_percent int not null default 0;
alter table assignments add column if not exists publish_score_at timestamp;

-- max_attempts = 0 nghĩa là không giới hạn số lần nộp; số âm thì vô nghĩa.
alter table assignments add constraint ck_assignments_max_attempts check (max_attempts >= 0);
alter table assignments add constraint ck_assignments_late_policy
    check (late_policy in ('REJECT', 'ACCEPT', 'PENALTY'));
alter table assignments add constraint ck_assignments_late_penalty
    check (late_penalty_percent between 0 and 100);
-- Mở sau hạn thì bài không bao giờ nộp được — chặn ngay ở tầng dữ liệu.
alter table assignments add constraint ck_assignments_open_before_due
    check (open_at is null or due_at is null or open_at <= due_at);

alter table assignment_progress add column if not exists attempt_no int not null default 0;
alter table assignment_progress add column if not exists submitted_late boolean not null default false;
-- Điểm gốc trước khi trừ phần trăm nộp muộn. Giữ riêng để còn giải thích được cho học sinh
-- vì sao 8.0 thành 6.4, và để chấm lại không nhân trừ chồng lên nhau.
alter table assignment_progress add column if not exists raw_score numeric(5,2);

alter table assignment_progress add constraint ck_assignment_progress_attempt_no check (attempt_no >= 0);

-- Bài đã nộp trước khi có cột này phải tính là đã dùng 1 lượt, nếu không thì hôm nay
-- ai cũng được nộp thêm một lần nữa dù max_attempts = 1.
update assignment_progress set attempt_no = 1 where submitted_at is not null and attempt_no = 0;
update assignment_progress set raw_score = score where score is not null and raw_score is null;

create index if not exists idx_assignments_class_open on assignments(class_id, open_at) where deleted_at is null;
