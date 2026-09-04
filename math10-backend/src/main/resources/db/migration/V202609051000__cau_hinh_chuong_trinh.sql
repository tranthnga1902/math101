-- Cấu hình phân phối chương trình theo DB.
--
-- Trước đây các tham số (số tuần, tuần kết HK1, từ khóa nhận dạng mạch, tuần đặc biệt)
-- nằm cứng trong PhanPhoiChuan.java và PpctSuyMach.java — đúng cho CTST Toán 10 nhưng
-- sai khi mở thêm khối hoặc bộ sách khác. Bốn bảng dưới đây chuyển toàn bộ dữ liệu ấy
-- vào DB để admin chỉnh qua UI mà không cần deploy lại.
--
-- Không đụng vào program_strands / program_periods / program_ppct_config hiện có.

-- Tham số thời gian: số tuần, tuần kết thúc HK1, số tiết mỗi tuần.
-- Đây là bảng "có hay không": không có dòng nào cho program_id thì endpoint /seed báo lỗi
-- và yêu cầu đặt cấu hình trước.
create table program_ppct_config (
    program_id      bigint primary key references courses(id),
    so_tuan         int not null check (so_tuan >= 1),
    tuan_ky_1       int not null check (tuan_ky_1 >= 1),
    tiet_mot_tuan   int not null default 3 check (tiet_mot_tuan >= 1),
    created_at      timestamp not null,
    updated_at      timestamp not null
);

-- Cấu hình từng mạch: mã, tên, thứ tự hiển thị, tuần hoạt động.
-- bat_dau_tuan / ket_thuc_tuan NULL nghĩa là chạy từ đầu / đến cuối năm.
-- Hai mạch dùng chung một ô (HINH_HOC kết tuần 11, THONG_KE bắt tuần 12 trong CTST)
-- biểu diễn bằng ket_thuc_tuan và bat_dau_tuan của hai dòng liên tiếp — không cần cột
-- riêng cho "slot sharing" vì quy tắc ghép ô là hệ quả của khoảng tuần.
create table program_mach_config (
    id              bigserial primary key,
    program_id      bigint not null references courses(id),
    ma_mach         varchar(30) not null,
    ten_mach        varchar(120) not null,
    thu_tu          int not null,
    bat_dau_tuan    int check (bat_dau_tuan >= 1),   -- NULL = tuần 1
    ket_thuc_tuan   int check (ket_thuc_tuan >= 1),  -- NULL = tuần cuối
    so_tiet_mot_tuan int not null default 1 check (so_tiet_mot_tuan >= 1), -- tiết mạch chiếm mỗi tuần
    created_at      timestamp not null,
    updated_at      timestamp not null,
    deleted_at      timestamp
);

create unique index uq_mach_config_ma    on program_mach_config(program_id, ma_mach)  where deleted_at is null;
create unique index uq_mach_config_order on program_mach_config(program_id, thu_tu)   where deleted_at is null;

-- Tuần đặc biệt: HĐTN (thay thế ô đơn của DAI_SO), ôn tập, kiểm tra.
-- nhan dùng khi sinh tiêu đề tiết kiểm tra: "Kiểm tra giữa học kỳ I".
-- ma_mach NULL áp cho ô đơn mặc định (thường là DAI_SO); không NULL nếu loại đặc biệt
-- của một mạch khác (ví dụ ôn tập riêng của HINH_HOC).
create table program_tuan_dac_biet (
    id          bigserial primary key,
    program_id  bigint not null references courses(id),
    tuan_so     int not null check (tuan_so >= 1),
    loai        varchar(20) not null,
    ma_mach     varchar(30),
    nhan        varchar(120),
    created_at  timestamp not null,
    updated_at  timestamp not null,
    deleted_at  timestamp,
    constraint ck_tuan_dac_biet_loai check (loai in ('HDTN', 'ON_TAP', 'KIEM_TRA'))
);

-- Một tuần, một loại, một mạch là duy nhất: không cho có hai dòng KIEM_TRA cùng tuần
-- cho cùng mạch vì không ai biết tiêu đề nào dùng.
create unique index uq_tuan_dac_biet on program_tuan_dac_biet(program_id, tuan_so, loai, coalesce(ma_mach, ''))
    where deleted_at is null;

-- Từ khóa nhận dạng mạch khi đọc PPCT PDF.
-- Mỗi dòng một từ/cụm từ — không lưu regex. PpctSuyMach load danh sách này rồi build
-- Pattern trong memory; admin đọc và sửa được mà không cần hiểu regex.
create table program_mach_tu_khoa (
    id          bigserial primary key,
    program_id  bigint not null references courses(id),
    ma_mach     varchar(30) not null,
    tu_khoa     varchar(255) not null,
    created_at  timestamp not null,
    updated_at  timestamp not null,
    deleted_at  timestamp
);

create index idx_mach_tu_khoa on program_mach_tu_khoa(program_id, ma_mach) where deleted_at is null;
