-- Keep lesson attachments in the shared program/class/course resource stream.
-- Track only rows created by this bridge; independent distributions retain their lifecycle.
alter table program_resources add column lesson_attachment boolean not null default false;
create index idx_lesson_documents_document_lesson on lesson_documents(document_id,lesson_id);

create function sync_lesson_attachment(p_lesson bigint, p_document bigint) returns void
language plpgsql as $$
declare
    source_doc documents%rowtype;
begin
    -- Serialize changes in one destination, including concurrent attachments.
    perform 1 from lessons where id=p_lesson for no key update;
    select * into source_doc from documents where id=p_document and deleted_at is null;
    if found and exists(select 1 from lesson_documents
                         where lesson_id=p_lesson and document_id=p_document and deleted_at is null) then
        update program_resources set title=source_doc.title, audience=source_doc.audience, updated_at=now()
         where lesson_id=p_lesson and resource_type='DOCUMENT' and resource_ref_id=p_document
           and lesson_attachment and deleted_at is null;
        insert into program_resources
            (lesson_id,resource_type,resource_ref_id,title,order_index,status,audience,
             noi_den_loai,lesson_attachment,created_at,updated_at)
        select p_lesson,'DOCUMENT',p_document,source_doc.title,
               coalesce((select max(order_index) from program_resources
                          where noi_den_loai='BAI' and lesson_id=p_lesson and lop_id is null
                            and deleted_at is null),0)+1,
               'PUBLISHED',source_doc.audience,'BAI',true,now(),now()
         where not exists(select 1 from program_resources
                           where noi_den_loai='BAI' and lesson_id=p_lesson and lop_id is null
                             and resource_type='DOCUMENT' and resource_ref_id=p_document
                             and deleted_at is null);
    else
        update program_resources set deleted_at=now(),updated_at=now()
         where lesson_id=p_lesson and resource_type='DOCUMENT' and resource_ref_id=p_document
           and lesson_attachment and deleted_at is null;
    end if;
end;
$$;

create function sync_lesson_attachment_row() returns trigger language plpgsql as $$
begin
    if TG_OP='DELETE' then
        perform sync_lesson_attachment(OLD.lesson_id,OLD.document_id);
        return OLD;
    end if;
    if TG_OP='UPDATE' and (OLD.lesson_id<>NEW.lesson_id or OLD.document_id<>NEW.document_id) then
        perform sync_lesson_attachment(OLD.lesson_id,OLD.document_id);
    end if;
    perform sync_lesson_attachment(NEW.lesson_id,NEW.document_id);
    return NEW;
end;
$$;
create trigger lesson_attachment_stream after insert or update or delete on lesson_documents
for each row execute function sync_lesson_attachment_row();

-- Metadata and visibility changes must also reach the projected rows.
create function sync_document_attachment_rows() returns trigger language plpgsql as $$
declare target_lesson bigint;
begin
    for target_lesson in select distinct lesson_id from lesson_documents where document_id=NEW.id order by lesson_id
    loop
        perform sync_lesson_attachment(target_lesson,NEW.id);
    end loop;
    return NEW;
end;
$$;
create trigger document_attachment_stream after update of title,audience,status,deleted_at on documents
for each row execute function sync_document_attachment_rows();

-- Repair existing attachments, grouping legacy duplicates without deleting study history.
do $$
declare attachment record;
begin
    for attachment in select distinct ld.lesson_id,ld.document_id
        from lesson_documents ld join lessons l on l.id=ld.lesson_id and l.deleted_at is null
        join chapters ch on ch.id=l.chapter_id and ch.deleted_at is null
        where ld.deleted_at is null order by ld.lesson_id,ld.document_id
    loop
        perform sync_lesson_attachment(attachment.lesson_id,attachment.document_id);
    end loop;
end;
$$;
