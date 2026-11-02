import { useState } from "react";
import { useMutation,useQuery,useQueryClient } from "@tanstack/react-query";
import { addClassDayOff,getClassDaysOff,removeClassDayOff,type AuthSession } from "../api";
import { dateVi } from "../teacher/class/ClassDetailOverview";

export function ClassDaysOff({session,classId}:{session:AuthSession;classId:number}){
 const client=useQueryClient(),key=["class-days-off",session.accessToken,classId];
 const [draft,setDraft]=useState({startsOn:"",endsOn:"",reason:""});
 const query=useQuery({queryKey:key,queryFn:()=>getClassDaysOff(session,classId)});
 const change=useMutation({mutationFn:(id?:number)=>id?removeClassDayOff(session,classId,id):addClassDayOff(session,classId,draft),onSuccess:async()=>{setDraft({startsOn:"",endsOn:"",reason:""});await client.invalidateQueries({queryKey:key})}});
 return <section className="border border-outline-variant rounded-xl bg-surface-container-lowest p-4"><h3 className="font-bold">Ngày nghỉ riêng của lớp</h3>
  <p className="text-xs text-on-surface-variant mt-1">Sau khi thay đổi ngày nghỉ, sinh lại lịch để cập nhật các buổi chưa học.</p>
  {(query.isError||change.isError)&&<p role="alert" className="api-error">{query.error?.message||change.error?.message}</p>}
  <form className="flex gap-2 flex-wrap my-3" onSubmit={e=>{e.preventDefault();change.mutate(undefined)}}>
   <label className="text-xs">Từ ngày<input required type="date" value={draft.startsOn} onChange={e=>setDraft({...draft,startsOn:e.target.value})} className="block border border-outline-variant rounded p-2"/></label>
   <label className="text-xs">Đến ngày<input required type="date" min={draft.startsOn} value={draft.endsOn} onChange={e=>setDraft({...draft,endsOn:e.target.value})} className="block border border-outline-variant rounded p-2"/></label>
   <label className="text-xs">Lý do<input maxLength={500} value={draft.reason} onChange={e=>setDraft({...draft,reason:e.target.value})} className="block border border-outline-variant rounded p-2"/></label>
   <button disabled={change.isPending} className="self-end bg-primary text-on-primary rounded px-3 py-2">Thêm ngày nghỉ</button>
  </form>
  {query.isLoading&&<p>Đang tải…</p>}
  {query.data?.map(row=><div key={row.id} className="flex justify-between gap-2 py-2 border-b border-outline-variant text-sm"><span>{dateVi(row.starts_on)} – {dateVi(row.ends_on)} · {row.reason}</span><button disabled={change.isPending} onClick={()=>change.mutate(row.id)} className="text-error">Gỡ</button></div>)}
  {query.isSuccess&&!query.data.length&&<p className="text-sm text-on-surface-variant">Chưa có ngày nghỉ riêng.</p>}
 </section>;
}
