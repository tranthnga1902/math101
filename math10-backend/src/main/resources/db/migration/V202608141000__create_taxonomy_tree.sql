create extension if not exists pg_trgm;

create table taxonomy_node (
    id bigserial primary key,
    parent_id bigint references taxonomy_node(id),
    subject varchar(40) not null default 'TOAN_10',
    depth int not null,
    title text not null,
    description text,
    slug text not null,
    order_no int not null default 0,
    proposed_by bigint,
    status varchar(20) not null default 'ACTIVE',
    merged_into bigint references taxonomy_node(id),
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    unique (parent_id, slug)
);
create index idx_taxonomy_node_parent on taxonomy_node(parent_id) where deleted_at is null;
create index idx_taxonomy_node_status on taxonomy_node(status) where deleted_at is null;
create index idx_taxonomy_node_slug_trgm on taxonomy_node using gin (slug gin_trgm_ops);

create table taxonomy_alias (
    id bigserial primary key,
    node_id bigint not null references taxonomy_node(id),
    alias text not null,
    slug text not null,
    created_at timestamp not null,
    updated_at timestamp not null,
    deleted_at timestamp,
    unique (node_id, slug)
);
create index idx_taxonomy_alias_node on taxonomy_alias(node_id) where deleted_at is null;
create index idx_taxonomy_alias_slug_trgm on taxonomy_alias using gin (slug gin_trgm_ops);

-- Nạp đầu năm: Toán 10 — đúng 7 chuyên đề (depth 1) + các Bài (depth 2), theo chương trình 2018.
-- status='ACTIVE', proposed_by=null (admin tạo). order_no theo thứ tự chương trình.
do $$
declare
    v_chuyen_de_id bigint;
begin
    -- 1. Mệnh đề và tập hợp
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at)
    values (null, 'TOAN_10', 1, 'Mệnh đề và tập hợp', 'menh-de-va-tap-hop', 1, 'ACTIVE', now(), now())
    returning id into v_chuyen_de_id;
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at) values
        (v_chuyen_de_id, 'TOAN_10', 2, 'Mệnh đề', 'menh-de', 1, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Tập hợp', 'tap-hop', 2, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Các phép toán trên tập hợp', 'cac-phep-toan-tren-tap-hop', 3, 'ACTIVE', now(), now());

    -- 2. Hàm số bậc hai
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at)
    values (null, 'TOAN_10', 1, 'Hàm số bậc hai', 'ham-so-bac-hai', 2, 'ACTIVE', now(), now())
    returning id into v_chuyen_de_id;
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at) values
        (v_chuyen_de_id, 'TOAN_10', 2, 'Hàm số', 'ham-so', 1, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Đồ thị hàm số và ứng dụng', 'do-thi-ham-so-va-ung-dung', 2, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Hàm số bậc hai', 'ham-so-bac-hai-bai', 3, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Đồ thị hàm số bậc hai', 'do-thi-ham-so-bac-hai', 4, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Dấu của tam thức bậc hai', 'dau-cua-tam-thuc-bac-hai', 5, 'ACTIVE', now(), now());

    -- 3. Phương trình và bất phương trình
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at)
    values (null, 'TOAN_10', 1, 'Phương trình và bất phương trình', 'phuong-trinh-va-bat-phuong-trinh', 3, 'ACTIVE', now(), now())
    returning id into v_chuyen_de_id;
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at) values
        (v_chuyen_de_id, 'TOAN_10', 2, 'Bất phương trình bậc nhất hai ẩn', 'bat-phuong-trinh-bac-nhat-hai-an', 1, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Hệ bất phương trình bậc nhất hai ẩn', 'he-bat-phuong-trinh-bac-nhat-hai-an', 2, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Bất phương trình bậc hai một ẩn', 'bat-phuong-trinh-bac-hai-mot-an', 3, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Phương trình quy về phương trình bậc hai', 'phuong-trinh-quy-ve-phuong-trinh-bac-hai', 4, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Hệ phương trình bậc nhất hai ẩn', 'he-phuong-trinh-bac-nhat-hai-an', 5, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Hệ phương trình bậc nhất ba ẩn', 'he-phuong-trinh-bac-nhat-ba-an', 6, 'ACTIVE', now(), now());

    -- 4. Hệ thức lượng trong tam giác
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at)
    values (null, 'TOAN_10', 1, 'Hệ thức lượng trong tam giác', 'he-thuc-luong-trong-tam-giac', 4, 'ACTIVE', now(), now())
    returning id into v_chuyen_de_id;
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at) values
        (v_chuyen_de_id, 'TOAN_10', 2, 'Giá trị lượng giác của một góc từ 0° đến 180°', 'gia-tri-luong-giac-cua-mot-goc', 1, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Định lí côsin', 'dinh-li-cosin', 2, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Định lí sin', 'dinh-li-sin', 3, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Giải tam giác và ứng dụng thực tế', 'giai-tam-giac-va-ung-dung-thuc-te', 4, 'ACTIVE', now(), now());

    -- 5. Vectơ
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at)
    values (null, 'TOAN_10', 1, 'Vectơ', 'vecto', 5, 'ACTIVE', now(), now())
    returning id into v_chuyen_de_id;
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at) values
        (v_chuyen_de_id, 'TOAN_10', 2, 'Khái niệm vectơ', 'khai-niem-vecto', 1, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Tổng và hiệu của hai vectơ', 'tong-va-hieu-cua-hai-vecto', 2, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Tích của một số với một vectơ', 'tich-cua-mot-so-voi-mot-vecto', 3, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Vectơ trong mặt phẳng tọa độ', 'vecto-trong-mat-phang-toa-do', 4, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Tích vô hướng của hai vectơ', 'tich-vo-huong-cua-hai-vecto', 5, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Ứng dụng của vectơ trong vật lí', 'ung-dung-cua-vecto-trong-vat-li', 6, 'ACTIVE', now(), now());

    -- 6. Thống kê
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at)
    values (null, 'TOAN_10', 1, 'Thống kê', 'thong-ke', 6, 'ACTIVE', now(), now())
    returning id into v_chuyen_de_id;
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at) values
        (v_chuyen_de_id, 'TOAN_10', 2, 'Số gần đúng và sai số', 'so-gan-dung-va-sai-so', 1, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Mô tả và biểu diễn dữ liệu trên các bảng, biểu đồ', 'mo-ta-va-bieu-dien-du-lieu', 2, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Các số đặc trưng đo xu thế trung tâm', 'cac-so-dac-trung-do-xu-the-trung-tam', 3, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Các số đặc trưng đo mức độ phân tán', 'cac-so-dac-trung-do-muc-do-phan-tan', 4, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Tần số và tần số tương đối', 'tan-so-va-tan-so-tuong-doi', 5, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Bảng tần số ghép nhóm', 'bang-tan-so-ghep-nhom', 6, 'ACTIVE', now(), now());

    -- 7. Xác suất
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at)
    values (null, 'TOAN_10', 1, 'Xác suất', 'xac-suat', 7, 'ACTIVE', now(), now())
    returning id into v_chuyen_de_id;
    insert into taxonomy_node (parent_id, subject, depth, title, slug, order_no, status, created_at, updated_at) values
        (v_chuyen_de_id, 'TOAN_10', 2, 'Không gian mẫu và biến cố', 'khong-gian-mau-va-bien-co', 1, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Xác suất của biến cố', 'xac-suat-cua-bien-co', 2, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Quy tắc cộng xác suất', 'quy-tac-cong-xac-suat', 3, 'ACTIVE', now(), now()),
        (v_chuyen_de_id, 'TOAN_10', 2, 'Quy tắc nhân xác suất', 'quy-tac-nhan-xac-suat', 4, 'ACTIVE', now(), now());
end $$;
