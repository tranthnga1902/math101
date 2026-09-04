-- Mạch và tiết: chương trình Toán 10 không phải một dòng.
--
-- Hệ đang trả lời "học sinh đang học tới đâu" bằng program_schedules — mỗi chương một khoảng ngày,
-- và tại một ngày thì có đúng một chương đang chạy. Điều đó sai ngay từ tuần 1: tuần 1 có Đại số
-- tiết 1 và Hình học tiết 1 chạy song song, hai bộ đếm độc lập, không cái nào là "chương hiện
-- hành" của cái kia. Một số ít không biểu diễn được hai dòng chảy.
--
-- Bảng cũ không bỏ đi và cũng không mâu thuẫn: nó nói "chương này dạy trong khoảng ngày này", đó
-- vẫn là câu trả lời đúng cho câu hỏi của nó. Hai bảng trả lời hai câu khác nhau — chương nằm ở
-- đâu trong năm, và tuần này ba mạch đang ở tiết nào.

create table program_strands (
    id bigserial primary key,
    program_id bigint not null references courses(id),
    code varchar(30) not null,
    name varchar(120) not null,
    order_index int not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp
);

-- Hai chỉ mục vì hai thứ khác nhau phải là duy nhất: một chương trình không được có hai mạch cùng
-- mã (nếu không thì "Hình học" là hai thứ), và không được có hai mạch cùng chỗ trong thứ tự hiện
-- ra (nếu không thì làn nào nằm trên làn nào là ngẫu nhiên, mà màn Lộ trình xếp làn theo đúng cột đó).
create unique index uq_program_strand_code  on program_strands(program_id, code)        where deleted_at is null;
create unique index uq_program_strand_order on program_strands(program_id, order_index) where deleted_at is null;

create table program_periods (
    id bigserial primary key,
    strand_id bigint not null references program_strands(id),
    period_no int not null,
    week_no int not null,
    term smallint not null,
    lesson_id bigint references lessons(id),
    title varchar(255) not null,
    period_kind varchar(20) not null,
    source varchar(20) not null default 'SEED',
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    constraint ck_program_period_kind   check (period_kind in ('BAI_MOI','ON_TAP','KIEM_TRA','THUC_HANH')),
    constraint ck_program_period_source check (source in ('SEED','MANUAL')),
    constraint ck_program_period_term   check (term in (1,2)),
    constraint ck_program_period_week   check (week_no >= 1),
    constraint ck_program_period_no     check (period_no >= 1)
);

-- Số tiết đếm RIÊNG trong từng mạch, nên chỉ mục duy nhất đi theo (mạch, số tiết) chứ không theo
-- chương trình. Đánh chung một chuỗi cho cả chương trình là mô hình sai: "Hình học tiết 9" là câu
-- giáo viên nói và học sinh nghe, còn "tiết thứ 14 của cả năm" thì không ai dùng. Ràng buộc ở đây
-- là thứ giữ cho hai bộ đếm không lẫn vào nhau.
create unique index uq_program_period_no on program_periods(strand_id, period_no) where deleted_at is null;

-- Câu hỏi hay hỏi nhất là "tuần N học gì", đi từ chương trình xuống các mạch rồi lọc tuần.
create index idx_program_period_week on program_periods(strand_id, week_no) where deleted_at is null;

-- Trỏ tới bài học thì có thể rỗng, và phần lớn dòng sinh tự động sẽ rỗng. Tiết kiểm tra vốn không
-- ứng với bài nào; còn tiết bài mới thì ứng với bài nào là việc người soạn biết, không phải việc
-- máy đoán. Để rỗng là chỗ trống nhìn thấy được; đoán bừa là dữ liệu sai không ai nhìn ra.
create index idx_program_period_lesson on program_periods(lesson_id) where deleted_at is null and lesson_id is not null;

-- source phân biệt dòng máy sinh theo quy tắc với dòng người nhập. Lượt sinh lại chỉ được đụng vào
-- dòng SEED. Không có cột này thì "sinh lại phân phối chuẩn" là một nút xóa mất công người ta sửa.
