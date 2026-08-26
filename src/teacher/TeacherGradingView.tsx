import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGradebook, type AuthSession, type Classroom, type GradebookRow } from "../api";
import { messageOf } from "../lib/errors";
import { EmptyState } from "../components/common";

export function TeacherGradingView({session,classes}:{session:AuthSession;classes:Classroom[]}) {
 const [classId,setClassId]=useState(classes[0]?.id??0),[selected,setSelected]=useState<GradebookRow|null>(null),[search,setSearch]=useState(""),[status,setStatus]=useState("IN_PROGRESS");
 const gradebookQuery=useQuery({queryKey:["teacher-grading",session.accessToken,classId],queryFn:()=>getGradebook(session,classId),enabled:!!classId});
 const rows=gradebookQuery.data??[];
 const loading=gradebookQuery.isLoading;
 const error=gradebookQuery.isError?messageOf(gradebookQuery.error):"";
 useEffect(()=>{if(!classes.some(item=>item.id===classId))setClassId(classes[0]?.id??0)},[classes,classId]);
 useEffect(()=>{setSelected(null)},[classId]);
 const filtered=rows.filter(row=>(!status||row.status===status)&&(!search||`${row.full_name} ${row.username} ${row.title}`.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))));
 const inProgress=rows.filter(row=>row.status==="IN_PROGRESS").length,completed=rows.filter(row=>row.status==="COMPLETED").length,notOpened=rows.filter(row=>row.status!=="IN_PROGRESS"&&row.status!=="COMPLETED").length;
 const selectedClass=classes.find(item=>item.id===classId);
 const statusLabel=(value:string)=>value==="COMPLETED"?"Đã hoàn thành":value==="IN_PROGRESS"?"Đang làm":"Chưa mở";
 const statusTone=(value:string)=>value==="COMPLETED"?"bg-secondary-container/30 text-on-secondary-container":value==="IN_PROGRESS"?"bg-primary-container/20 text-primary":"bg-surface-variant text-on-surface-variant";
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
     <p className="text-xs text-on-surface-variant">Đang thực hiện</p>
     <p className="text-2xl font-bold text-primary data-tabular">{inProgress}</p>
     <p className="text-xs text-on-surface-variant">lượt bài cần theo dõi</p>
    </article>
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant">Chưa mở</p>
     <p className="text-2xl font-bold text-on-surface data-tabular">{notOpened}</p>
     <p className="text-xs text-on-surface-variant">lượt bài chưa bắt đầu</p>
    </article>
    <article className="p-4 rounded-lg border border-outline-variant bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant">Đã hoàn thành</p>
     <p className="text-2xl font-bold text-secondary data-tabular">{completed}</p>
     <p className="text-xs text-on-surface-variant">lượt bài</p>
    </article>
   </div>

   <div className="flex items-center gap-2 flex-wrap">
    <input placeholder="Tìm học sinh hoặc bài tập…" value={search} onChange={e=>setSearch(e.target.value)} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface flex-1 min-w-[200px]"/>
    <select value={status} onChange={e=>setStatus(e.target.value)} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
     <option value="">Tất cả trạng thái</option>
     <option value="IN_PROGRESS">Đang thực hiện</option>
     <option value="COMPLETED">Đã hoàn thành</option>
     <option value="NOT_OPENED">Chưa mở</option>
    </select>
    <span className="text-xs text-on-surface-variant">{filtered.length} lượt bài</span>
   </div>

   {error && <div className="api-error">{error}</div>}

   <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
    {loading ? <p className="text-sm text-on-surface-variant">Đang tải hàng đợi…</p> : (
     <div className="border border-outline-variant rounded-lg overflow-hidden">
      <div className="flex flex-col divide-y divide-outline-variant">
       {filtered.map(row=>{
        const initials=row.full_name.split(/\s+/).filter(Boolean).slice(-2).map(part=>part[0]).join("").toUpperCase();
        const isSelected=selected?.student_id===row.student_id&&selected?.assignment_id===row.assignment_id;
        return (
         <button
          key={`${row.student_id}-${row.assignment_id}`}
          onClick={()=>setSelected(row)}
          className={`flex items-center gap-3 p-3 text-left transition-colors ${isSelected?"bg-primary-container/15":"bg-surface-container-lowest hover:bg-surface-container-low"}`}
         >
          <span className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold shrink-0">{initials||"?"}</span>
          <span className="min-w-0 flex-1">
           <span className="block text-sm font-medium text-on-surface truncate">{row.full_name}</span>
           <span className="block text-xs text-on-surface-variant truncate">@{row.username} · {row.title}</span>
          </span>
          <span className="w-20 shrink-0">
           <span className="block h-1.5 rounded-full bg-surface-variant overflow-hidden">
            <span className="block h-full bg-primary" style={{width:`${Math.max(0,Math.min(100,row.completion_percent))}%`}}/>
           </span>
           <span className="block text-[11px] text-on-surface-variant text-right mt-0.5 data-tabular">{row.completion_percent}%</span>
          </span>
          <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded ${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
         </button>
        );
       })}
      </div>
      {!filtered.length && <EmptyState text="Không có lượt bài phù hợp bộ lọc."/>}
     </div>
    )}

    <aside className="border border-outline-variant rounded-lg bg-surface-container-lowest p-4 flex flex-col gap-4 lg:sticky lg:top-[72px]">
     {selected ? <>
      <div className="flex items-start justify-between gap-2">
       <div className="min-w-0">
        <p className="text-xs font-semibold text-primary tracking-wide">CHI TIẾT BÀI LÀM</p>
        <h2 className="text-base font-bold text-on-surface truncate">{selected.full_name}</h2>
        <p className="text-xs text-on-surface-variant truncate">{selected.title} · {selectedClass?.name}</p>
       </div>
       <button onClick={()=>setSelected(null)} className="shrink-0 w-7 h-7 rounded flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors">
        <span className="material-symbols-outlined text-[18px]">close</span>
       </button>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
       <div><dt className="text-on-surface-variant">Trạng thái</dt><dd className="text-sm font-semibold text-on-surface">{statusLabel(selected.status)}</dd></div>
       <div><dt className="text-on-surface-variant">Tiến độ</dt><dd className="text-sm font-semibold text-on-surface data-tabular">{selected.completion_percent}%</dd></div>
      </dl>

      <div className="flex flex-col gap-2 pt-2 border-t border-outline-variant">
       <p className="text-xs font-semibold text-on-surface-variant tracking-wide">CHẤM ĐIỂM CHI TIẾT</p>
       {["Câu 1","Câu 2","Câu 3","Câu 4"].map(label=>(
        <div key={label} className="flex items-center justify-between gap-2">
         <span className="text-sm text-on-surface-variant">{label}</span>
         <input disabled placeholder="–" className="w-16 h-8 px-2 rounded border border-outline-variant bg-surface-variant text-on-surface-variant text-sm text-center disabled:cursor-not-allowed"/>
        </div>
       ))}
       <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant">
        <span className="text-sm font-bold text-on-surface">Tổng điểm</span>
        <span className="text-lg font-bold text-on-surface-variant">–<span className="text-xs font-normal">/10</span></span>
       </div>
      </div>

      <div className="flex items-start gap-2 p-3 rounded-lg bg-surface-container-low border border-outline-variant">
       <span className="material-symbols-outlined text-on-surface-variant text-[18px] shrink-0">info</span>
       <p className="text-[11px] text-on-surface-variant">Chưa thể nhập điểm: API hiện chưa cung cấp bài nộp đính kèm, rubric và endpoint lưu điểm. Màn hình không tạo dữ liệu chấm giả.</p>
      </div>
     </> : (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
       <span className="material-symbols-outlined text-on-surface-variant text-[28px]">edit_note</span>
       <p className="text-sm text-on-surface-variant">Chọn một lượt bài bên trái để xem chi tiết.</p>
      </div>
     )}
    </aside>
   </div>
  </section>
 );
}
