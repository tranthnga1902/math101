-- Nơi đến của một dòng phân phối: từ "một bài" thành bảy chỗ.
--
-- Lát trước tách được ĐỐI TƯỢNG (ai đọc được) ra khỏi TRẠNG THÁI (đã sẵn sàng chưa). Lát này tách
-- nốt trục thứ ba: NƠI ĐẾN (đi tới đâu). Ba trục, ba câu hỏi rời nhau, và trộn hai cái bất kỳ vào
-- một cột là công thức đã sinh ra lỗ hổng lần trước.
--
-- Kế hoạch liệt kê bảy nơi đến: toàn hệ thống / một mạch / một bài / một tiết / một lớp / một bài
-- trong lớp / một nút chuyên đề. Bảy, nhưng KHÔNG phải bảy giá trị của một cột — vì "một bài" và
-- "một bài trong lớp" là cùng một nơi đến nhìn qua hai độ rộng khác nhau, "toàn hệ thống" và "một
-- lớp" cũng vậy. Viết thành bảy nhánh thì mỗi lần thêm một loại neo phải nhân đôi số nhánh, và
-- nhánh "trong lớp" của loại mới sẽ là nhánh bị quên.
--
-- Nên hai trục:
--
--   noi_den_loai + neo   HE_THONG(rỗng) / MACH / BAI / TIET / CHUYEN_DE   -- neo vào nội dung nào
--   lop_id               rỗng = mọi lớp, có = đúng lớp ấy                 -- hẹp lại tới lớp nào
--
--   toàn hệ thống       = HE_THONG              + lop rỗng
--   một mạch            = MACH   + strand       + lop rỗng
--   một bài             = BAI    + lesson       + lop rỗng
--   một tiết            = TIET   + period       + lop rỗng
--   một nút chuyên đề   = CHUYEN_DE + node      + lop rỗng
--   một lớp             = HE_THONG              + lop = X
--   một bài trong lớp   = BAI    + lesson       + lop = X
--
-- Năm loại nhân hai độ rộng ra đúng bảy chỗ kế hoạch gọi tên, và "trong lớp" là một cột chứ không
-- phải một họ nhánh song song.

-- Neo của các loại KHÔNG phải bài. Bài vẫn neo bằng lesson_id sẵn có, không chép sang cột mới:
-- một sự thật ở hai cột là Đ4, và Đ4 ở đây nghĩa là hai câu trả lời lệch nhau cho "dòng này gắn vào
-- bài nào" — chính xác cái đã làm lỗ trước sống lâu. Ràng buộc ở dưới canh việc đó bằng CSDL chứ
-- không bằng lời hứa của tầng Java.
alter table program_resources add column if not exists noi_den_loai varchar(20) not null default 'BAI';
alter table program_resources add column if not exists neo bigint;
alter table program_resources add column if not exists lop_id bigint references classes(id);

-- "Ai gắn" — kế hoạch đòi, và bảng chưa từng có. Cho phép rỗng vì mọi dòng đang có đều không biết
-- ai gắn, và đoán một cái tên vào đó là bịa dữ liệu (Đ3).
alter table program_resources add column if not exists created_by bigint references users(id);

-- lesson_id thôi bắt buộc: dòng toàn hệ thống, dòng của mạch, dòng của lớp đều không có bài nào.
-- Cột ở lại nguyên chỗ, chỉ nới ràng buộc — không migration nào xoá cột.
alter table program_resources alter column lesson_id drop not null;

alter table program_resources add constraint ck_program_resources_noi_den_loai
    check (noi_den_loai in ('HE_THONG','MACH','BAI','TIET','CHUYEN_DE'));

-- Mỗi loại nói đúng một chỗ neo, và các chỗ còn lại phải rỗng. Không có ràng buộc này thì một dòng
-- BAI mang thêm neo trỏ vào mạch là hợp lệ, và câu đọc nào tin vào neo sẽ phát nó ra ở chỗ thứ hai
-- mà không ai biết.
alter table program_resources add constraint ck_program_resources_neo
    check (case noi_den_loai
             when 'BAI'      then lesson_id is not null and neo is null
             when 'HE_THONG' then lesson_id is null     and neo is null
             else                 lesson_id is null     and neo is not null
           end);

-- Dòng đang có đều là dòng gắn vào bài — mặc định của cột mới đã nói đúng điều đó, nên không có
-- lượt update nào ở đây. Ghi ra để lần sau đọc migration này không tưởng là thiếu bước trám.

create index if not exists idx_program_resources_neo
    on program_resources(noi_den_loai, neo) where deleted_at is null;
create index if not exists idx_program_resources_lop
    on program_resources(lop_id, order_index) where deleted_at is null and lop_id is not null;

-- Hai chỉ mục duy nhất cũ đều canh trên lesson_id, và cả hai đều hỏng theo đúng hai hướng ngược nhau
-- khi nơi đến rộng ra. Thay từng cái một, ngay tại đây, chứ không để lại "tạm thời": một chỉ mục sai
-- còn sống thì nó vẫn từ chối, và câu từ chối của nó nói về một mô hình không còn nữa.

-- (1) Chỗ đứng. Cũ: (lesson_id, order_index).
--
--   quá lỏng — dòng toàn hệ thống, dòng của mạch, dòng của tiết đều để lesson_id rỗng, mà NULL trong
--     chỉ mục duy nhất của Postgres không đụng nhau, nên mọi dòng ấy đều "khác nhau" và thứ tự lại
--     trùng được;
--   quá chặt — nó không biết tới lớp, nên hai lớp cùng giữ vị trí 1 trên cùng một bài là đụng nhau,
--     dù đó là hai danh sách của hai lớp khác nhau.
--
-- coalesce(-1) chính là để bịt vế "quá lỏng": NULL phải đụng nhau ở đây.
drop index if exists uq_program_resources_order;
create unique index if not exists uq_program_resources_cho_dung
    on program_resources(noi_den_loai, coalesce(neo, -1), coalesce(lesson_id, -1), coalesce(lop_id, -1), order_index)
 where deleted_at is null;

-- (2) Một nguồn gắn một lần vào một chỗ. Cũ: (lesson_id, resource_type, resource_ref_id). Cùng hai
-- hướng hỏng như trên, và vế "quá chặt" ở đây là chỗ đau nhất:
--
--   quá lỏng — cùng một tài liệu phát toàn trường bao nhiêu lần cũng lọt, mỗi lần một dòng trùng lặp
--     trên màn hình mọi bài;
--   quá chặt — cùng một đề gắn vào cùng một bài cho hai lớp bị chặn. Đó đúng là nhánh D của kế hoạch:
--     giáo viên phát cho lớp mình. Không sửa thì nơi đến "một bài trong lớp" chỉ dùng được cho đúng
--     một lớp đầu tiên, và cách người ta sẽ tự chữa là nhân bản tệp thành hai tài liệu — rồi sửa đề
--     một chỗ, quên chỗ kia.
--
-- Nên khóa lại theo đúng bộ định danh của một chỗ đến, cùng bộ mà uq_program_resources_cho_dung dùng.
-- Bỏ một chỉ mục sai không phải là bỏ một cột: dữ liệu ở nguyên chỗ, chỉ có luật canh là đổi.
drop index if exists uq_program_resources_ref;
create unique index if not exists uq_program_resources_ref
    on program_resources(noi_den_loai, coalesce(neo, -1), coalesce(lesson_id, -1), coalesce(lop_id, -1),
                         resource_type, resource_ref_id)
 where deleted_at is null;

-- Nhánh B của kế hoạch — tài liệu nhà trường gửi riêng cho giáo viên — xuất hiện ngay từ dữ liệu
-- đang có: tài liệu đánh dấu chỉ-giáo-viên mà chưa gắn vào đâu cả. Trước lát này chúng vô hình,
-- không đường nào đọc tới; giờ chúng là phân phối toàn hệ thống, đối tượng giáo viên.
--
-- Không đụng tài liệu STUDENT_ALLOWED chưa gắn: phát toàn hệ thống cho học sinh là một quyết định
-- về nội dung, không phải một phép suy ra từ việc "chưa ai gắn nó vào đâu".
insert into program_resources
    (lesson_id, resource_type, resource_ref_id, title, order_index, status, audience,
     noi_den_loai, neo, lop_id, created_at, updated_at)
select null, 'DOCUMENT', d.id, d.title,
       row_number() over (order by d.id) - 1,
       'PUBLISHED', 'TEACHER_ONLY', 'HE_THONG', null, null, now(), now()
  from documents d
 where d.deleted_at is null
   and d.audience = 'TEACHER_ONLY'
   and d.status = 'PUBLISHED'
   and not exists (select 1 from program_resources pr
                    where pr.resource_type = 'DOCUMENT' and pr.resource_ref_id = d.id
                      and pr.deleted_at is null);
