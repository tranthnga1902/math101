-- #34: backfill tương thích; dữ liệu legacy vẫn được giữ để dual-read/đối soát.

insert into teacher_resources(owner_teacher_id,lesson_id,resource_type,title,external_url,moderation_status,status,created_at,updated_at)
select d.owner_id,d.lesson_id,
       case when d.doc_type='VIDEO' then 'VIDEO' else 'DOCUMENT' end,
       d.title,case when d.doc_type='VIDEO' then d.file_url else null end,
       'APPROVED',case when d.status='ARCHIVED' then 'ARCHIVED' else 'ACTIVE' end,d.created_at,d.updated_at
from documents d
where d.owner_id is not null and d.deleted_at is null
  and not exists(select 1 from teacher_resources tr where tr.owner_teacher_id=d.owner_id and tr.title=d.title and tr.created_at=d.created_at);

-- Tài liệu hệ thống đã gắn bài học trở thành luồng chuẩn; file không bị duplicate.
insert into program_resources(lesson_id,resource_type,resource_ref_id,title,order_index,status,created_at,updated_at)
select ld.lesson_id,'DOCUMENT',ld.document_id,d.title,
       row_number() over(partition by ld.lesson_id order by ld.display_order,ld.id)
       + coalesce((select max(pr.order_index) from program_resources pr where pr.lesson_id=ld.lesson_id and pr.deleted_at is null),0),
       'PUBLISHED',ld.created_at,ld.updated_at
from lesson_documents ld join documents d on d.id=ld.document_id and d.owner_id is null and d.deleted_at is null
where ld.deleted_at is null
  and not exists(select 1 from program_resources pr where pr.lesson_id=ld.lesson_id and pr.resource_type='DOCUMENT' and pr.resource_ref_id=ld.document_id and pr.deleted_at is null);

-- Một dòng progress legacy đã nộp trở thành một submission lịch sử; từ đây lượt mới ghi bảng mới.
insert into submissions(assignment_id,student_id,attempt_no,status,submitted_at,raw_score,final_score,created_at,updated_at)
select ap.assignment_id,ap.student_id,greatest(coalesce(ap.attempt_no,1),1),
       case when ap.returned_at is not null then 'RETURNED' when ap.graded_at is not null then 'GRADED' else 'SUBMITTED' end,
       ap.submitted_at,ap.raw_score,ap.score,ap.created_at,ap.updated_at
from assignment_progress ap
where ap.deleted_at is null and ap.submitted_at is not null
  and not exists(select 1 from submissions s where s.assignment_id=ap.assignment_id and s.student_id=ap.student_id and s.attempt_no=greatest(coalesce(ap.attempt_no,1),1) and s.deleted_at is null);

insert into submission_events(submission_id,actor_id,action,metadata,created_at,updated_at)
select s.id,s.student_id,'MIGRATED',jsonb_build_object('source','assignment_progress'),s.created_at,s.updated_at
from submissions s
where not exists(select 1 from submission_events e where e.submission_id=s.id and e.action='MIGRATED' and e.deleted_at is null);
