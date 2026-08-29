import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getProgramResources, type AuthSession, type ProgramResource, type StudentCourse } from "../api";

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
  const chapter=course.chapters.find(row=>row.id===chapterId);
  const query=useQuery({queryKey:["program-resources",course.id,"chapter",chapterId],queryFn:()=>getProgramResources(session,course.id)});
  const rows=useMemo(()=>(query.data??[]).filter(row=>row.chapter_id===chapterId && (tab==="ALL"||row.resource_type===tab)).sort((a,b)=>a.order_index-b.order_index),[query.data,chapterId,tab]);
  if(!chapter)return <div className="rounded-xl border border-outline-variant p-6">Không tìm thấy chương.</div>;
  return <div className="space-y-5">
    <button type="button" onClick={onBack} className="text-sm font-medium text-primary">← Chương trình học</button>
    <header className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5"><small className="text-on-surface-variant">Chương {chapter.orderIndex}</small><h2 className="text-2xl font-bold">{chapter.title}</h2><p className="mt-2 text-sm text-on-surface-variant">{chapter.lessons.length} bài học · nội dung sắp theo luồng chương trình</p></header>
    <div className="flex flex-wrap gap-2" role="tablist">{tabs.map(([key,label])=><button key={key} type="button" role="tab" aria-selected={tab===key} onClick={()=>setTab(key)} className={`h-9 rounded-lg px-4 text-sm ${tab===key?"bg-primary text-on-primary":"border border-outline-variant bg-surface-container-lowest"}`}>{label}</button>)}</div>
    {query.error&&<div className="rounded-lg bg-error-container p-4 text-sm text-on-error-container">{(query.error as Error).message}</div>}
    <div className="space-y-3">{rows.map((row,index)=>{const href=videoUrl(row);return <article key={row.id} className="flex items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4"><b className="w-7 text-center text-primary">{index+1}</b><span className="material-symbols-outlined text-primary">{icons[row.resource_type]}</span><div className="min-w-0 flex-1"><h3 className="font-semibold">{row.title}</h3><small className="text-on-surface-variant">{row.resource_type} · thứ tự {row.order_index}</small></div>{href&&<a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1 rounded-lg bg-primary px-3 text-sm font-semibold text-on-primary"><span className="material-symbols-outlined text-[18px]">play_arrow</span>Xem</a>}</article>;})}</div>
    {!rows.length&&!query.isLoading&&<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">Chưa có nội dung đã xuất bản trong mục này.</div>}
    <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-5"><h3 className="font-semibold">Các bài học</h3><div className="mt-3 grid gap-2">{chapter.lessons.map(lesson=><button key={lesson.id} type="button" onClick={()=>onOpenLesson(lesson.id)} className="rounded-lg border border-outline-variant p-3 text-left text-sm hover:border-primary">Bài {lesson.orderIndex}: <b>{lesson.title}</b></button>)}</div></section>
  </div>;
}
