alter table problems add column if not exists exam_part varchar(80);

insert into metadata_options (category, value, label, sort_order) values
('EXAM_PART', 'DAI_SO_CO_BAN', 'Dai so co ban', 10),
('EXAM_PART', 'HINH_HOC', 'Hinh hoc', 20),
('EXAM_PART', 'BAI_TOAN_THUC_TE', 'Bai toan thuc te', 30),
('EXAM_PART', 'CAU_KHO', 'Cau kho phan loai', 40)
on conflict (category, value) do update
set label = excluded.label,
    sort_order = excluded.sort_order,
    active = true,
    updated_at = now();

insert into topics (name, description, created_at, updated_at)
select value, description, now(), now()
from (values
    ('Dai so 9', 'Rut gon bieu thuc, phuong trinh, he phuong trinh va bat phuong trinh trong de tuyen sinh vao 10'),
    ('Hinh hoc 9', 'Duong tron, tu giac noi tiep, tiep tuyen, dong dang va he thuc luong'),
    ('Bai toan thuc te', 'Chuyen dong, nang suat, cong viec, voi nuoc va bai toan lap phuong trinh'),
    ('Cau kho phan loai', 'GTLN/GTNN, bat dang thuc va cac bai hinh hoc phan loai')
) as seed(value, description)
where not exists (
    select 1 from topics t where t.name = seed.value and t.deleted_at is null
);

insert into problem_types (topic_id, name, recognition_signs, general_method, solution_outline, common_mistakes, created_at, updated_at)
select topic.id, seed.name, seed.recognition_signs, seed.general_method, seed.solution_outline, seed.common_mistakes, now(), now()
from (values
    ('Dai so 9', 'Rut gon bieu thuc chua can', 'Co can bac hai, dieu kien xac dinh, phan thuc', 'Dat dieu kien, quy dong, rut gon tung nhom', 'Tim dieu kien; bien doi can; rut gon; thay gia tri neu co', 'Bo quen dieu kien; binh phuong sai; rut gon thieu mau'),
    ('Dai so 9', 'Giai phuong trinh quy ve bac hai', 'Phuong trinh co an x, co the dua ve ax^2+bx+c=0', 'Bien doi ve dang chuan roi dung cong thuc nghiem hoac phan tich nhan tu', 'Chuyen ve mot ve; rut gon; giai; doi chieu dieu kien', 'Khong thu lai nghiem; sai dau khi chuyen ve'),
    ('Dai so 9', 'Giai he phuong trinh', 'Hai phuong trinh bac nhat hai an hoac he quy ve bac nhat', 'Dung the, cong dai so hoac dat an phu', 'Rut mot an; thay vao phuong trinh con lai; ket luan nghiem', 'Nhan he so sai; ket luan thieu cap nghiem'),
    ('Hinh hoc 9', 'Tu giac noi tiep', 'Can chung minh bon diem cung nam tren mot duong tron', 'Chung minh tong hai goc doi 180 do hoac hai goc cung nhin mot doan', 'Chon cap goc; lap luan bang goc; ket luan noi tiep', 'Chon sai cap goc; dung tinh chat khi chua chung minh noi tiep'),
    ('Hinh hoc 9', 'Tiep tuyen va duong tron', 'Co duong tron, tiep tuyen, ban kinh vuong goc', 'Dung tinh chat tiep tuyen, goc tao boi tiep tuyen va day cung', 'Xac dinh tiep diem; dung vuong goc; suy ra goc/canh can chung minh', 'Nhan nham tiep tuyen; bo qua dieu kien vuong goc'),
    ('Hinh hoc 9', 'Tam giac dong dang', 'Can chung minh ti so do dai hoac he thuc tich', 'Tim hai goc bang nhau hoac cap canh ti le', 'Chung minh dong dang; viet ti so tuong ung; bien doi ve ket qua', 'Ghi sai thu tu dinh; suy ti so nguoc'),
    ('Bai toan thuc te', 'Chuyen dong deu', 'Co quang duong, van toc, thoi gian', 'Lap bang s-v-t va dung cong thuc s=vt', 'Chon an; lap dieu kien; bieu dien dai luong; lap phuong trinh; giai va ket luan', 'Sai don vi; quen dieu kien duong'),
    ('Bai toan thuc te', 'Lam chung cong viec', 'Hai doi/nguoi cung lam, nang suat theo thoi gian', 'Quy ve phan cong viec lam trong mot don vi thoi gian', 'Chon an la thoi gian/nang suat; lap phuong trinh tong nang suat; giai', 'Cong thoi gian thay vi cong nang suat'),
    ('Bai toan thuc te', 'Voi nuoc chay', 'Be nuoc, voi chay vao/chay ra', 'Dung nang suat voi trong mot gio va quan he tong hieu', 'Lap nang suat tung voi; lap phuong trinh; giai va doi chieu', 'Nhan sai dau chay ra; sai don vi'),
    ('Cau kho phan loai', 'GTLN GTNN', 'Tim gia tri lon nhat nho nhat cua bieu thuc', 'Bien doi thanh binh phuong, dung dieu kien dau bang', 'Dat dieu kien; bien doi; chi ra can duoi/can tren; xet dau bang', 'Chi tim gia tri ma khong chung minh dat duoc'),
    ('Cau kho phan loai', 'Bat dang thuc', 'Chung minh bieu thuc >=, <=', 'Dung bien doi tuong duong, AM-GM hoac binh phuong khong am', 'Xac dinh mien; bien doi ve tong cac so khong am; ket luan', 'Chia cho bieu thuc chua biet dau; thieu dieu kien'),
    ('Cau kho phan loai', 'Hinh hoc phan loai', 'Bai hinh co nhieu y, tiep tuyen, noi tiep, dong quy', 'Ket hop noi tiep, dong dang, goc va ti so', 'Ve hinh phu; chung minh cac menh de trung gian; ket noi ve ket qua', 'Bo qua cau truoc; suy luan goc khong co can cu')
) as seed(topic_name, name, recognition_signs, general_method, solution_outline, common_mistakes)
join topics topic on topic.name = seed.topic_name and topic.deleted_at is null
where not exists (
    select 1 from problem_types pt
    where pt.topic_id = topic.id and pt.name = seed.name and pt.deleted_at is null
);
