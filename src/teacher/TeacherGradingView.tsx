import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGradebook, type AuthSession, type Classroom } from "../api";
import { messageOf } from "../lib/errors";
import { ClassGradingPanel } from "./class/ClassGradingPanel";

/**
 * Hàng đợi chấm bài của cả lớp.
 *
 * <p>Màn hình này trước đây dựng danh sách từ sổ điểm rồi mở một khung chấm **giả**: bốn ô "Câu
 * 1…Câu 4" khoá cứng, không liên quan gì tới đề thật, kèm dòng chữ báo rằng chưa có endpoint lưu
 * điểm. Dòng chữ đó nay sai — đường chấm từng câu đã có — và một màn hình nói với giáo viên rằng
 * tính năng chưa tồn tại thì tệ hơn là không có màn hình.
 *
 * <p>Phần chấm nay dùng thẳng {@link ClassGradingPanel}, đúng cái hộp chấm đang chạy trong chi
 * tiết lớp. Không dựng bản sao thứ ba: mỗi màn hình chấm thêm là thêm một chỗ có thể quên luật
 * "đề tự luận thì không gõ điểm cả bài", mà quên một lần là xoá sạch điểm từng câu bên kia.
 *
 * <p>Sổ điểm vẫn được nạp, nhưng chỉ để đếm — ba con số ở đầu trang là ba việc còn phải làm, chứ
 * không phải tiến độ học tập.
 */
export function TeacherGradingView({session,classes}:{session:AuthSession;classes:Classroom[]}) {
 const [classId,setClassId]=useState(classes[0]?.id??0);
 useEffect(()=>{if(!classes.some(item=>item.id===classId))setClassId(classes[0]?.id??0)},[classes,classId]);

 const gradebookQuery=useQuery({queryKey:["class-gradebook",session.accessToken,classId],queryFn:()=>getGradebook(session,classId),enabled:!!classId});
 const rows=useMemo(()=>gradebookQuery.data??[],[gradebookQuery.data]);
 const error=gradebookQuery.isError?messageOf(gradebookQuery.error):"";
 const selectedClass=classes.find(item=>item.id===classId);

 /**
  * "Chờ chấm" và "chấm dở" đều mang grading_status SUBMITTED — bài chỉ chuyển GRADED khi không
  * còn câu nào trống điểm — nên chỉ số câu đã chấm mới tách được hai nhóm. Giáo viên chấm dở 12
  * bài rồi nghỉ cần thấy con số đó, không thì nó lẫn vào đống chưa ai đụng tới.
  */
 const dem=useMemo(()=>{
  let choCham=0,chamDo=0,choTra=0;
  for(const row of rows){
   if(row.grading_status==="SUBMITTED"){if(row.graded_items>0)chamDo++;else choCham++}
   else if(row.grading_status==="GRADED")choTra++;
  }
  return {choCham,chamDo,choTra};
 },[rows]);

 return (
  <section className="flex flex-col gap-4">
   <header className="flex items-center justify-between gap-4 flex-wrap">
    <div>
     <h1 className="text-2xl font-bold text-on-surface">Hàng đợi chấm bài</h1>
     <p className="text-sm text-on-surface-variant">{selectedClass?.name??"Chọn lớp để xem bài"}</p>
    </div>
    <select value={classId} onChange={e=>setClassId(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
     {classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
   </header>

   <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant">Chờ chấm</p>
     <p className="text-2xl font-bold text-primary data-tabular">{dem.choCham}</p>
     <p className="text-xs text-on-surface-variant">bài chưa ai đụng tới</p>
    </article>
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant">Chấm dở</p>
     <p className="text-2xl font-bold text-on-surface data-tabular">{dem.chamDo}</p>
     <p className="text-xs text-on-surface-variant">bài đã chấm được vài câu</p>
    </article>
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant">Chờ trả điểm</p>
     <p className="text-2xl font-bold text-secondary data-tabular">{dem.choTra}</p>
     <p className="text-xs text-on-surface-variant">bài chấm xong, học sinh chưa thấy</p>
    </article>
   </div>

   {error && <div className="api-error">{error}</div>}

   {classId ? <ClassGradingPanel session={session} classId={classId}/> : null}
  </section>
 );
}
