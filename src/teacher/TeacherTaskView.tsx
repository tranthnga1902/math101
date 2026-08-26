import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorksheets, getAssignments, getGradebook, saveAssignment, type AuthSession, type Classroom, type Worksheet, type Assignment } from "../api";
import { messageOf } from "../lib/errors";
import { EmptyState } from "../components/common";

export function TeacherTaskView({session,classes}:{session:AuthSession;classes:Classroom[]}) {
 const queryClient=useQueryClient();
 const [classFilter,setClassFilter]=useState(0),[statusFilter,setStatusFilter]=useState(""),[search,setSearch]=useState(""),[open,setOpen]=useState(false);
 const [form,setForm]=useState({classId:classes[0]?.id??0,title:"",worksheetId:0,dueAt:"",status:"PUBLISHED"});
 const classIdsKey=classes.map(item=>item.id).join(",");
 const tasksQuery=useQuery({queryKey:["teacher-tasks",session.accessToken,classIdsKey],queryFn:async()=>{const [sheets,...byClass]=await Promise.all([getWorksheets(session),...classes.map(async classroom=>{const [assignments,gradebook]=await Promise.all([getAssignments(session,classroom.id),getGradebook(session,classroom.id)]);return assignments.map(item=>{const related=gradebook.filter(row=>row.assignment_id===item.id);return {...item,className:classroom.name,completed:related.filter(row=>row.status==="COMPLETED").length,total:related.length}})})]);return {worksheets:sheets as Worksheet[],rows:(byClass as (Assignment&{className:string;completed:number;total:number})[][]).flat()}}});
 const rows=tasksQuery.data?.rows??[],worksheets=tasksQuery.data?.worksheets??[],loading=tasksQuery.isLoading;
 const saveMutation=useMutation({mutationFn:(input:Parameters<typeof saveAssignment>[1])=>saveAssignment(session,input),onSuccess:()=>queryClient.invalidateQueries({queryKey:["teacher-tasks"]})});
 const error=tasksQuery.isError?messageOf(tasksQuery.error):saveMutation.isError?messageOf(saveMutation.error):"";
 useEffect(()=>{if(!classes.some(item=>item.id===form.classId))setForm(value=>({...value,classId:classes[0]?.id??0}))},[classes,form.classId]);
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await saveMutation.mutateAsync({classId:form.classId,lessonId:null,worksheetId:form.worksheetId||null,title:form.title,dueAt:form.dueAt||null,status:form.status});setOpen(false);setForm({classId:classes[0]?.id??0,title:"",worksheetId:0,dueAt:"",status:"PUBLISHED"})}catch{/* lỗi đã có trong mutation state */}};
 const filtered=rows.filter(item=>(!classFilter||item.classId===classFilter)&&(!statusFilter||item.status===statusFilter)&&(!search||item.title.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))));
 const statusLabel=(value:string)=>value==="PUBLISHED"?"Đang mở":value==="DRAFT"?"Nháp":"Đã đóng";
 const statusTone=(value:string)=>value==="PUBLISHED"?"bg-primary-container/20 text-primary":value==="DRAFT"?"bg-surface-variant text-on-surface-variant":"bg-tertiary-container/30 text-on-tertiary-container";
 const statusTabs=[["","Tất cả"],["PUBLISHED","Đang mở"],["HIDDEN","Đã đóng"],["DRAFT","Nháp"]] as const;
 const now=Date.now();
 const ongoing=rows.filter(item=>item.status==="PUBLISHED").length;
 const dueSoon=rows.filter(item=>item.status==="PUBLISHED"&&item.dueAt&&new Date(item.dueAt).getTime()>=now&&new Date(item.dueAt).getTime()-now<=48*3600*1000).length;
 const needsReview=rows.reduce((sum,item)=>sum+item.completed,0);
 const totalSeats=rows.reduce((sum,item)=>sum+item.total,0),totalDone=rows.reduce((sum,item)=>sum+item.completed,0);
 const submissionRate=totalSeats?Math.round(totalDone*100/totalSeats):0;
 return (
  <section className="flex flex-col gap-4">
   <header className="flex items-center justify-between gap-4 flex-wrap">
    <div>
     <h1 className="text-2xl font-bold text-on-surface">Quản lý Nhiệm vụ</h1>
     <p className="text-sm text-on-surface-variant">Giao bài tập, kiểm tra và theo dõi tiến độ học sinh.</p>
    </div>
    <button onClick={()=>setOpen(true)} className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
     <span className="material-symbols-outlined text-[18px]">add</span> Tạo nhiệm vụ
    </button>
   </header>

   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">event_available</span> Đang diễn ra</p>
     <p className="text-2xl font-bold text-on-surface data-tabular">{ongoing}</p>
    </article>
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">warning</span> Sắp đến hạn (48h)</p>
     <p className="text-2xl font-bold text-error data-tabular">{dueSoon}</p>
    </article>
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">fact_check</span> Bài đã nộp chờ xem</p>
     <p className="text-2xl font-bold text-secondary data-tabular">{needsReview}</p>
    </article>
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">insights</span> Tỉ lệ nộp bài</p>
     <p className="text-2xl font-bold text-on-surface data-tabular">{submissionRate}%</p>
    </article>
   </div>

   <div className="flex items-center gap-2 flex-wrap">
    <input placeholder="Tìm nhiệm vụ…" value={search} onChange={e=>setSearch(e.target.value)} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface flex-1 min-w-[200px]"/>
    <select value={classFilter} onChange={e=>setClassFilter(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
     <option value={0}>Tất cả các lớp</option>
     {classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <span className="text-xs text-on-surface-variant">{filtered.length} nhiệm vụ</span>
   </div>

   <div className="flex items-center gap-2 border-b border-outline-variant overflow-x-auto thin-scrollbar">
    {statusTabs.map(([value,label])=>{
     const count=value?rows.filter(item=>item.status===value).length:rows.length;
     return (
      <button
       key={value||"all"}
       onClick={()=>setStatusFilter(value)}
       className={`shrink-0 px-3 h-10 text-sm font-semibold border-b-2 -mb-px transition-colors ${statusFilter===value?"border-primary text-primary":"border-transparent text-on-surface-variant hover:text-on-surface"}`}
      >
       {label} <span className="text-xs font-normal">({count})</span>
      </button>
     );
    })}
   </div>

   {error && <div className="api-error">{error}</div>}

   {loading ? <p className="text-sm text-on-surface-variant">Đang tải nhiệm vụ…</p> : (
    <div className="border border-outline-variant rounded-lg overflow-auto thin-scrollbar">
     <table className="w-full text-sm border-collapse">
      <thead>
       <tr className="bg-surface-container-low">
        <th className="text-left px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-outline-variant">Tên nhiệm vụ</th>
        <th className="text-left px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-outline-variant">Loại</th>
        <th className="text-left px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-outline-variant">Lớp</th>
        <th className="text-left px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-outline-variant">Hạn nộp</th>
        <th className="text-left px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-outline-variant">Tiến độ nộp</th>
        <th className="text-left px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-outline-variant">Trạng thái</th>
       </tr>
      </thead>
      <tbody>
       {filtered.map(item=>{
        const percent=item.total?Math.round(item.completed*100/item.total):0;
        const due=item.dueAt?new Date(item.dueAt):null;
        const overdue=Boolean(due&&due.getTime()<now&&item.status==="PUBLISHED");
        return (
         <tr key={item.id} className="hover:bg-surface-container-low/60">
          <td className="px-3 py-2 border-b border-outline-variant"><span className="block font-medium text-on-surface truncate max-w-[260px]">{item.title}</span><span className="block text-[11px] text-on-surface-variant">#{item.id}</span></td>
          <td className="px-3 py-2 border-b border-outline-variant"><span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant">{item.worksheetId?"Phiếu bài tập":"Bài học"}</span></td>
          <td className="px-3 py-2 border-b border-outline-variant text-on-surface-variant">{item.className}</td>
          <td className={`px-3 py-2 border-b border-outline-variant ${overdue?"text-error font-semibold":"text-on-surface-variant"}`}>{due?due.toLocaleString("vi-VN"):"Không giới hạn"}</td>
          <td className="px-3 py-2 border-b border-outline-variant">
           <div className="flex items-center gap-2 w-32">
            <span className="flex-1 h-1.5 rounded-full bg-surface-variant overflow-hidden"><span className="block h-full bg-primary" style={{width:`${percent}%`}}/></span>
            <span className="text-[11px] text-on-surface-variant shrink-0 data-tabular">{item.completed}/{item.total}</span>
           </div>
          </td>
          <td className="px-3 py-2 border-b border-outline-variant"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusTone(item.status)}`}>{statusLabel(item.status)}</span></td>
         </tr>
        );
       })}
      </tbody>
     </table>
     {!filtered.length && <EmptyState text="Không có nhiệm vụ phù hợp bộ lọc."/>}
    </div>
   )}

   {open && (
    <div className="dialog-backdrop">
     <section className="dialog-card task-dialog">
      <div className="panel-head"><div><p className="eyebrow">TẠO NHIỆM VỤ</p><h2>Giao phiếu bài tập</h2></div><button onClick={()=>setOpen(false)}>Đóng</button></div>
      <form className="live-form" onSubmit={save}>
       <label>Lớp học<select required value={form.classId} onChange={e=>setForm({...form,classId:Number(e.target.value)})}>{classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
       <label>Tên nhiệm vụ<input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/></label>
       <label>Phiếu bài tập<select required value={form.worksheetId} onChange={e=>setForm({...form,worksheetId:Number(e.target.value)})}><option value={0}>Chọn phiếu…</option>{worksheets.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
       <label>Hạn nộp<input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/></label>
       <label>Trạng thái<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="PUBLISHED">Giao ngay</option><option value="DRAFT">Lưu nháp</option></select></label>
       <div className="live-actions"><button type="button" onClick={()=>setOpen(false)}>Hủy</button><button className="primary">Tạo nhiệm vụ</button></div>
      </form>
     </section>
    </div>
   )}
  </section>
 );
}
