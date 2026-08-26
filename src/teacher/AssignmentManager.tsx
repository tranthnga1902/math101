import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorksheets, getAssignments, saveAssignment, type AuthSession, type Classroom } from "../api";
import { messageOf } from "../lib/errors";

export function AssignmentManager({session,classes}:{session:AuthSession;classes:Classroom[]}){
 const queryClient=useQueryClient();
 const [classId,setClassId]=useState(classes[0].id);
 const [form,setForm]=useState({title:"",worksheetId:0,dueAt:"",status:"PUBLISHED"});
 const dataQuery=useQuery({queryKey:["assignment-manager",session.accessToken,classId],queryFn:async()=>{const [w,a]=await Promise.all([getWorksheets(session),getAssignments(session,classId)]);return {worksheets:w,rows:a}}});
 const worksheets=dataQuery.data?.worksheets??[],rows=dataQuery.data?.rows??[];
 const saveMutation=useMutation({mutationFn:(input:Parameters<typeof saveAssignment>[1])=>saveAssignment(session,input),onSuccess:()=>queryClient.invalidateQueries({queryKey:["assignment-manager"]})});
 const error=dataQuery.isError?messageOf(dataQuery.error):saveMutation.isError?messageOf(saveMutation.error):"";
 const save=async(e:React.FormEvent)=>{e.preventDefault();try{await saveMutation.mutateAsync({classId,lessonId:null,worksheetId:form.worksheetId,title:form.title,dueAt:form.dueAt||null,status:form.status});setForm({title:"",worksheetId:0,dueAt:"",status:"PUBLISHED"})}catch{/* lỗi đã có trong mutation state */}};
 return <section className="audit-panel"><h2>Giao phiếu bài tập</h2>{error&&<div className="api-error">{error}</div>}<form className="compact-form assignment-form" onSubmit={save}><select value={classId} onChange={e=>setClassId(Number(e.target.value))}>{classes.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><input required placeholder="Tên bài giao" value={form.title} onChange={e=>setForm({...form,title:e.target.value})}/><select required value={form.worksheetId} onChange={e=>setForm({...form,worksheetId:Number(e.target.value)})}><option value={0}>Chọn phiếu…</option>{worksheets.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select><input type="datetime-local" value={form.dueAt} onChange={e=>setForm({...form,dueAt:e.target.value})}/><button className="primary">Giao bài</button></form>{rows.map(x=><div className="live-row" key={x.id}><div><b>{x.title}</b><small>{x.status} · {x.dueAt?new Date(x.dueAt).toLocaleString("vi-VN"):"Không hạn"}</small></div><span>Phiếu #{x.worksheetId}</span></div>)}</section>
}
