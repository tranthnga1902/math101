-- Mỗi dòng trong luồng nội dung phải trả lời hai câu hỏi rời nhau: đi tới bài nào, và ai đọc được.
-- Bảng này trước giờ chỉ trả lời được câu đầu, nên câu sau đi hỏi nhờ trạng thái của thứ được trỏ
-- tới — mà trạng thái thì nói "đã xuất bản chưa", không nói "cho ai". Kết quả là một tài liệu đánh
-- dấu chỉ-giáo-viên và đã xuất bản, gắn vào bài, ra thẳng tới mọi học sinh đã đăng nhập.
--
-- Đặt cột ở đây chứ không đọc ké documents.audience vì hai lẽ. Một: ba loại tài nguyên còn lại
-- (video, phiếu, chuyên đề) không có khái niệm đối tượng nào để đọc ké. Hai: cùng một tệp cần gắn
-- được hai chỗ với hai đối tượng khác nhau — bản tóm tắt là học liệu ở bài thường nhưng là tài liệu
-- của giáo viên ở tiết kiểm tra — mà không phải nhân bản tệp ra làm hai.
alter table program_resources add column if not exists audience varchar(20) not null default 'STUDENT_ALLOWED';
alter table program_resources add constraint ck_program_resources_audience
    check (audience in ('STUDENT_ALLOWED','TEACHER_ONLY'));

-- Trám dữ liệu đang có: dòng nào trỏ vào tài liệu chỉ-giáo-viên thì chính nó cũng vậy. Đây là chỗ
-- bịt lỗ cho dữ liệu cũ, nên nó phải chạy trước khi đường đọc mới bắt đầu tin vào cột này.
--
-- Không lọc deleted_at và không đụng updated_at, cả hai đều có lý do. Không lọc: một dòng đã xoá
-- mềm mà để sai đối tượng là một quả mìn chờ ngày ai đó viết đường khôi phục. Không đụng: điền một
-- cột mới không phải là sửa nội dung của dòng, mà dập lại dấu thời gian thì xoá mất câu trả lời cho
-- "dòng này thật sự sửa lần cuối lúc nào" — câu duy nhất mà cột ấy sinh ra để trả lời.
update program_resources pr set audience = 'TEACHER_ONLY'
  from documents d
 where pr.resource_type = 'DOCUMENT' and d.id = pr.resource_ref_id and d.audience = 'TEACHER_ONLY';
