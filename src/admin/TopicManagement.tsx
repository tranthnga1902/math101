import {useMemo,useState} from "react";
import {useMutation,useQuery,useQueryClient} from "@tanstack/react-query";
import {deleteTopic,getChapters,getCourses,getLessons,getProblemTypes,getProblems,getTopics,saveTopic,type AuthSession,type Chapter,type Course,type Lesson,type Topic} from "../api";
import "./topic-management.css";
type Stats={types:number;problems:number;published:number};
const message=(x:unknown)=>x instanceof Error?x.message:"Không thể thực hiện thao tác";
const TOPICS_QUERY_KEY="admin-topics-overview";
export function TopicManagement({session}:{session:AuthSession}){
 const queryClient=useQueryClient();
 const [open,setOpen]=useState<number[]>([]),[search,setSearch]=useState(""),[editing,setEditing]=useState<Topic|null>(null),[modal,setModal]=useState(false);
 const overviewQuery=useQuery({queryKey:[TOPICS_QUERY_KEY,session.accessToken],queryFn:async()=>{
  const [courseRows,topicRows]=await Promise.all([getCourses(session),getTopics(session)]);
  const chapterEntries=await Promise.all(courseRows.map(async c=>[c.id,await getChapters(session,c.id)] as const));
  const allChapters=chapterEntries.flatMap(([,items])=>items);
  const lessonEntries=await Promise.all(allChapters.map(async c=>[c.id,await getLessons(session,c.id)] as const));
  const statEntries=await Promise.all(topicRows.map(async topic=>{const types=await getProblemTypes(session,topic.id);const problems=(await Promise.all(types.map(type=>getProblems(session,type.id)))).flat();return [topic.id,{types:types.length,problems:problems.length,published:problems.filter(p=>p.status==="PUBLISHED").length}] as const}));
  return {
   courses:courseRows as Course[],
   chapters:Object.fromEntries(chapterEntries) as Record<number,Chapter[]>,
   lessons:Object.fromEntries(lessonEntries) as Record<number,Lesson[]>,
   topics:topicRows as Topic[],
   stats:Object.fromEntries(statEntries) as Record<number,Stats>,
  };
 }});
 const courses=overviewQuery.data?.courses??[];
 const chapters=overviewQuery.data?.chapters??{};
 const lessons=overviewQuery.data?.lessons??{};
 const topics=overviewQuery.data?.topics??[];
 const stats=overviewQuery.data?.stats??{};
 const invalidate=()=>queryClient.invalidateQueries({queryKey:[TOPICS_QUERY_KEY]});
 const deleteMutation=useMutation({mutationFn:(id:number)=>deleteTopic(session,id),onSuccess:invalidate});
 const error=overviewQuery.isError?message(overviewQuery.error):deleteMutation.isError?message(deleteMutation.error):"";
 const visible=useMemo(()=>topics.filter(x=>x.name.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))),[topics,search]);
 const exportCsv=()=>{const body=[["STT","Tên chuyên đề","Dạng bài","Câu hỏi","Đã xuất bản"],...visible.map((t,i)=>[i+1,t.name,stats[t.id]?.types??0,stats[t.id]?.problems??0,stats[t.id]?.published??0])].map(row=>row.map(value=>`"${String(value).replaceAll('"','""')}"`).join(",")).join("\r\n");const a=document.createElement("a");a.href=URL.createObjectURL(new Blob(["﻿"+body],{type:"text/csv;charset=utf-8"}));a.download="chuyen-de-toan.csv";a.click();URL.revokeObjectURL(a.href)};
 return <section className="topic-page"><aside><header><h2>Cấu trúc Môn Toán</h2></header><div className="topic-tree">{courses.map(course=><div key={course.id}><button className="course-node" onClick={()=>setOpen(x=>x.includes(course.id)?x.filter(id=>id!==course.id):[...x,course.id])}><span>{open.includes(course.id)?"⌄":"›"}</span><b>{course.name}</b></button>{open.includes(course.id)&&<div className="chapter-list">{(chapters[course.id]??[]).map(chapter=><div key={chapter.id}><span className="chapter-node">▸ {chapter.title}</span>{(lessons[chapter.id]??[]).map(lesson=><span className="lesson-node" key={lesson.id}>▹ {lesson.title}</span>)}</div>)}</div>}</div>)}</div></aside><main><header><div><h1>Tổng quan {visible.length} Chuyên đề</h1><input placeholder="Tìm kiếm chuyên đề, bài học…" value={search} onChange={e=>setSearch(e.target.value)}/></div><div><button onClick={exportCsv}>Xuất Excel</button><button className="topic-primary" onClick={()=>{setEditing(null);setModal(true)}}>+ Tạo chuyên đề</button></div></header>{error&&<div className="api-error">{error}</div>}<div className="topic-table"><table><thead><tr><th>STT</th><th>Tên chuyên đề</th><th>Bài học</th><th>Dạng bài</th><th>Câu hỏi</th><th>Tài liệu</th><th>Trang SGK</th><th>Trạng thái</th><th></th></tr></thead><tbody>{visible.map((topic,index)=>{const value=stats[topic.id]??{types:0,problems:0,published:0},empty=!value.types&&!value.problems;return <tr className={empty?"empty":""} key={topic.id}><td>{index+1}</td><td><b>{topic.name}</b>{empty&&<span className="topic-warning">Chưa có nội dung</span>}</td><td>—</td><td className="numeric">{value.types}</td><td className="numeric">{value.problems}</td><td>—</td><td>—</td><td><span className={`topic-status ${empty?"draft":"active"}`}>{empty?"Nháp":"Hoạt động"}</span></td><td><button onClick={()=>{setEditing(topic);setModal(true)}}>Sửa</button><button className="danger" onClick={()=>{if(confirm(`Xóa chuyên đề “${topic.name}”?`))deleteMutation.mutate(topic.id)}}>Xóa</button></td></tr>})}</tbody></table></div></main>{modal&&<TopicModal session={session} topic={editing} onClose={()=>setModal(false)} onDone={async()=>{setModal(false);await invalidate()}}/>}</section>;
}
function TopicModal({session,topic,onClose,onDone}:{session:AuthSession;topic:Topic|null;onClose:()=>void;onDone:()=>Promise<void>}){const [name,setName]=useState(topic?.name??""),[description,setDescription]=useState(topic?.description??""),[error,setError]=useState("");const submit=async(e:React.FormEvent)=>{e.preventDefault();try{await saveTopic(session,{name,description},topic?.id);await onDone()}catch(reason){setError(message(reason))}};return <div className="topic-overlay"><form className="topic-modal" onSubmit={submit}><header><h2>{topic?"Chỉnh sửa chuyên đề":"Tạo chuyên đề"}</h2><button type="button" onClick={onClose}>×</button></header><label>Tên chuyên đề<input required value={name} onChange={e=>setName(e.target.value)}/></label><label>Mô tả<textarea rows={5} value={description} onChange={e=>setDescription(e.target.value)}/></label>{error&&<div className="api-error">{error}</div>}<footer><button type="button" onClick={onClose}>Hủy</button><button className="topic-primary">Lưu</button></footer></form></div>}
