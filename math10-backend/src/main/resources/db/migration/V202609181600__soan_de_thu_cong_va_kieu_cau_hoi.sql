-- Soạn đề thủ công + bốn kiểu câu hỏi của đề thi.
--
-- Trước lát này, câu hỏi chỉ sinh ra được từ tài liệu tải lên: source_document_id là NOT NULL.
-- Đề thi cần soạn tay được, nên cột đó bỏ ràng buộc và chủ sở hữu chuyển sang owner_teacher_id
-- ngay trên câu — câu soạn tay không có tài liệu nguồn để mượn chủ.

alter table extracted_questions alter column source_document_id drop not null;
alter table extracted_questions add column if not exists owner_teacher_id bigint references users(id);
alter table extracted_questions add column if not exists answer_payload jsonb not null default '{}'::jsonb;
alter table extracted_questions add column if not exists max_score numeric(4,2) not null default 1;

-- Câu cũ vẫn thuộc về chủ tài liệu nguồn.
update extracted_questions q
   set owner_teacher_id = d.owner_teacher_id
  from teacher_source_documents d
 where d.id = q.source_document_id and q.owner_teacher_id is null;

-- Một bộ từ vựng duy nhất cho kiểu câu. Bộ tách tài liệu vốn ghi MULTIPLE_CHOICE/SHORT_ANSWER/
-- FREE_RESPONSE; giữ hai bộ song song thì mỗi chỗ chấm điểm phải nhớ cả hai, nên quy về một.
update extracted_questions set question_type = case question_type
    when 'MULTIPLE_CHOICE' then 'MCQ'
    when 'SHORT_ANSWER'    then 'TRA_LOI_NGAN'
    when 'FREE_RESPONSE'   then 'TU_LUAN'
    else question_type end
 where question_type in ('MULTIPLE_CHOICE','SHORT_ANSWER','FREE_RESPONSE');
update extracted_questions
   set question_type = 'UNKNOWN'
 where question_type not in ('UNKNOWN','MCQ','DUNG_SAI_4Y','TRA_LOI_NGAN','TU_LUAN');

alter table extracted_questions drop constraint if exists ck_extracted_question_type;
alter table extracted_questions add constraint ck_extracted_question_type
  check (question_type in ('UNKNOWN','MCQ','DUNG_SAI_4Y','TRA_LOI_NGAN','TU_LUAN'));

-- Phiên bản đề phải bất biến: kiểu câu và thang điểm cũng phải chụp lại, không chỉ nội dung.
-- Sửa câu gốc sau khi phát hành mà thang điểm đổi theo thì điểm cũ tính lại ra số khác.
alter table worksheet_items add column if not exists question_type_snapshot varchar(30);
alter table worksheet_items add column if not exists answer_payload_snapshot jsonb;
alter table worksheet_items add column if not exists max_score numeric(4,2);

update worksheet_items wi
   set question_type_snapshot = coalesce(wi.question_type_snapshot, q.question_type),
       answer_payload_snapshot = coalesce(wi.answer_payload_snapshot, q.answer_payload),
       max_score = coalesce(wi.max_score, q.max_score)
  from extracted_questions q
 where q.id = wi.source_question_id;

-- Trigger chụp sẵn có nay chụp thêm ba cột trên. Vẫn là BEFORE INSERT, vẫn chỉ đụng tới
-- những giá trị chưa được người gọi đặt tường minh.
create or replace function snapshot_pipeline_question_options() returns trigger language plpgsql as $$
begin
  if new.source_question_id is not null then
    select option_a, option_b, option_c, option_d, question_type, answer_payload, max_score
      into new.option_a_snapshot, new.option_b_snapshot, new.option_c_snapshot, new.option_d_snapshot,
           new.question_type_snapshot, new.answer_payload_snapshot, new.max_score
      from extracted_questions where id = new.source_question_id;
  end if;
  if new.question_type_snapshot is null then new.question_type_snapshot := 'UNKNOWN'; end if;
  if new.answer_payload_snapshot is null then new.answer_payload_snapshot := '{}'::jsonb; end if;
  if new.max_score is null then new.max_score := 1; end if;
  return new;
end $$;

create index if not exists idx_extracted_owner
  on extracted_questions(owner_teacher_id, id desc) where deleted_at is null;
