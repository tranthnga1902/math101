import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAssignments, getGradebook, type AuthSession, type Classroom } from "../api";
import { messageOf } from "../lib/errors";
import { EmptyState } from "../components/common";

export type TeacherOperationMode = "grading" | "reports" | "tasks" | "notifications";

export function TeacherOperationsView({session,classes,mode}:{session:AuthSession;classes:Classroom[];mode:TeacherOperationMode}) {
 const [classId,setClassId]=useState(classes[0]?.id??0);
 useEffect(()=>{if(!classes.some(item=>item.id===classId))setClassId(classes[0]?.id??0)},[classes,classId]);
 // Trạng thái đã đọc/chưa đọc không có persistence ở backend nên chỉ giữ ở state cục bộ, reset khi đổi lớp.
 const [readKeys,setReadKeys]=useState<Set<string>>(new Set());
 useEffect(()=>{setReadKeys(new Set())},[classId]);
 const operationsQuery=useQuery({queryKey:["teacher-operations",session.accessToken,classId],queryFn:async()=>{const [assignments,rows]=await Promise.all([getAssignments(session,classId),getGradebook(session,classId)]);return {assignments,rows}},enabled:!!classId});
 const assignments=operationsQuery.data?.assignments??[],rows=operationsQuery.data?.rows??[],loading=operationsQuery.isLoading;
 const error=operationsQuery.isError?messageOf(operationsQuery.error):"";
 const selectedClass=classes.find(item=>item.id===classId);
 const completed=rows.filter(row=>row.status==="COMPLETED").length;
 const inProgress=rows.filter(row=>row.status==="IN_PROGRESS").length;
 const average=rows.length?Math.round(rows.reduce((sum,row)=>sum+(Number(row.completion_percent)||0),0)/rows.length):0;
 const overdue=assignments.filter(item=>item.dueAt&&new Date(item.dueAt).getTime()<Date.now()&&item.status!=="COMPLETED");
 const upcoming=assignments.filter(item=>item.dueAt&&new Date(item.dueAt).getTime()>=Date.now()).sort((a,b)=>new Date(a.dueAt!).getTime()-new Date(b.dueAt!).getTime());
 const heading={grading:["CHẤM BÀI","Chấm bài","Theo dõi bài nộp và mức độ hoàn thành của học sinh theo lớp."],reports:["BÁO CÁO","Báo cáo học tập","Tổng hợp tiến độ thực tế từ sổ điểm của lớp."],tasks:["CÔNG VIỆC","Nhiệm vụ","Các đầu việc cần xử lý dựa trên hạn giao bài và tiến độ lớp."],notifications:["HỆ THỐNG","Thông báo","Những cập nhật cần chú ý từ lớp học và bài tập."]}[mode];
 return <section className="flex flex-col gap-4">
  <div id={mode==="reports"?"teacher-reports":mode==="notifications"?"teacher-notifications":undefined} data-teacher-section data-search={heading[1]} className="section-anchor" />
  <header>
   <h1 className="text-2xl font-bold text-on-surface">{heading[1]}</h1>
   <p className="text-sm text-on-surface-variant">{heading[2]}</p>
  </header>
  <div className="flex items-center gap-3 flex-wrap">
   <select value={classId} onChange={e=>setClassId(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
    {classes.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}
   </select>
   <span className="text-xs text-on-surface-variant">{selectedClass?`${selectedClass.studentCount} học sinh · ${selectedClass.code}`:"Chưa có lớp học"}</span>
  </div>
  {error&&<div className="api-error">{error}</div>}
  {loading&&<p className="text-sm text-on-surface-variant">Đang tải dữ liệu…</p>}
 {mode==="reports"&&(()=>{const studentStats=Array.from(new Map(rows.map(row=>[row.student_id,{id:row.student_id,name:row.full_name,username:row.username,items:rows.filter(item=>item.student_id===row.student_id)}])).values()).map(student=>({...student,average:Math.round(student.items.reduce((sum,item)=>sum+(Number(item.completion_percent)||0),0)/student.items.length)})).sort((a,b)=>a.average-b.average);const attention=studentStats.filter(student=>student.average<50);const assignmentStats=assignments.map(item=>{const related=rows.filter(row=>row.assignment_id===item.id),done=related.filter(row=>row.status==="COMPLETED").length,started=related.filter(row=>row.status==="IN_PROGRESS").length;return {...item,total:related.length,done,started,percent:related.length?Math.round(done*100/related.length):0}}).sort((a,b)=>a.percent-b.percent);return (
  <div className="flex flex-col gap-4">
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
    <article className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant">Tỉ lệ hoàn thành</p>
     <p className="text-2xl font-bold text-on-surface data-tabular mt-1">{average}%</p>
     <div className="h-1.5 rounded-full bg-surface-variant overflow-hidden mt-2"><span className="block h-full bg-primary rounded-full" style={{width:`${average}%`}}/></div>
    </article>
    <article className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant">Lượt bài đã hoàn thành</p>
     <p className="text-2xl font-bold text-on-surface data-tabular mt-1">{completed}</p>
     <p className="text-[11px] text-on-surface-variant mt-1">{rows.length?`${Math.round(completed*100/rows.length)}% tổng lượt bài`:"Chưa có dữ liệu"}</p>
    </article>
    <article className="p-4 border border-outline-variant rounded-lg bg-surface-container-lowest">
     <p className="text-xs text-on-surface-variant">Đang thực hiện</p>
     <p className="text-2xl font-bold text-on-surface data-tabular mt-1">{inProgress}</p>
     <p className="text-[11px] text-on-surface-variant mt-1">{assignments.length} nhiệm vụ trong lớp</p>
    </article>
    <article className="p-4 border border-error/30 rounded-lg bg-error-container/20">
     <p className="text-xs text-on-surface-variant">Cần xem lại</p>
     <p className="text-2xl font-bold text-error data-tabular mt-1">{attention.length}</p>
     <p className="text-[11px] text-on-surface-variant mt-1">Học sinh có tiến độ dưới 50%</p>
    </article>
   </div>

   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <section className="border border-outline-variant rounded-lg p-4 bg-surface-container-lowest">
     <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-on-surface">Tiến độ theo nhiệm vụ</h2>
      <span className="text-xs text-on-surface-variant">{assignmentStats.length} nhiệm vụ</span>
     </div>
     {assignmentStats.length?(
      <div className="flex flex-col gap-3">
       {assignmentStats.map(item=>(
        <div key={item.id}>
         <div className="flex items-center justify-between gap-2 text-xs mb-1">
          <span className="text-on-surface truncate" title={item.title}>{item.title}</span>
          <b className="text-on-surface shrink-0">{item.percent}%</b>
         </div>
         <div className="h-1.5 rounded-full bg-surface-variant overflow-hidden"><span className={`block h-full rounded-full ${item.percent<50?"bg-error":"bg-primary"}`} style={{width:`${item.percent}%`}}/></div>
         <p className="text-[11px] text-on-surface-variant mt-1">{item.done}/{item.total} hoàn thành · {item.started} đang làm</p>
        </div>
       ))}
      </div>
     ):<EmptyState text="Lớp chưa có nhiệm vụ để lập báo cáo."/>}
    </section>

    <section className="border border-outline-variant rounded-lg p-4 bg-surface-container-lowest">
     <div className="flex items-center justify-between mb-3">
      <h2 className="text-sm font-bold text-on-surface">Phân bố tiến độ học sinh</h2>
      <span className="text-xs text-on-surface-variant">{studentStats.length} học sinh có dữ liệu</span>
     </div>
     <div className="flex flex-col gap-2.5">
      {[{label:"Tốt",min:80,color:"bg-secondary"},{label:"Đang tiến bộ",min:50,color:"bg-primary"},{label:"Cần chú ý",min:0,color:"bg-error"}].map((bucket,index)=>{
       const upper=index===0?101:index===1?80:50;
       const count=studentStats.filter(student=>student.average>=bucket.min&&student.average<upper).length;
       const percent=studentStats.length?Math.round(count*100/studentStats.length):0;
       return (
        <div key={bucket.label} className="flex items-center gap-3 text-sm">
         <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${bucket.color}`}/>
         <div className="min-w-[110px]">
          <b className="text-on-surface">{bucket.label}</b>
          <span className="block text-[11px] text-on-surface-variant">{bucket.min}{index===0?"+":index===1?"–79":"–49"}%</span>
         </div>
         <strong className="text-on-surface data-tabular">{count}</strong>
         <em className="text-xs text-on-surface-variant not-italic ml-auto">{percent}%</em>
        </div>
       );
      })}
     </div>
    </section>
   </div>

   <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
    <section className="border border-outline-variant rounded-lg overflow-hidden">
     <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between">
      <h2 className="text-sm font-bold text-on-surface">Nhiệm vụ cần xem lại</h2>
      <span className="text-xs text-on-surface-variant">Xếp theo tỉ lệ hoàn thành</span>
     </div>
     {assignmentStats.length?(
      <table className="w-full text-sm">
       <thead><tr className="text-xs text-on-surface-variant bg-surface-container-low"><th className="text-left px-4 py-2 font-semibold">Nhiệm vụ</th><th className="text-left px-3 py-2 font-semibold">Đã xong</th><th className="text-left px-3 py-2 font-semibold">Tỉ lệ</th><th className="text-left px-3 py-2 font-semibold">Nhận định</th></tr></thead>
       <tbody className="divide-y divide-outline-variant">
        {assignmentStats.slice(0,5).map(item=>(
         <tr key={item.id} className="bg-surface-container-lowest">
          <td className="px-4 py-2"><b className="text-on-surface">{item.title}</b><br/><span className="text-[11px] text-on-surface-variant">#{item.id}</span></td>
          <td className="px-3 py-2 text-on-surface">{item.done}/{item.total}</td>
          <td className="px-3 py-2"><strong className={item.percent<50?"text-error":"text-on-surface"}>{item.percent}%</strong></td>
          <td className="px-3 py-2 text-on-surface-variant text-xs">{item.percent<50?"Cần hỗ trợ thêm":item.percent<80?"Đang tiến triển":"Tiến độ tốt"}</td>
         </tr>
        ))}
       </tbody>
      </table>
     ):<EmptyState text="Chưa có nhiệm vụ để phân tích."/>}
    </section>

    <section className="border border-outline-variant rounded-lg overflow-hidden">
     <div className="px-4 py-3 border-b border-outline-variant bg-surface-container-lowest flex items-center justify-between">
      <h2 className="text-sm font-bold text-on-surface flex items-center gap-1.5"><span className="material-symbols-outlined text-error text-[18px]">warning</span> Học sinh cần xem lại</h2>
      <span className="text-xs text-on-surface-variant">Tiến độ dưới 50%</span>
     </div>
     <div className="divide-y divide-outline-variant">
      {attention.slice(0,6).map(student=>(
       <div key={student.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest">
        <div className="flex items-center gap-3 min-w-0">
         <span className="w-8 h-8 rounded-full bg-error-container/40 text-on-error-container flex items-center justify-center text-xs font-bold shrink-0">{student.name.split(/\s+/).slice(-2).map(part=>part[0]).join("").toUpperCase()}</span>
         <div className="min-w-0">
          <p className="text-sm font-medium text-on-surface truncate">{student.name}</p>
          <p className="text-[11px] text-on-surface-variant truncate">@{student.username} · {student.items.filter(item=>item.status==="COMPLETED").length}/{student.items.length} lượt bài hoàn thành</p>
         </div>
        </div>
        <strong className="text-error text-sm shrink-0">{student.average}%</strong>
       </div>
      ))}
     </div>
     {!attention.length&&<EmptyState text="Không có học sinh nào dưới ngưỡng cần chú ý."/>}
    </section>
   </div>
  </div>
 );})()}
 {mode==="grading"&&<section className="audit-panel"><div className="panel-head"><div><p className="eyebrow">BÀI NỘP THEO TIẾN ĐỘ</p><h2>{selectedClass?.name??"Chọn lớp"}</h2></div></div>{rows.length?<div className="operation-table"><table><thead><tr><th>Học sinh</th><th>Bài tập</th><th>Trạng thái</th><th>Hoàn thành</th></tr></thead><tbody>{rows.map(row=><tr key={`${row.student_id}-${row.assignment_id}`}><td><b>{row.full_name}</b><small>@{row.username}</small></td><td>{row.title}</td><td><span className={`status-chip status-${row.status.toLowerCase()}`}>{row.status==="COMPLETED"?"Đã hoàn thành":row.status==="IN_PROGRESS"?"Đang làm":"Chưa mở"}</span></td><td>{row.completion_percent}%</td></tr>)}</tbody></table></div>:<EmptyState text="Chưa có bài nộp trong lớp này."/>}</section>}
 {mode==="tasks"&&<section className="operation-feed"><h2>Việc cần làm</h2>{overdue.map(item=><article className="urgent" key={item.id}><span>Quá hạn</span><div><b>Kiểm tra tiến độ: {item.title}</b><small>Hạn {new Date(item.dueAt!).toLocaleString("vi-VN")} · {selectedClass?.name}</small></div></article>)}{upcoming.map(item=><article key={item.id}><span>Sắp tới</span><div><b>Theo dõi: {item.title}</b><small>Hạn {new Date(item.dueAt!).toLocaleString("vi-VN")} · {selectedClass?.name}</small></div></article>)}{!overdue.length&&!upcoming.length&&<EmptyState text="Không có nhiệm vụ theo hạn bài tập."/>}</section>}
 {mode==="notifications"&&(()=>{
  const items=[
   ...overdue.map(item=>({key:`due-${item.id}`,tone:"error" as const,icon:"schedule",title:`Bài "${item.title}" đã quá hạn`,sub:`${selectedClass?.name??""} · Hạn ${new Date(item.dueAt!).toLocaleString("vi-VN")}`})),
   ...(average<50&&rows.length>0?[{key:"avg-low",tone:"warning" as const,icon:"trending_down",title:"Tiến độ trung bình của lớp đang dưới 50%",sub:`${selectedClass?.name??""} · Hiện tại ${average}%`}]:[]),
   ...(completed>0?[{key:"completed",tone:"secondary" as const,icon:"task_alt",title:`${completed} lượt bài đã hoàn thành`,sub:"Dữ liệu cập nhật từ sổ điểm"}]:[]),
  ];
  const toggleRead=(key:string)=>setReadKeys(current=>{const next=new Set(current);if(next.has(key))next.delete(key);else next.add(key);return next});
  const unreadCount=items.filter(item=>!readKeys.has(item.key)).length;
  const toneClasses={error:"bg-error-container/60 text-error",warning:"bg-tertiary-container text-on-tertiary-container",secondary:"bg-secondary/15 text-secondary"} as const;
  return (
   <div className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
     <div className="flex items-center gap-2">
      <h2 className="text-sm font-bold text-on-surface">Cập nhật mới nhất</h2>
      {unreadCount>0&&<span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-on-primary text-[11px] font-bold">{unreadCount}</span>}
     </div>
     <div className="flex items-center gap-2 flex-wrap">
      <button type="button" onClick={()=>setReadKeys(new Set(items.map(item=>item.key)))} disabled={!unreadCount} className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant flex items-center gap-1.5 hover:bg-surface-container-low disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
       <span className="material-symbols-outlined text-[16px]">done_all</span> Đánh dấu tất cả đã đọc
      </button>
      <button type="button" disabled title="Hệ thống chưa có API nhắn tin lớp học." className="h-8 px-3 rounded-lg bg-primary text-on-primary text-xs font-semibold opacity-50 cursor-not-allowed flex items-center gap-1.5">
       <span className="material-symbols-outlined text-[16px]">forum</span> Nhắn cả lớp
      </button>
     </div>
    </div>
    {items.length?(
     <div className="flex flex-col gap-2">
      {items.map(item=>{
       const isRead=readKeys.has(item.key);
       return (
        <article key={item.key} onClick={()=>toggleRead(item.key)} role="button" tabIndex={0} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggleRead(item.key)}}} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${isRead?"border-outline-variant bg-surface-container-lowest opacity-70":"border-primary/30 bg-primary-container/10"}`}>
         <span className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${toneClasses[item.tone]}`}>
          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
         </span>
         <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-on-surface">{item.title}</p>
          <p className="text-[11px] text-on-surface-variant mt-0.5">{item.sub}</p>
         </div>
         {!isRead&&<span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5"/>}
        </article>
       );
      })}
     </div>
    ):<EmptyState text="Hiện chưa có thông báo mới."/>}
   </div>
  );
 })()}
 </section>
}
