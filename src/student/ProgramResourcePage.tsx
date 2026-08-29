import { useQuery } from "@tanstack/react-query";
import { getMyCourses, getProgramResources, type AuthSession, type ProgramResource } from "../api";

const labels: Record<ProgramResource["resource_type"], string> = { VIDEO:"Video", DOCUMENT:"Tài liệu", EXERCISE:"Bài tập", SPECIAL_TOPIC:"Chuyên đề" };
const icons: Record<ProgramResource["resource_type"], string> = { VIDEO:"play_circle", DOCUMENT:"description", EXERCISE:"edit_note", SPECIAL_TOPIC:"folder_special" };

const safeExternalUrl = (value?: string | null) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
};

const formatDuration = (seconds?: number | null) => {
  if (!seconds) return null;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
};

export function ProgramResourcePage({session,type}:{session:AuthSession;type:ProgramResource["resource_type"]}) {
  const courses=useQuery({queryKey:["student-courses",session.userId],queryFn:()=>getMyCourses(session)});
  const programId=courses.data?.[0]?.id;
  const resources=useQuery({queryKey:["program-resources",programId,type],queryFn:()=>getProgramResources(session,programId!,type),enabled:!!programId});
  if(courses.error||resources.error)return <div className="rounded-xl bg-error-container p-4 text-sm text-on-error-container">{((courses.error||resources.error) as Error).message}</div>;
  const rows=resources.data??[];
  const groups=(["CURRENT","UPCOMING","PAST"] as const).map(key=>({key,rows:rows.filter(row=>row.time_group===key)})).filter(group=>group.rows.length);
  return <div className="space-y-6">
    <header><p className="text-sm text-on-surface-variant">Nội dung chính thức của chương trình</p><h2 className="text-xl font-bold">{labels[type]}</h2></header>
    {!rows.length&&<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">Chưa có {labels[type].toLowerCase()} được xuất bản trong chương trình.</div>}
    {groups.map(group=><section key={group.key} className="space-y-3"><h3 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">{group.key==="CURRENT"?"Đang học":group.key==="UPCOMING"?"Sắp học":"Đã học"}</h3><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{group.rows.map(row=>{
      const videoUrl=type==="VIDEO"?safeExternalUrl(row.video_url):null;
      const duration=formatDuration(row.duration_seconds);
      return <article key={row.id} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
        {type==="VIDEO"&&row.thumbnail_url&&<div className="aspect-video bg-surface-container"><img src={row.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy"/></div>}
        <div className="p-4"><span className="material-symbols-outlined text-primary">{icons[type]}</span><h4 className="mt-2 font-semibold">{row.title}</h4><p className="mt-1 text-xs text-on-surface-variant">Chương {row.chapter_order} · Thứ tự {row.order_index}{duration?` · ${duration}`:""}</p>
          {type==="VIDEO"&&(videoUrl?<a href={videoUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary"><span className="material-symbols-outlined text-[19px]">play_arrow</span>Xem video</a>:<p className="mt-3 text-xs text-error">Video chưa có đường dẫn xem hợp lệ.</p>)}
        </div>
      </article>;
    })}</div></section>)}
  </div>;
}
