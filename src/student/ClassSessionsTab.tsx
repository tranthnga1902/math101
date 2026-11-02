import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, ChevronRight } from "lucide-react";
import { getClassSchedule, type AuthSession } from "../api";
import { ClassMaterialsTab } from "../teacher/class/ClassDetailTabs";

export function ClassSessionsTab({session,classId}:{session:AuthSession;classId:number}) {
  const [selected,setSelected]=useState<number|null>(null);
  const query=useQuery({queryKey:["student-class-schedule",session.accessToken,classId],queryFn:()=>getClassSchedule(session,classId)});
  if(query.isPending)return <div aria-label="Đang tải buổi học" className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 rounded-xl bg-surface-container animate-pulse"/>)}</div>;
  if(query.isError)return <div role="alert" className="rounded-lg bg-error-container text-error p-3 text-sm">{query.error.message}<button className="ml-3 underline" onClick={()=>void query.refetch()}>Thử lại</button></div>;
  if(!query.data.length)return <div className="rounded-xl border border-outline-variant p-6 text-center text-on-surface-variant"><CalendarDays className="mx-auto mb-3"/><p>Lớp chưa có lịch buổi học.</p><p className="mt-2 text-sm">Em có thể xem học liệu đã được cấp trong tab Tài liệu.</p></div>;
  return <div className="space-y-3">
    <p className="text-sm text-on-surface-variant">Chọn buổi học để xem tài liệu của các bài học trong buổi.</p>
    {query.data.map(row=><section key={row.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden">
      <button type="button" aria-expanded={selected===row.id} onClick={()=>setSelected(selected===row.id?null:row.id)} className="flex items-start gap-3 w-full p-4 text-left hover:bg-surface-container-low focus-visible:outline-primary">
        <CalendarDays size={20} className="text-primary shrink-0"/>
        <span className="min-w-0 flex-1"><b className="block text-sm line-clamp-2 break-words">Buổi {row.seq} · {row.sessionTitle||"Nội dung học tập"}</b><span className="block mt-2 text-xs text-on-surface-variant">{new Date(`${row.scheduledDate}T00:00:00`).toLocaleDateString("vi-VN")} · {row.status==="COMPLETED"?"Đã học":row.status==="CANCELLED"?"Đã hủy":row.status==="POSTPONED"?"Hoãn":"Sắp học"}</span></span>
        {selected===row.id?<ChevronDown size={18}/>:<ChevronRight size={18}/>}
      </button>
      {selected===row.id&&<div className="border-t border-outline-variant p-4"><ClassMaterialsTab session={session} classId={classId} scheduleId={row.id}/></div>}
    </section>)}
  </div>;
}
