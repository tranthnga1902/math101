-- Gộp ống thứ hai vào luồng nội dung.
--
-- Hệ đang có hai đường song song trả lời cùng một câu hỏi "bài này có học liệu gì". Đường cũ,
-- lesson_resources, chứa nội dung ngay trong dòng: tiêu đề, đường dẫn ngoài, tệp đính kèm, đoạn
-- văn bản. Đường mới, program_resources, chỉ là dòng trỏ — nội dung nằm ở documents/videos — và
-- chính vì thế nó mới hỏi được trạng thái lẫn đối tượng của thứ được trỏ tới. Bảng cũ không có cột
-- nào trong hai cột ấy, nên mọi dòng của nó ra thẳng tới học sinh, không qua luật nào.
--
-- Nên chuyển là chuyển một chiều: nội dung trong dòng tách ra thành một mục trong kho, rồi dòng cũ
-- trở thành dòng trỏ. Không có đường ngược lại, vì đường ngược lại là bỏ mất hai cột.

-- Dấu vết nguồn. Không phải để test chạy lại được, mà vì lượt chuyển này sinh dữ liệu mới từ dữ
-- liệu cũ: hỏng giữa chừng, hoặc chạy hai lần, là kho đầy bản sao câm mà không truy được cái nào
-- từ đâu ra. Có cột này thì lượt chạy sau bỏ qua đúng phần đã xong, và người dọn về sau còn hỏi
-- được "mục này từ đâu tới".
alter table documents add column if not exists legacy_lesson_resource_id bigint references lesson_resources(id);
alter table videos    add column if not exists legacy_lesson_resource_id bigint references lesson_resources(id);
create unique index if not exists uq_documents_legacy_lesson_resource on documents(legacy_lesson_resource_id) where legacy_lesson_resource_id is not null;
create unique index if not exists uq_videos_legacy_lesson_resource    on videos(legacy_lesson_resource_id)    where legacy_lesson_resource_id is not null;

-- Mối nối tệp. Cổng tải tệp hỏi "học sinh này có được mở tệp kia không" bằng cách lần từ
-- file_assets qua lesson_resources lên tới lớp — và lesson_resources là bảng DUY NHẤT nối một tệp
-- với một bài. Bỏ ống cũ mà không mang cột này theo thì tệp gắn qua đường mới rơi vào một trong hai
-- kết cục, cùng tệ như nhau: hoặc học sinh bấm vào không tải được, hoặc nó được phát bằng đường dẫn
-- trần và chẳng qua cửa nào cả.
--
-- Đây chưa phải tầng tệp riêng mà kế hoạch muốn (có đếm tham chiếu, có băm nội dung) — đó là lát
-- khác. Đây chỉ là đúng một cột để mối nối không đứt giữa lúc đổi ống.
alter table documents add column if not exists file_asset_id bigint references file_assets(id);

-- Video đi về kho video vì nó không có tệp, chỉ có đường dẫn ngoài — ràng buộc của kho video cũng
-- nói đúng như vậy. program_id là cột bắt buộc nên phải lần ngược bài → chương → chương trình.
insert into videos(title,video_url,program_id,chapter_id,lesson_id,content_group,status,legacy_lesson_resource_id,created_at,updated_at)
select lr.title,nullif(lr.external_url,''),ch.course_id,l.chapter_id,lr.lesson_id,'THEORY','PUBLISHED',lr.id,lr.created_at,lr.updated_at
from lesson_resources lr
join lessons l  on l.id=lr.lesson_id
join chapters ch on ch.id=l.chapter_id
where lr.deleted_at is null and lr.type='VIDEO'
  and not exists(select 1 from videos v where v.legacy_lesson_resource_id=lr.id);

-- Năm loại còn lại về kho tài liệu. file_url là cột không rỗng nên phải có thứ gì đó: tệp đã tải
-- lên thì lấy đường dẫn của tệp, không thì lấy đường dẫn ngoài, không nữa thì chuỗi rỗng — dòng
-- kiểu TEXT vốn không có tệp nào, nội dung của nó nằm ở content_markdown.
--
-- doc_type để 'KHBD' cho cả năm loại: kho tài liệu chỉ có năm giá trị (SGK, SBT, KHBD, VIDEO,
-- DE_THI) và không giá trị nào ứng với "học liệu rời của một bài". Đoán bừa một loại cho mỗi dòng
-- là tự bịa dữ liệu; để chung một loại thì sai rõ ràng và sửa được bằng một câu update sau này.
insert into documents(title,doc_type,audience,file_url,file_asset_id,content_markdown,status,content_group,program_id,lesson_id,legacy_lesson_resource_id,created_at,updated_at)
select lr.title,'KHBD','STUDENT_ALLOWED',
       coalesce(fa.file_url,nullif(lr.external_url,''),''),
       lr.file_asset_id,
       nullif(lr.text_content,''),
       'PUBLISHED','REFERENCE',ch.course_id,lr.lesson_id,lr.id,lr.created_at,lr.updated_at
from lesson_resources lr
join lessons l   on l.id=lr.lesson_id
join chapters ch on ch.id=l.chapter_id
left join file_assets fa on fa.id=lr.file_asset_id and fa.deleted_at is null
where lr.deleted_at is null and lr.type<>'VIDEO'
  and not exists(select 1 from documents d where d.legacy_lesson_resource_id=lr.id);

-- Dòng trỏ. Thứ tự cũ giữ nguyên và xếp tiếp sau những gì bài ấy đã có, vì chỉ mục duy nhất
-- (lesson_id, order_index) không cho hai mục trùng chỗ.
--
-- audience và status đều mở, và đó là chủ ý chứ không phải bỏ qua: bảng cũ không có hai cột ấy nên
-- mọi dòng của nó học sinh đang đọc được rồi. Ghi TEACHER_ONLY ở đây là lặng lẽ giấu đi thứ hôm
-- qua các em còn mở — một lượt chuyển dữ liệu không được phép đổi thứ người ta thấy. Nếu trong đó
-- có đáp án thì nó đã lọt từ trước lát này, và tìm ra chúng là việc của báo cáo phủ sóng, có luật
-- riêng và test riêng, chứ không đoán chữ trong tên tệp ở giữa một câu insert.
insert into program_resources(lesson_id,resource_type,resource_ref_id,title,order_index,status,audience,created_at,updated_at)
select lr.lesson_id,
       case when lr.type='VIDEO' then 'VIDEO' else 'DOCUMENT' end,
       coalesce(v.id,d.id),
       lr.title,
       row_number() over(partition by lr.lesson_id order by lr.order_index,lr.id)
         + coalesce((select max(pr.order_index) from program_resources pr
                      where pr.lesson_id=lr.lesson_id and pr.deleted_at is null),0),
       'PUBLISHED','STUDENT_ALLOWED',lr.created_at,lr.updated_at
from lesson_resources lr
left join videos    v on v.legacy_lesson_resource_id=lr.id and v.deleted_at is null
left join documents d on d.legacy_lesson_resource_id=lr.id and d.deleted_at is null
where lr.deleted_at is null and coalesce(v.id,d.id) is not null
  and not exists(select 1 from program_resources pr
                  where pr.lesson_id=lr.lesson_id
                    and pr.resource_type=case when lr.type='VIDEO' then 'VIDEO' else 'DOCUMENT' end
                    and pr.resource_ref_id=coalesce(v.id,d.id) and pr.deleted_at is null);
