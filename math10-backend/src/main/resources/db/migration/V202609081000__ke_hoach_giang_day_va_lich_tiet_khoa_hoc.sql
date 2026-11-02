-- =============================================================================
-- V202609081000: Kế hoạch giảng dạy và lịch tiết của khóa học
--
-- Bổ sung kiến trúc 4 tầng đầy đủ:
--   courses → teaching_plans → course_instances → classes
--
-- Nguyên tắc additive: chỉ ADD TABLE / ADD COLUMN / ADD INDEX.
-- Không DROP bảng cũ (program_templates, program_template_chapters).
-- Không thay đổi ràng buộc NOT NULL của các cột hiện có.
-- Backfill dữ liệu cũ sang cấu trúc mới để tương thích ngược.
-- =============================================================================

-- --------------------------------------------------------------------------
-- Tầng 2: TEACHING_PLANS (Kế hoạch giảng dạy)
-- Thay thế khái niệm "mẫu chương trình" bằng "kế hoạch giảng dạy":
-- không gắn ngày, chỉ trả lời "tuần nào có bao nhiêu tiết, dạy gì".
-- --------------------------------------------------------------------------
create table if not exists teaching_plans (
    id              bigserial primary key,
    course_id       bigint        not null references courses(id),
    -- template_id trỏ vào program_templates để tương thích ngược với dữ liệu cũ.
    -- Null khi kế hoạch được tạo mới hoàn toàn.
    template_id     bigint        references program_templates(id),
    name            varchar(255)  not null,
    description     text,
    total_weeks     int           not null default 35,
    total_periods   int           not null default 105,
    status          varchar(30)   not null default 'ACTIVE',
    created_at      timestamp     not null,
    updated_at      timestamp     not null,
    deleted_at      timestamp,
    constraint ck_teaching_plan_status check (status in ('DRAFT','ACTIVE','ARCHIVED')),
    constraint ck_teaching_plan_weeks  check (total_weeks  >= 1),
    constraint ck_teaching_plan_periods check (total_periods >= 1)
);

create unique index if not exists uq_teaching_plan_template
    on teaching_plans(template_id) where deleted_at is null and template_id is not null;

create index if not exists idx_teaching_plan_course
    on teaching_plans(course_id) where deleted_at is null;

-- --------------------------------------------------------------------------
-- Backfill: mỗi program_template hiện có → một teaching_plan tương ứng.
-- Sử dụng total_periods từ courses.total_periods nếu có, nếu không thì đếm
-- từ program_periods, nếu cũng không có thì mặc định 105.
-- nullif(...,0) để 0 (giá trị mặc định chưa cấu hình) không được coi là "đã có",
-- tránh vi phạm ck_teaching_plan_periods (total_periods >= 1).
-- --------------------------------------------------------------------------
insert into teaching_plans (course_id, template_id, name, description,
                             total_weeks, total_periods, status, created_at, updated_at)
select
    pt.program_id,
    pt.id,
    pt.name,
    pt.description,
    coalesce(nullif(c.total_weeks, 0), 35),
    coalesce(nullif(c.total_periods, 0),
        nullif((select count(*) from program_periods pp
           join program_strands ps on ps.id = pp.strand_id and ps.deleted_at is null
          where ps.program_id = pt.program_id and pp.deleted_at is null), 0),
        105),
    case when pt.status = 'DRAFT' then 'DRAFT' else 'ACTIVE' end,
    pt.created_at,
    pt.updated_at
from program_templates pt
join courses c on c.id = pt.program_id
where pt.deleted_at is null
  and not exists (
      select 1 from teaching_plans tp
      where tp.template_id = pt.id and tp.deleted_at is null
  )
on conflict do nothing;

-- --------------------------------------------------------------------------
-- TEACHING_PLAN_ITEMS (Phân phối tiết vào tuần của kế hoạch giảng dạy)
-- program_periods = tiết này là nội dung gì
-- teaching_plan_items = tiết này được xếp vào tuần nào trong kế hoạch
-- --------------------------------------------------------------------------
create table if not exists teaching_plan_items (
    id                  bigserial primary key,
    teaching_plan_id    bigint  not null references teaching_plans(id),
    program_period_id   bigint  not null references program_periods(id),
    week_number         int     not null check (week_number >= 1),
    order_in_week       int     not null default 1,
    -- Denormalized để truy vấn nhanh mà không cần JOIN theo chiều ngược lại.
    -- Giá trị luôn đồng nhất với program_period.strand_id và lesson_id.
    strand_id           bigint  references program_strands(id),
    chapter_id          bigint  references chapters(id),
    lesson_id           bigint  references lessons(id),
    planned_duration    int     not null default 45,  -- phút
    created_at          timestamp not null,
    updated_at          timestamp not null,
    deleted_at          timestamp,
    constraint ck_tpi_duration check (planned_duration > 0)
);

create unique index if not exists uq_teaching_plan_item_period
    on teaching_plan_items(teaching_plan_id, program_period_id)
    where deleted_at is null;

create index if not exists idx_tpi_plan_week
    on teaching_plan_items(teaching_plan_id, week_number, order_in_week)
    where deleted_at is null;

-- Backfill teaching_plan_items từ program_periods hiện có.
-- Dùng week_no và period_no của program_periods để sắp thứ tự.
insert into teaching_plan_items
    (teaching_plan_id, program_period_id, week_number, order_in_week,
     strand_id, lesson_id, planned_duration, created_at, updated_at)
select
    tp.id,
    pp.id,
    pp.week_no,
    pp.period_no,  -- dùng số tiết trong mạch làm thứ tự tạm thời
    pp.strand_id,
    pp.lesson_id,
    45,
    now(),
    now()
from teaching_plans tp
join program_strands ps on ps.program_id = tp.course_id and ps.deleted_at is null
join program_periods pp on pp.strand_id = ps.id and pp.deleted_at is null
where tp.deleted_at is null
  and not exists (
      select 1 from teaching_plan_items tpi
      where tpi.teaching_plan_id = tp.id
        and tpi.program_period_id = pp.id
        and tpi.deleted_at is null
  )
on conflict do nothing;

-- --------------------------------------------------------------------------
-- Tầng 3: Bổ sung cột vào COURSE_INSTANCES
-- Thêm trỏ trực tiếp vào course_id và teaching_plan_id.
-- Giữ nguyên template_id (tương thích ngược).
-- target_ends_on là ngày kết thúc mục tiêu admin đặt ra; ends_on vẫn là
-- ngày cập nhật theo lịch thực tế sau khi sinh.
-- --------------------------------------------------------------------------
alter table course_instances
    add column if not exists course_id        bigint references courses(id),
    add column if not exists teaching_plan_id bigint references teaching_plans(id),
    add column if not exists target_ends_on   date;

-- Backfill course_id và teaching_plan_id cho các khóa đang có.
update course_instances ci
set
    course_id        = pt.program_id,
    teaching_plan_id = tp.id,
    target_ends_on   = ci.ends_on
from program_templates pt
left join teaching_plans tp on tp.template_id = pt.id and tp.deleted_at is null
where ci.template_id = pt.id
  and ci.course_id is null
  and ci.deleted_at is null;

create index if not exists idx_course_instances_course
    on course_instances(course_id) where deleted_at is null;
create index if not exists idx_course_instances_teaching_plan
    on course_instances(teaching_plan_id) where deleted_at is null;

-- --------------------------------------------------------------------------
-- COURSE_WEEKLY_SCHEDULE (Cấu hình lịch học trong tuần của một khóa học)
-- Không phải "3 ngày/tuần" mà phải lưu "Thứ 2 = 1 tiết, Thứ 4 = 1 tiết, Thứ 6 = 1 tiết"
-- để biết chính xác bao nhiêu tiết từng ngày.
-- --------------------------------------------------------------------------
create table if not exists course_weekly_schedule (
    id                  bigserial primary key,
    course_instance_id  bigint      not null references course_instances(id),
    day_of_week         varchar(20) not null,  -- MONDAY, TUESDAY, ..., SUNDAY (ISO)
    period_count        int         not null default 1,
    order_index         int         not null default 0,
    created_at          timestamp   not null,
    updated_at          timestamp   not null,
    deleted_at          timestamp,
    constraint ck_cws_day check (day_of_week in
        ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY')),
    constraint ck_cws_periods check (period_count >= 1 and period_count <= 10)
);

create unique index if not exists uq_course_weekly_schedule
    on course_weekly_schedule(course_instance_id, day_of_week)
    where deleted_at is null;

create index if not exists idx_course_weekly_schedule_instance
    on course_weekly_schedule(course_instance_id) where deleted_at is null;

-- --------------------------------------------------------------------------
-- COURSE_HOLIDAYS (Ngày nghỉ của khóa học)
-- Tách biệt với academic_breaks để tường minh hơn và hỗ trợ type (HOLIDAY, MAKEUP, etc.)
-- Dữ liệu trong academic_breaks vẫn giữ nguyên và được đồng bộ vào đây.
-- --------------------------------------------------------------------------
create table if not exists course_holidays (
    id                  bigserial primary key,
    course_instance_id  bigint       not null references course_instances(id),
    starts_on           date         not null,
    ends_on             date         not null,
    type                varchar(50)  not null default 'HOLIDAY',
    name                varchar(255) not null,
    description         text,
    -- academic_break_id nối về bảng cũ để tránh trùng lặp khi đồng bộ.
    academic_break_id   bigint       references academic_breaks(id),
    created_at          timestamp    not null,
    updated_at          timestamp    not null,
    deleted_at          timestamp,
    constraint ck_course_holiday_dates  check (starts_on <= ends_on),
    constraint ck_course_holiday_type   check (type in ('HOLIDAY','MAKEUP','OTHER'))
);

create index if not exists idx_course_holidays_lookup
    on course_holidays(course_instance_id, starts_on, ends_on)
    where deleted_at is null;

-- Backfill từ academic_breaks sang course_holidays.
insert into course_holidays
    (course_instance_id, starts_on, ends_on, type, name, academic_break_id,
     created_at, updated_at)
select
    ab.course_instance_id,
    ab.starts_on,
    ab.ends_on,
    'HOLIDAY',
    ab.reason,
    ab.id,
    ab.created_at,
    ab.updated_at
from academic_breaks ab
where ab.deleted_at is null
  and not exists (
      select 1 from course_holidays ch
      where ch.academic_break_id = ab.id and ch.deleted_at is null
  )
on conflict do nothing;

-- --------------------------------------------------------------------------
-- COURSE_SESSIONS (Tiết học được sinh ra từ kế hoạch + lịch tuần + ngày nghỉ)
-- Mỗi dòng = một tiết triển khai thực tế của khóa học.
-- Nhiều lớp học chung một course_instance thì dùng chung bảng này.
-- Tiến độ thực tế của từng lớp lưu ở class_course_progress.
-- --------------------------------------------------------------------------
create table if not exists course_sessions (
    id                      bigserial primary key,
    course_instance_id      bigint      not null references course_instances(id),
    teaching_plan_item_id   bigint      references teaching_plan_items(id),
    program_period_id       bigint      not null references program_periods(id),
    instructional_week_number int       not null check (instructional_week_number >= 1),
    planned_date            date        not null,
    planned_order_on_date   int         not null default 1,
    status                  varchar(30) not null default 'PLANNED',
    actual_date             date,
    completed_at            timestamp,
    edited_manually         boolean     not null default false,
    note                    varchar(500),
    created_at              timestamp   not null,
    updated_at              timestamp   not null,
    deleted_at              timestamp,
    constraint ck_course_session_status check (status in ('PLANNED','COMPLETED','CANCELLED')),
    constraint ck_course_session_order  check (planned_order_on_date >= 1)
);

-- Chỉ mục chính: "khóa này, ngày này có những tiết nào theo thứ tự".
create index if not exists idx_course_sessions_date
    on course_sessions(course_instance_id, planned_date, planned_order_on_date)
    where deleted_at is null;

-- Chỉ mục tra theo tuần (để sinh lịch nhanh và hiển thị tuần học).
create index if not exists idx_course_sessions_week
    on course_sessions(course_instance_id, instructional_week_number)
    where deleted_at is null;

-- Chỉ mục tra theo tiết chương trình (để kiểm tra progress).
create index if not exists idx_course_sessions_period
    on course_sessions(program_period_id, course_instance_id)
    where deleted_at is null;

-- --------------------------------------------------------------------------
-- CLASS_COURSE_PROGRESS (Tiến độ thực tế riêng của mỗi lớp theo khóa học)
-- class_period_progress ghi từng sự kiện chốt tiết.
-- class_course_progress là bảng tổng hợp: lớp này đang ở tiết nào, để
-- tính nhanh BEHIND / ON_TRACK / AHEAD mà không cần COUNT mỗi lần.
-- --------------------------------------------------------------------------
create table if not exists class_course_progress (
    id                          bigserial primary key,
    class_id                    bigint    not null references classes(id),
    course_instance_id          bigint    not null references course_instances(id),
    last_completed_session_id   bigint    references course_sessions(id),
    last_completed_period_id    bigint    references program_periods(id),
    completed_period_count      int       not null default 0,
    updated_at                  timestamp not null default now()
);

create unique index if not exists uq_class_course_progress
    on class_course_progress(class_id, course_instance_id);

create index if not exists idx_class_course_progress_instance
    on class_course_progress(course_instance_id);
