update metadata_options
set label = case value
    when 'DAI_SO_CO_BAN' then 'Đại số và hàm số'
    when 'HINH_HOC' then 'Hình học vectơ - tọa độ'
    when 'BAI_TOAN_THUC_TE' then 'Bài toán thực tế'
    when 'CAU_KHO' then 'Câu vận dụng cao'
    else label
end,
updated_at = now()
where category = 'EXAM_PART';

update topics
set name = 'Mệnh đề và tập hợp',
    description = 'Mệnh đề, phủ định mệnh đề, tập hợp, các phép toán trên tập hợp và khoảng số',
    updated_at = now()
where name = 'Dai so 9' and deleted_at is null;

update topics
set name = 'Hàm số bậc hai',
    description = 'Hàm số, đồ thị parabol, bảng biến thiên, phương trình và bất phương trình bậc hai',
    updated_at = now()
where name = 'Hinh hoc 9' and deleted_at is null;

update topics
set name = 'Vectơ và tọa độ',
    description = 'Vectơ, tổng hiệu vectơ, tích vô hướng, tọa độ trong mặt phẳng và ứng dụng hình học',
    updated_at = now()
where name = 'Bai toan thuc te' and deleted_at is null;

update topics
set name = 'Lượng giác và vận dụng cao',
    description = 'Giá trị lượng giác, hệ thức lượng giác, bài toán tổng hợp và vận dụng cao Toán 10',
    updated_at = now()
where name = 'Cau kho phan loai' and deleted_at is null;

insert into topics (name, description, created_at, updated_at)
select seed.name, seed.description, now(), now()
from (values
    ('Mệnh đề và tập hợp', 'Mệnh đề, phủ định mệnh đề, tập hợp, các phép toán trên tập hợp và khoảng số'),
    ('Hàm số bậc hai', 'Hàm số, đồ thị parabol, bảng biến thiên, phương trình và bất phương trình bậc hai'),
    ('Vectơ và tọa độ', 'Vectơ, tổng hiệu vectơ, tích vô hướng, tọa độ trong mặt phẳng và ứng dụng hình học'),
    ('Lượng giác và vận dụng cao', 'Giá trị lượng giác, hệ thức lượng giác, bài toán tổng hợp và vận dụng cao Toán 10')
) as seed(name, description)
where not exists (
    select 1 from topics topic where topic.name = seed.name and topic.deleted_at is null
);

update problem_types
set name = 'Xét tính đúng sai của mệnh đề',
    recognition_signs = 'Có mệnh đề chứa ký hiệu với mọi, tồn tại hoặc yêu cầu lập phủ định',
    general_method = 'Xác định điều kiện đúng sai, viết phủ định đúng lượng từ và kết luận theo tập xác định',
    solution_outline = 'Đọc mệnh đề; xác định lượng từ; xét phản ví dụ nếu cần; viết phủ định; kết luận',
    common_mistakes = 'Phủ định sai lượng từ; nhầm kéo theo với tương đương; bỏ qua tập xác định',
    updated_at = now()
where name = 'Rut gon bieu thuc chua can' and deleted_at is null;

update problem_types
set name = 'Tập hợp và khoảng số',
    recognition_signs = 'Có hợp, giao, hiệu, phần bù hoặc biểu diễn nghiệm trên trục số',
    general_method = 'Đổi điều kiện về khoảng/tập, biểu diễn trên trục số rồi lấy phép toán tập hợp',
    solution_outline = 'Xác định từng tập; biểu diễn; thực hiện phép toán; viết kết quả dạng khoảng',
    common_mistakes = 'Sai dấu ngoặc tròn/vuông; nhầm hợp với giao; quên điều kiện biên',
    updated_at = now()
where name = 'Giai phuong trinh quy ve bac hai' and deleted_at is null;

update problem_types
set name = 'Đồ thị hàm số bậc hai',
    recognition_signs = 'Có hàm y = ax^2 + bx + c, yêu cầu đỉnh, trục đối xứng, bảng biến thiên hoặc đồ thị',
    general_method = 'Tìm đỉnh, trục đối xứng, chiều biến thiên và các điểm đặc biệt của parabol',
    solution_outline = 'Xác định a,b,c; tính đỉnh; lập bảng biến thiên; tìm giao trục; vẽ/kết luận',
    common_mistakes = 'Sai hoành độ đỉnh; nhầm chiều mở parabol; thiếu giao điểm với trục',
    updated_at = now()
where name = 'Giai he phuong trinh' and deleted_at is null;

update problem_types
set name = 'Phương trình và bất phương trình bậc hai',
    recognition_signs = 'Có tam thức bậc hai, dấu của tam thức, nghiệm hoặc khoảng nghiệm',
    general_method = 'Tính delta, xét dấu theo hệ số a và vị trí nghiệm',
    solution_outline = 'Đưa về dạng chuẩn; tính delta; tìm nghiệm; lập bảng xét dấu; kết luận',
    common_mistakes = 'Đổi chiều bất phương trình sai; quên trường hợp vô nghiệm; xét dấu ngược',
    updated_at = now()
where name = 'Tu giac noi tiep' and deleted_at is null;

update problem_types
set name = 'Phép toán vectơ',
    recognition_signs = 'Có tổng, hiệu, trung điểm, trọng tâm hoặc biểu diễn vectơ theo hai vectơ không cùng phương',
    general_method = 'Dùng quy tắc hình bình hành, quy tắc ba điểm và các hệ thức trung điểm/trọng tâm',
    solution_outline = 'Chọn vectơ cơ sở; biến đổi theo quy tắc; rút gọn hệ thức; kết luận',
    common_mistakes = 'Nhầm chiều vectơ; cộng độ dài thay vì cộng vectơ; thiếu điều kiện không cùng phương',
    updated_at = now()
where name = 'Tiep tuyen va duong tron' and deleted_at is null;

update problem_types
set name = 'Tọa độ và tích vô hướng',
    recognition_signs = 'Có tọa độ điểm/vectơ, độ dài, góc, vuông góc hoặc tích vô hướng',
    general_method = 'Chuyển dữ kiện hình học sang tọa độ, dùng công thức độ dài và tích vô hướng',
    solution_outline = 'Tính vectơ tọa độ; tính độ dài/tích vô hướng; suy ra góc hoặc quan hệ vuông góc',
    common_mistakes = 'Sai công thức tích vô hướng; nhầm tọa độ vectơ với tọa độ điểm; làm tròn sớm',
    updated_at = now()
where name = 'Tam giac dong dang' and deleted_at is null;

update problem_types
set name = 'Giá trị lượng giác của góc',
    recognition_signs = 'Có sin, cos, tan, cot của góc từ 0 đến 180 độ hoặc hệ thức lượng giác cơ bản',
    general_method = 'Dùng đường tròn lượng giác, bảng giá trị đặc biệt và hệ thức sin^2 x + cos^2 x = 1',
    solution_outline = 'Xác định góc; chọn hệ thức phù hợp; thay giá trị; rút gọn và kết luận',
    common_mistakes = 'Sai dấu theo góc tù; nhầm tan với cot; quên điều kiện mẫu khác 0',
    updated_at = now()
where name = 'Chuyen dong deu' and deleted_at is null;

update problem_types
set name = 'Ứng dụng hàm số bậc hai trong thực tế',
    recognition_signs = 'Có bài toán tối ưu, chuyển động, diện tích hoặc doanh thu mô hình bằng parabol',
    general_method = 'Lập hàm bậc hai theo biến, tìm đỉnh hoặc giá trị lớn nhất/nhỏ nhất trên miền xét',
    solution_outline = 'Chọn biến; lập biểu thức; xác định miền; tìm đỉnh/biên; kết luận theo ngữ cảnh',
    common_mistakes = 'Quên miền thực tế; lấy đỉnh ngoài miền; kết luận thiếu đơn vị',
    updated_at = now()
where name = 'Lam chung cong viec' and deleted_at is null;

update problem_types
set name = 'Bài toán tọa độ thực tế',
    recognition_signs = 'Có bản đồ, vị trí điểm, khoảng cách, trung điểm hoặc quỹ đạo trong mặt phẳng tọa độ',
    general_method = 'Mã hóa dữ kiện bằng tọa độ rồi dùng công thức khoảng cách, trung điểm và vectơ',
    solution_outline = 'Đặt hệ trục; xác định tọa độ; tính đại lượng cần tìm; diễn giải lại bài toán',
    common_mistakes = 'Chọn hệ trục khó; sai tỉ lệ; nhầm khoảng cách tọa độ với độ dài thực',
    updated_at = now()
where name = 'Voi nuoc chay' and deleted_at is null;

update problem_types
set name = 'Bất đẳng thức và cực trị Toán 10',
    recognition_signs = 'Có yêu cầu tìm giá trị lớn nhất, nhỏ nhất hoặc chứng minh bất đẳng thức với biểu thức đại số',
    general_method = 'Dùng bình phương không âm, xét dấu tam thức bậc hai hoặc biến đổi tương đương',
    solution_outline = 'Xác định điều kiện; biến đổi về dạng không âm; tìm dấu bằng; kết luận cực trị',
    common_mistakes = 'Thiếu điều kiện dấu bằng; chia cho biểu thức chưa biết dấu; chỉ thử số mà không chứng minh',
    updated_at = now()
where name = 'GTLN GTNN' and deleted_at is null;

update problem_types
set name = 'Bài toán tổng hợp mệnh đề - tập hợp',
    recognition_signs = 'Kết hợp mệnh đề, tập hợp, điều kiện nghiệm và suy luận logic',
    general_method = 'Tách từng điều kiện, biểu diễn bằng tập hợp rồi dùng suy luận logic để kết luận',
    solution_outline = 'Phân tích mệnh đề; đổi về tập điều kiện; thực hiện phép toán tập; kết luận',
    common_mistakes = 'Nhầm điều kiện cần với đủ; sai phủ định; bỏ sót trường hợp biên',
    updated_at = now()
where name = 'Bat dang thuc' and deleted_at is null;

update problem_types
set name = 'Hình học tọa độ vận dụng cao',
    recognition_signs = 'Bài hình có tọa độ/vectơ nhiều bước, yêu cầu chứng minh thẳng hàng, vuông góc hoặc tối ưu',
    general_method = 'Kết hợp vectơ, tọa độ, tích vô hướng và biến đổi đại số',
    solution_outline = 'Chọn hệ tọa độ; biểu diễn các điểm/vectơ; dùng tích vô hướng hoặc định thức; kết luận',
    common_mistakes = 'Tính toán rời rạc không kiểm soát điều kiện; chọn hệ trục làm bài phức tạp; thiếu kết luận hình học',
    updated_at = now()
where name = 'Hinh hoc phan loai' and deleted_at is null;
