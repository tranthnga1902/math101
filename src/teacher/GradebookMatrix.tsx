import { type Classroom, type GradebookRow } from "../api";
import { EmptyState } from "../components/common";

export function GradebookMatrix({classes,rows,selectedStudent,onSelectStudent,onSelectClass}:{classes:Classroom[];rows:GradebookRow[];selectedStudent:number|null;onSelectStudent:(id:number|null)=>void;onSelectClass:(id:number)=>Promise<void>}){
 const students=Array.from(new Map(rows.map(row=>[row.student_id,{id:row.student_id,name:row.full_name,username:row.username}])).values());
 const assignments=Array.from(new Map(rows.map(row=>[row.assignment_id,{id:row.assignment_id,title:row.title}])).values());
 const icon=(status:string)=>status==="COMPLETED"?"✓":status==="IN_PROGRESS"?"●":"○";
 const label=(status:string)=>status==="COMPLETED"?"Đã xong":status==="IN_PROGRESS"?"Đang làm":"Chưa mở";
 const tone=(status:string)=>status==="COMPLETED"?"text-secondary":status==="IN_PROGRESS"?"text-primary":"text-on-surface-variant/40";
 return (
  <section className="flex flex-col gap-4">
   <div className="flex items-center justify-between gap-3 flex-wrap">
    <div>
     <p className="text-xs font-semibold text-primary tracking-wide">SỔ ĐIỂM TIẾN ĐỘ</p>
     <h3 className="text-base font-bold text-on-surface">Học sinh × Bài tập</h3>
    </div>
    {classes.length>1 && (
     <div className="flex items-center gap-1.5 flex-wrap">
      {classes.map(item=><button key={item.id} onClick={()=>void onSelectClass(item.id)} className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">{item.name}</button>)}
     </div>
    )}
   </div>
   {rows.length ? (
    <div className="border border-outline-variant rounded-lg overflow-auto max-h-[560px] thin-scrollbar">
     <table className="w-full text-sm border-collapse">
      <thead>
       <tr>
        <th className="sticky top-0 left-0 z-20 bg-surface-container-low text-left px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-r border-outline-variant min-w-[180px]">Học sinh</th>
        {assignments.map(item=><th key={item.id} title={item.title} className="sticky top-0 z-10 bg-surface-container-low px-3 py-2 font-semibold text-on-surface-variant text-xs border-b border-outline-variant min-w-[120px] max-w-[160px] truncate">{item.title}</th>)}
       </tr>
      </thead>
      <tbody>
       {students.map(student=>{
        const initials=(student.name||"?").trim().split(/\s+/).filter(Boolean).slice(-2).map(part=>part[0]).join("").toUpperCase();
        return (
         <tr key={student.id} className="hover:bg-surface-container-low/60">
          <th className="sticky left-0 z-10 bg-surface-container-lowest text-left px-3 py-2 border-b border-r border-outline-variant font-normal">
           <button onClick={()=>onSelectStudent(student.id)} className="flex items-center gap-2 text-left w-full">
            <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-bold shrink-0">{initials||"?"}</span>
            <span className="min-w-0"><span className="block text-sm font-medium text-on-surface truncate">{student.name}</span><span className="block text-[11px] text-on-surface-variant truncate">@{student.username}</span></span>
           </button>
          </th>
          {assignments.map(assignment=>{
           const row=rows.find(item=>item.student_id===student.id&&item.assignment_id===assignment.id);
           const status=row?.status||"NOT_OPENED";
           return <td key={assignment.id} className="px-3 py-2 border-b border-outline-variant text-center"><span className={`text-base ${tone(status)}`} title={`${label(status)} · ${row?.completion_percent||0}%`}>{icon(status)}</span></td>;
          })}
         </tr>
        );
       })}
      </tbody>
     </table>
    </div>
   ) : <EmptyState text="Lớp này chưa có nhiệm vụ nào nên chưa có dữ liệu sổ điểm."/>}
   {selectedStudent && (
    <div className="border border-outline-variant rounded-lg p-4 bg-surface-container-lowest">
     <div className="flex items-center justify-between mb-3">
      <h4 className="text-sm font-bold text-on-surface">Chi tiết · {rows.find(x=>x.student_id===selectedStudent)?.full_name}</h4>
      <button onClick={()=>onSelectStudent(null)} className="text-xs text-on-surface-variant hover:text-on-surface">Đóng</button>
     </div>
     <div className="flex flex-col gap-2">
      {rows.filter(x=>x.student_id===selectedStudent).map(x=>(
       <div key={x.assignment_id} className="flex items-center justify-between text-sm">
        <b className="text-on-surface">{x.title}</b>
        <span className="text-on-surface-variant">{label(x.status)} · {x.completion_percent}%</span>
       </div>
      ))}
     </div>
    </div>
   )}
  </section>
 );
}
