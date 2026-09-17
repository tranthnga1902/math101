import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProgramResources, openDocumentFile, type AuthSession, type ProgramResource, type StudentCourse } from "../api";
import { Button } from "../components/ui/button";
import { DocumentPreview } from "../components/DocumentPreview";

const tabs: Array<["ALL" | ProgramResource["resource_type"], string]> = [
  ["ALL", "Tổng quan"], ["VIDEO", "Video"], ["DOCUMENT", "Tài liệu"],
  ["EXERCISE", "Bài tập"], ["SPECIAL_TOPIC", "Chuyên đề"],
];
const icons: Record<ProgramResource["resource_type"], string> = { VIDEO:"play_circle", DOCUMENT:"description", EXERCISE:"edit_note", SPECIAL_TOPIC:"folder_special" };
const videoUrl = (row: ProgramResource) => {
  if (row.resource_type !== "VIDEO" || !row.video_url) return null;
  try {
    const url = new URL(row.video_url);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

export function ChapterDetailPage({session,course,chapterId,onBack,onOpenLesson}:{session:AuthSession;course:StudentCourse;chapterId:number;onBack:()=>void;onOpenLesson:(id:number)=>void}) {
  const [tab,setTab]=useState<(typeof tabs)[number][0]>("ALL");
  const [openError,setOpenError]=useState("");
  const chapter=course.chapters.find(row=>row.id===chapterId);
  const query=useQuery({queryKey:["program-resources",session.accessToken,course.id,"chapter",chapterId],queryFn:()=>getProgramResources(session,course.id)});
  const rows=useMemo(()=>(query.data??[]).filter(row=>row.chapter_id===chapterId && (tab==="ALL"||row.resource_type===tab)).sort((a,b)=>a.order_index-b.order_index),[query.data,chapterId,tab]);
  if(!chapter)return <div className="rounded-xl border border-outline-variant p-6">Không tìm thấy chương.</div>;
  return <div className="space-y-5">
    <button type="button" onClick={onBack} className="text-sm font-medium text-primary">← Chương trình học</button>
    <header className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5"><small className="text-on-surface-variant">Chương {chapter.orderIndex}</small><h2 className="text-2xl font-bold">{chapter.title}</h2><p className="mt-2 text-sm text-on-surface-variant">{chapter.lessons.length} bài học · nội dung sắp theo luồng chương trình</p></header>
    <div className="flex flex-wrap gap-2" role="tablist">{tabs.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} onClick={()=>setTab(key)} className={`h-9 rounded-lg px-4 text-sm ${tab===key?"bg-primary text-on-primary":"border border-outline-variant bg-surface-container-lowest"}`}>{label}</button>)}</div>
    {query.error&&<div className="rounded-lg bg-error-container p-4 text-sm text-on-error-container">{(query.error as Error).message}</div>}
    {openError&&<p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-error">{openError}</p>}
    {query.isLoading&&<div aria-label="Đang tải học liệu" className="h-40 rounded-xl bg-surface-container animate-pulse"/>}
    <div className="space-y-3">{rows.map((row,index)=>{const href=videoUrl(row);return <article key={row.id} className="flex flex-wrap sm:flex-nowrap items-start gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 hover:border-primary/40 transition-colors"><b className="w-6 shrink-0 text-center text-primary font-bold pt-1">{index+1}</b><DocumentPreview fileUrl={row.resource_type==="VIDEO"?row.video_url:row.file_url} thumbnailUrl={row.thumbnail_url} title={row.title} docType={row.doc_type||row.resource_type} accessToken={session.accessToken} variant="compact" className="w-14 h-18 cursor-pointer shadow-xs" onClick={row.resource_type==="DOCUMENT"&&row.file_url?()=>{setOpenError("");void openDocumentFile(session,row.file_url!,row.title).catch(reason=>setOpenError(reason instanceof Error?reason.message:"Không thể mở tài liệu."));}:undefined}/><div className="min-w-0 flex-1"><h3 title={row.title} className="text-sm font-semibold line-clamp-2 break-words text-on-surface">{row.title}</h3><small className="block mt-1 text-on-surface-variant">{row.resource_type==="DOCUMENT"?"Tài liệu":row.resource_type==="VIDEO"?"Video":row.resource_type==="EXERCISE"?"Bài tập":"Chuyên đề"}</small></div>{row.resource_type==="DOCUMENT"&&<Button variant="outline" size="sm" disabled={!row.file_url} onClick={()=>{setOpenError("");void openDocumentFile(session,row.file_url!,row.title).catch(reason=>setOpenError(reason instanceof Error?reason.message:"Không thể mở tài liệu."));}}>{row.file_url?"Xem tài liệu":"Chưa có tệp"}</Button>}{href&&<a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary"><span className="material-symbols-outlined text-[18px]">play_arrow</span>Xem</a>}</article>;})}</div>
    {!rows.length&&!query.isLoading&&<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">Chưa có nội dung đã xuất bản trong mục này.</div>}
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5"><h3 className="font-semibold">Các bài học</h3><div className="mt-3 grid gap-2">{chapter.lessons.map(lesson=><button key={lesson.id} type="button" onClick={()=>onOpenLesson(lesson.id)} className="rounded-lg border border-outline-variant p-3 text-left text-sm hover:border-primary">Bài {lesson.orderIndex}: <b>{lesson.title}</b></button>)}</div></section>
  </div>;
}
