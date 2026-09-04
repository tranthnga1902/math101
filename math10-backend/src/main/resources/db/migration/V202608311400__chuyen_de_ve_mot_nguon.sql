-- Chuyên đề về một nguồn: special_topics nhập vào taxonomy_node rồi biến mất.
--
-- Hai bảng cùng tự nhận là "chuyên đề". taxonomy_node là cây thật (cha con, gộp/tách, alias, có màn
-- hình quản trị đang chạy, đã được documents.taxonomy_node_id và class_curriculum trỏ tới).
-- special_topics là bảng phẳng sinh sau, bốn endpoint quản trị của nó không một màn hình nào gọi —
-- đường ghi chết từ lúc sinh, trong khi đường đọc vẫn sống qua program_resources.
--
-- Cột related_chapter_id KHÔNG được bê sang. Một nút phân loại dùng chung cho cả khối, còn chương
-- thì thuộc một bộ sách của một chương trình; kế hoạch A1 đòi nhiều bộ sách song song cho mỗi lớp,
-- nên ép nút chỉ liên quan tới một chương là ép nó chọn một bộ sách. Chỗ nói "chuyên đề này thuộc
-- chương nào của chương trình nào" chính là dòng program_resources: nhiều-nhiều, có thứ tự, và đã
-- được lịch chương trình xếp sẵn.

-- Bảng bắc cầu id cũ -> id mới. Cần nó vì hai lẽ: repoint program_resources, và biết dòng nào KHÔNG
-- chuyển được. Dòng không chuyển được là chỗ nguy hiểm nhất của cả lát — id cũ số 3 để nguyên sẽ
-- được đọc thành taxonomy_node số 3, một chuyên đề hoàn toàn khác, mà không ai báo gì.
create temporary table chuyen_de_chuyen_nha (cu bigint primary key, moi bigint not null) on commit drop;

-- Mang sang cả dòng đã xoá mềm, để không dòng program_resources nào còn trỏ vào khoảng không.
-- Slug đặt theo id cũ chứ không suy từ tiêu đề: nó phải duy nhất (ux_taxonomy_root_slug) và phải
-- đọc ra ngay là do máy sinh, không giả làm slug người đặt.
-- Trạng thái đóng về phía an toàn: chỉ PUBLISHED mới thành ACTIVE, bản nháp thành ARCHIVED —
-- taxonomy_node không có trạng thái nháp, và cho một bản nháp lên sóng thì tệ hơn là giấu nó đi.
with sang as (
    insert into taxonomy_node (parent_id, subject, depth, title, description, slug, order_no, status,
                               created_at, updated_at, deleted_at)
    select null, 'TOAN_10', 1, st.title, st.description, 'chuyen-de-' || st.id, 0,
           case when st.status = 'PUBLISHED' then 'ACTIVE' else 'ARCHIVED' end,
           st.created_at, st.updated_at, st.deleted_at
      from special_topics st
    returning id, slug
)
insert into chuyen_de_chuyen_nha (cu, moi)
select substring(slug from length('chuyen-de-') + 1)::bigint, id from sang;

update program_resources pr
   set resource_ref_id = m.moi, updated_at = now()
  from chuyen_de_chuyen_nha m
 where pr.resource_type = 'SPECIAL_TOPIC' and pr.resource_ref_id = m.cu;

-- Dòng trỏ vào chuyên đề đã không còn từ trước: gỡ khỏi luồng học thay vì để nó tự nhận một nút
-- khác trùng số.
update program_resources
   set deleted_at = now(), updated_at = now()
 where resource_type = 'SPECIAL_TOPIC'
   and deleted_at is null
   and resource_ref_id not in (select moi from chuyen_de_chuyen_nha);

drop table special_topics;
