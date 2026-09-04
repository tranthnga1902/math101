-- Bảng hồ sơ bộ sách giáo khoa và cấu hình ánh xạ chương - mạch hoàn toàn từ DB.
-- Admin toàn quyền kiểm soát, không hardcode bất kỳ chương, mạch hay từ khóa nào trong mã nguồn.

create table if not exists book_series (
    id          bigserial primary key,
    code        varchar(30) not null unique,
    name        varchar(150) not null,
    publisher   varchar(200),
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),
    deleted_at  timestamptz
);

create table if not exists book_series_chapters (
    id              bigserial primary key,
    -- book_series.code is unique only among non-deleted rows. PostgreSQL cannot
    -- use that partial index as the target of a foreign key.
    book_series_code varchar(30) not null,
    grade_number    int not null check (grade_number between 1 and 12),
    subject         varchar(100) not null default 'Toán',
    chapter_numeral varchar(30) not null,
    chapter_title   varchar(255) not null,
    strand_code     varchar(30) not null,
    order_index     int not null default 1,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz,
    unique (book_series_code, grade_number, subject, chapter_numeral)
);

create index if not exists idx_series_chapters on book_series_chapters(book_series_code, grade_number, subject);

-- Cấu hình từ khóa suy mạch theo bộ sách (ngoài program_mach_tu_khoa theo từng khóa học)
create table if not exists book_series_keywords (
    id              bigserial primary key,
    book_series_code varchar(30) not null,
    strand_code     varchar(30) not null,
    keyword         varchar(255) not null,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),
    deleted_at      timestamptz
);

create index if not exists idx_series_keywords on book_series_keywords(book_series_code, strand_code);

-- Cấu hình từ đồng nghĩa / gán cột động (để admin tùy biến việc nhận diện header của file)
create table if not exists import_column_aliases (
    id              bigserial primary key,
    alias_normalized varchar(100) not null unique,
    standard_field  varchar(50) not null,
    note            varchar(255)
);

-- Seed các bộ sách chuẩn
-- book_series was introduced by V202608311000. Its audit columns deliberately
-- have no database defaults, so populate them explicitly here. The conflict
-- predicate must match that migration's partial unique index.
insert into book_series(code, name, publisher, created_at, updated_at) values
 ('KNTT', 'Kết nối tri thức với cuộc sống', 'NXB Giáo dục Việt Nam', now(), now()),
 ('CTST', 'Chân trời sáng tạo', 'NXB Giáo dục Việt Nam', now(), now()),
 ('CD', 'Cánh Diều', 'NXB Đại học Sư phạm', now(), now())
on conflict (code) where deleted_at is null do nothing;

-- Seed cấu trúc chương Toán 10 KNTT (tất cả nằm trong DB, không nằm trong code)
insert into book_series_chapters(book_series_code, grade_number, subject, chapter_numeral, chapter_title, strand_code, order_index) values
 ('KNTT', 10, 'Toán', 'I', 'Mệnh đề và tập hợp', 'DAI_SO', 1),
 ('KNTT', 10, 'Toán', 'II', 'Bất phương trình và hệ bất phương trình bậc nhất hai ẩn', 'DAI_SO', 2),
 ('KNTT', 10, 'Toán', 'III', 'Hệ thức lượng trong tam giác', 'HINH_HOC', 3),
 ('KNTT', 10, 'Toán', 'IV', 'Vectơ', 'HINH_HOC', 4),
 ('KNTT', 10, 'Toán', 'V', 'Các số đặc trưng đo xu thế trung tâm và độ phân tán', 'THONG_KE', 5),
 ('KNTT', 10, 'Toán', 'VI', 'Hàm số, đồ thị và ứng dụng', 'DAI_SO', 6),
 ('KNTT', 10, 'Toán', 'VII', 'Phương pháp tọa độ trong mặt phẳng', 'HINH_HOC', 7),
 ('KNTT', 10, 'Toán', 'VIII', 'Đại số tổ hợp', 'DAI_SO', 8),
 ('KNTT', 10, 'Toán', 'IX', 'Tính xác suất theo định nghĩa cổ điển', 'THONG_KE', 9)
on conflict (book_series_code, grade_number, subject, chapter_numeral) do update
set chapter_title = excluded.chapter_title, strand_code = excluded.strand_code;

-- Seed cấu trúc chương Toán 10 CTST
insert into book_series_chapters(book_series_code, grade_number, subject, chapter_numeral, chapter_title, strand_code, order_index) values
 ('CTST', 10, 'Toán', 'I', 'Mệnh đề và tập hợp', 'DAI_SO', 1),
 ('CTST', 10, 'Toán', 'II', 'Bất phương trình và hệ bất phương trình bậc nhất hai ẩn', 'DAI_SO', 2),
 ('CTST', 10, 'Toán', 'III', 'Hàm số bậc hai và đồ thị', 'DAI_SO', 3),
 ('CTST', 10, 'Toán', 'IV', 'Hệ thức lượng trong tam giác', 'HINH_HOC', 4),
 ('CTST', 10, 'Toán', 'V', 'Vectơ', 'HINH_HOC', 5),
 ('CTST', 10, 'Toán', 'VI', 'Thống kê', 'THONG_KE', 6),
 ('CTST', 10, 'Toán', 'VII', 'Bất phương trình bậc hai một ẩn', 'DAI_SO', 7),
 ('CTST', 10, 'Toán', 'VIII', 'Đại số tổ hợp', 'DAI_SO', 8),
 ('CTST', 10, 'Toán', 'IX', 'Phương pháp tọa độ trong mặt phẳng', 'HINH_HOC', 9),
 ('CTST', 10, 'Toán', 'X', 'Xác suất', 'THONG_KE', 10)
on conflict (book_series_code, grade_number, subject, chapter_numeral) do update
set chapter_title = excluded.chapter_title, strand_code = excluded.strand_code;

-- Seed từ đồng nghĩa cột vào DB
insert into import_column_aliases(alias_normalized, standard_field, note) values
 ('namespace', 'namespace', 'Mặc định'),
 ('loai chuong trinh', 'namespace', 'Biến thể'),
 ('mach', 'strandCode', 'Mã phân môn'),
 ('ma mach', 'strandCode', 'Mã phân môn'),
 ('strand', 'strandCode', 'Tiếng Anh'),
 ('mon', 'strandCode', 'Tên môn'),
 ('ten mach', 'strandName', 'Tên phân môn'),
 ('ten mon', 'strandName', 'Tên phân môn'),
 ('hoc ky', 'semester', 'Học kỳ'),
 ('ky', 'semester', 'Học kỳ'),
 ('semester', 'semester', 'Tiếng Anh'),
 ('term', 'semester', 'Tiếng Anh'),
 ('tiet', 'periodRange', 'Số tiết'),
 ('so tiet', 'periodRange', 'Số tiết'),
 ('tiet hoc', 'periodRange', 'Tiết học'),
 ('so tiet hoc', 'periodRange', 'Tiết học'),
 ('period', 'periodRange', 'Tiếng Anh'),
 ('tuan', 'weekRange', 'Tuần học'),
 ('so tuan', 'weekRange', 'Số tuần'),
 ('week', 'weekRange', 'Tiếng Anh'),
 ('chuong', 'chapterNumeral', 'Số hiệu chương'),
 ('so chuong', 'chapterNumeral', 'Số chương'),
 ('chapter', 'chapterNumeral', 'Tiếng Anh'),
 ('ten chuong', 'chapterName', 'Tên chương'),
 ('chapter name', 'chapterName', 'Tiếng Anh'),
 ('bai hoc', 'lessonName', 'Tên bài học'),
 ('ten bai', 'lessonName', 'Tên bài'),
 ('bai', 'lessonName', 'Bài'),
 ('noi dung', 'lessonName', 'Nội dung bài'),
 ('chu de', 'lessonName', 'Chủ đề'),
 ('loai', 'kind', 'Phân loại tiết'),
 ('phan loai', 'kind', 'Phân loại tiết'),
 ('kind', 'kind', 'Tiếng Anh')
on conflict (alias_normalized) do nothing;
