import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getEnrollments, getAvailableStudents, addEnrollment, removeEnrollment, getStudentProgress, resetUserPassword, type AuthSession, type Classroom, type Progress } from "../api";

export function TeacherRoster({session,classes,fixedClassId}:{session:AuthSession;classes:Classroom[];fixedClassId?:number}){
 const queryClient=useQueryClient();
 const [classId,setClassId]=useState(fixedClassId??classes[0].id),[studentId,setStudentId]=useState(0),[search,setSearch]=useState("");
 const [progress,setProgress]=useState<{name:string;items:Progress[]}|null>(null);
 useEffect(()=>{if(fixedClassId!=null)setClassId(fixedClassId)},[fixedClassId]);
 const rosterQuery=useQuery({queryKey:["teacher-roster",session.accessToken,classId,search],queryFn:async()=>{const [enrolled,candidates]=await Promise.all([getEnrollments(session,"class-students",classId),getAvailableStudents(session,search)]);return {students:enrolled,available:candidates}}});
 const students=rosterQuery.data?.students??[],available=rosterQuery.data?.available??[];
 const invalidate=()=>queryClient.invalidateQueries({queryKey:["teacher-roster"]});
 const addMutation=useMutation({mutationFn:(id:number)=>addEnrollment(session,"class-students",{classId,userId:id}),onSuccess:invalidate});
 const removeMutation=useMutation({mutationFn:(id:number)=>removeEnrollment(session,"class-students",id),onSuccess:invalidate});
 return (
  <section className="flex flex-col gap-4">
   <div className="flex items-center justify-between gap-3 flex-wrap">
    <h3 className="text-base font-bold text-on-surface">Học sinh trong lớp</h3>
    {fixedClassId==null && (
     <select value={classId} onChange={e=>setClassId(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
      {classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}
     </select>
    )}
   </div>
   <div className="flex items-center gap-2 flex-wrap">
    <input placeholder="Tìm học sinh" value={search} onChange={e=>setSearch(e.target.value)} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface flex-1 min-w-[160px]"/>
    <select value={studentId} onChange={e=>setStudentId(Number(e.target.value))} className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
     <option value={0}>Chọn học sinh…</option>
     {available.map(x=><option key={x.id} value={x.id}>{x.fullName} (@{x.username})</option>)}
    </select>
    <button onClick={()=>{if(studentId)addMutation.mutate(studentId)}} className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity">Thêm vào lớp</button>
   </div>
   <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
    {students.map(x=>{
     const initials=(x.label||"?").trim().split(/\s+/).filter(Boolean).slice(-2).map(part=>part[0]).join("").toUpperCase();
     return (
      <div key={x.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
       <div className="flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold shrink-0">{initials||"?"}</div>
        <p className="text-sm text-on-surface truncate">{x.label}</p>
       </div>
       <div className="flex items-center gap-1 shrink-0">
        <button onClick={async()=>{if(x.userId)setProgress({name:x.label,items:await getStudentProgress(session,x.userId)})}} className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors">Tiến độ</button>
        <button onClick={async()=>{if(!x.userId)return;const password=prompt(`Mật khẩu mới cho ${x.label}`);if(password)await resetUserPassword(session,x.userId,password)}} className="px-2.5 py-1.5 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded transition-colors">Reset MK</button>
        <button onClick={()=>removeMutation.mutate(x.id)} className="px-2.5 py-1.5 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors">Gỡ</button>
       </div>
      </div>
     );
    })}
    {!students.length && <p className="text-sm text-on-surface-variant text-center py-8">Lớp chưa có học sinh.</p>}
   </div>
   {progress && (
    <div className="border border-outline-variant rounded-lg p-4 bg-surface-container-lowest">
     <div className="flex items-center justify-between mb-3">
      <h4 className="text-sm font-bold text-on-surface">Tiến độ bài học · {progress.name}</h4>
      <button onClick={()=>setProgress(null)} className="text-xs text-on-surface-variant hover:text-on-surface">Đóng</button>
     </div>
     <div className="flex flex-col gap-2">
      {progress.items.map(x=>(
       <div key={x.id} className="flex items-center justify-between text-sm">
        <b className="text-on-surface">Bài học #{x.lessonId}</b>
        <span className="text-on-surface-variant">{x.completedAt?"Đã hoàn thành":x.openedAt?"Đang học":"Chưa mở"} · {x.completionPercent}%</span>
       </div>
      ))}
      {!progress.items.length && <p className="text-sm text-on-surface-variant">Học sinh chưa có tiến độ bài học.</p>}
     </div>
    </div>
   )}
  </section>
 );
}
