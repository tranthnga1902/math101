import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getGrades, getAssignments, getGradebook, getEnrollments, createClass, updateClass, deleteClass, type AuthSession, type Classroom, type ClassroomInput } from "../api";
import { useMetadata, metadataOptions, firstMetadataValue } from "../hooks/useMetadata";
import { messageOf } from "../lib/errors";
import { EmptyState } from "../components/common";

export function TeacherClassManager({session,classes,onChanged,selectedClassId,onSelectClass}:{session:AuthSession;classes:Classroom[];onChanged:()=>Promise<void>;selectedClassId?:number|null;onSelectClass?:(classroom:Classroom)=>void}){
 const metadata=useMetadata(session);
 const queryClient=useQueryClient();
 const [editing,setEditing]=useState<Classroom|null>(null),[form,setForm]=useState({code:"",name:"",gradeId:0,status:""}),[formOpen,setFormOpen]=useState(false);
 const gradesQuery=useQuery({queryKey:["teacher-class-manager-grades",session.accessToken],queryFn:()=>getGrades(session)});
 const grades=gradesQuery.data??[];
 const classIdsKey=classes.map(item=>item.id).join(",");
 const metricsQuery=useQuery({queryKey:["teacher-class-manager-metrics",session.accessToken,classIdsKey],queryFn:async()=>{const values=await Promise.all(classes.map(async classroom=>{const [assignments,book,enrolled]=await Promise.all([getAssignments(session,classroom.id),getGradebook(session,classroom.id),getEnrollments(session,"class-students",classroom.id)]);const byStudent=Array.from(new Set(book.map(row=>row.student_id))).map(id=>{const own=book.filter(row=>row.student_id===id);return own.length?own.reduce((sum,row)=>sum+(Number(row.completion_percent)||0),0)/own.length:0});return [classroom.id,{studentCount:enrolled.length,openTasks:assignments.filter(item=>item.status==="PUBLISHED").length,average:book.length?Math.round(book.reduce((sum,row)=>sum+(Number(row.completion_percent)||0),0)/book.length):0,attention:byStudent.filter(value=>value<50).length}] as const}));return Object.fromEntries(values) as Record<number,{studentCount:number;openTasks:number;average:number;attention:number}>},enabled:classes.length>0});
 const metrics=metricsQuery.data??{};
 const invalidateMetrics=()=>queryClient.invalidateQueries({queryKey:["teacher-class-manager-metrics"]});
 const createMutation=useMutation({mutationFn:(input:ClassroomInput)=>createClass(session,input),onSuccess:async()=>{invalidateMetrics();await onChanged()}});
 const updateMutation=useMutation({mutationFn:({id,input}:{id:number;input:ClassroomInput})=>updateClass(session,id,input),onSuccess:async()=>{invalidateMetrics();await onChanged()}});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteClass(session,id),onSuccess:async()=>{invalidateMetrics();await onChanged()}});
 const error=gradesQuery.isError?messageOf(gradesQuery.error):metricsQuery.isError?messageOf(metricsQuery.error):createMutation.isError?messageOf(createMutation.error):updateMutation.isError?messageOf(updateMutation.error):deleteMutation.isError?messageOf(deleteMutation.error):"";
 useEffect(()=>{if(grades[0])setForm(value=>({...value,gradeId:value.gradeId||grades[0].id}))},[grades]);
 useEffect(()=>{if(!editing)setForm(current=>({...current,status:current.status||firstMetadataValue(metadata,"classStatuses")}))},[editing,metadata]);
 const reset=()=>{setEditing(null);setFormOpen(false);setForm({code:"",name:"",gradeId:grades[0]?.id||0,status:firstMetadataValue(metadata,"classStatuses")})};
  const save=async(e:React.FormEvent)=>{e.preventDefault();try{if(editing)await updateMutation.mutateAsync({id:editing.id,input:form as ClassroomInput});else await createMutation.mutateAsync(form as ClassroomInput);reset()}catch{/* lỗi đã có trong mutation state */}};
 return (
  <section className="flex flex-col gap-4">
   <header className="flex items-center justify-between gap-4 flex-wrap">
    <div>
     <h1 className="text-2xl font-bold text-on-surface">Lớp học</h1>
     <p className="text-sm text-on-surface-variant">Quản lý danh sách lớp và xem chi tiết học sinh, nhiệm vụ, sổ điểm theo từng lớp.</p>
    </div>
    <button onClick={()=>{reset();setFormOpen(true)}} className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold flex items-center gap-1.5 hover:opacity-90 transition-opacity">
     <span className="material-symbols-outlined text-[18px]">add</span> Thêm lớp học
    </button>
   </header>
   {error && <div className="api-error">{error}</div>}
   <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {classes.map(item=>{
     const stat=metrics[item.id]??{studentCount:0,openTasks:0,average:0,attention:0};
     const isSelected=selectedClassId===item.id;
     return (
      <article key={item.id} role="button" tabIndex={0} aria-label={`Mở chi tiết lớp ${item.name}`} onClick={()=>onSelectClass?.(item)} onKeyDown={event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();onSelectClass?.(item)}}} className={`group p-5 rounded-xl border bg-surface-container-lowest flex flex-col cursor-pointer transition-all hover:shadow-md focus-visible:outline-2 focus-visible:outline-primary ${isSelected?"border-primary ring-1 ring-primary":"border-outline-variant hover:border-primary/50"}`}>
       <div className="flex items-start justify-between gap-3">
         <div className="min-w-0"><h3 className="text-lg font-bold text-on-surface truncate">{item.name}</h3><p className="mt-1 text-xs text-on-surface-variant truncate">{item.code} · {grades.find(grade=>grade.id===item.gradeId)?.name??(item.gradeId!=null?`Khối #${item.gradeId}`:"—")}</p></div>
         <button aria-label={`Chỉnh sửa lớp ${item.name}`} onClick={event=>{event.stopPropagation();setEditing(item);setForm({code:item.code,name:item.name,gradeId:item.gradeId,status:item.status});setFormOpen(true)}} className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-low transition-colors">
          <span className="material-symbols-outlined text-[19px]">more_vert</span>
         </button>
       </div>
       <dl className="grid grid-cols-2 gap-x-6 gap-y-4 py-5 my-4 border-y border-outline-variant text-xs">
        <div><dt className="text-on-surface-variant">Sĩ số</dt><dd className="mt-1 text-base font-bold text-on-surface data-tabular">{stat.studentCount}</dd></div>
        <div><dt className="text-on-surface-variant">Nhiệm vụ mở</dt><dd className="mt-1 text-base font-bold text-on-surface data-tabular">{stat.openTasks}</dd></div>
        <div><dt className="text-on-surface-variant">Tiến độ TB</dt><dd className="mt-1 text-base font-bold text-on-surface data-tabular">{stat.average}%</dd></div>
        <div><dt className="text-on-surface-variant">Cần chú ý</dt><dd className={`mt-1 text-base font-bold data-tabular ${stat.attention?"text-error":"text-on-surface"}`}>{stat.attention} <small className="text-xs font-medium">hs</small></dd></div>
       </dl>
       <footer className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-semibold ${item.status==="ACTIVE"?"text-primary":"text-on-surface-variant"}`}>{item.status==="ACTIVE"?"Đang hoạt động":item.status}</span>
        <div className="flex items-center gap-4"><button className="text-error text-xs font-semibold hover:underline" onClick={event=>{event.stopPropagation();if(confirm(`Xóa lớp “${item.name}”?`))deleteMutation.mutate(item.id)}}>Xóa</button><span className="material-symbols-outlined text-[18px] text-primary group-hover:translate-x-0.5 transition-transform">arrow_forward</span></div>
       </footer>
      </article>
     );
    })}
   </div>
   {!classes.length && <EmptyState text="Chưa có lớp học."/>}
   {formOpen&&<div className="dialog-backdrop"><section className="dialog-card"><div className="panel-head"><div><p className="eyebrow">{editing?"CHỈNH SỬA LỚP":"THÊM LỚP HỌC"}</p><h2>{editing?editing.name:"Lớp học mới"}</h2></div><button onClick={reset}>Đóng</button></div><form className="live-form" onSubmit={save}><label>Mã lớp<input required placeholder="Ví dụ: 10A1" value={form.code} onChange={e=>setForm({...form,code:e.target.value})}/></label><label>Tên lớp<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Khối<select required value={form.gradeId} onChange={e=>setForm({...form,gradeId:Number(e.target.value)})}>{grades.map(grade=><option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label><label>Trạng thái<select required value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{metadataOptions(metadata,"classStatuses").map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="live-actions"><button type="button" onClick={reset}>Hủy</button><button className="primary">{editing?"Lưu thay đổi":"Tạo lớp"}</button></div></form></section></div>}
  </section>
 );
}
