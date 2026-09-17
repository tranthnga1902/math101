import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getMyCourses, getProgramResources, openDocumentFile, type AuthSession, type ProgramBand, type ProgramResource } from "../api";
import { Button } from "../components/ui/button";
import { DocumentPreview } from "../components/DocumentPreview";

const labels: Record<ProgramResource["resource_type"], string> = { VIDEO:"Video", DOCUMENT:"Tài liệu", EXERCISE:"Bài tập", SPECIAL_TOPIC:"Chuyên đề" };
const icons: Record<ProgramResource["resource_type"], string> = { VIDEO:"play_circle", DOCUMENT:"description", EXERCISE:"edit_note", SPECIAL_TOPIC:"folder_special" };

// Bốn dải nhìn thấy, đúng thứ tự câu truy vấn trả về. TUONG_LAI cố tình vắng mặt: nó vẫn được trả
// ra và vẫn đọc được, chỉ là chỗ của nó là màn Lộ trình chứ không phải danh sách này — bày cả năm
// ra một lượt thì dải "tuần này" chìm nghỉm, mà chìm nghỉm cũng là một kiểu chặn.
const bands: Array<[ProgramBand, string, string]> = [
  ["TUAN_NAY", "Tuần này", "phần đang học"],
  ["SAP_TOI", "Sắp tới", "hai tuần tới"],
  ["LUON_HIEN", "Luôn có", "không gắn tiết nào"],
  ["DA_HOC", "Đã học", "mới nhất lên trên"],
];

// Bỏ dấu để gõ "ham so" ra được "hàm số". Chữ đ không tách dấu qua NFD nên phải thay tay.
const chuanHoa = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  .replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();

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

/** Gom theo chương, giữ nguyên thứ tự dòng mà câu truy vấn đã xếp. */
const theoChuong = (rows: ProgramResource[]) => {
  const nhom: Array<{key:string; ten:string; rows:ProgramResource[]}> = [];
  for (const row of rows) {
    const key = String(row.chapter_id ?? "khong-chuong");
    const ten = row.chapter_title ? `Chương ${row.chapter_order} · ${row.chapter_title}` : "Không thuộc chương nào";
    const cu = nhom.find(x => x.key === key);
    if (cu) cu.rows.push(row); else nhom.push({ key, ten, rows: [row] });
  }
  return nhom;
};

export function ProgramResourcePage({session,type}:{session:AuthSession;type:ProgramResource["resource_type"]}) {
  const [tim,setTim]=useState("");
  const [openError,setOpenError]=useState("");
  const [selectedProgram,setSelectedProgram]=useState<number|null>(null);
  const courses=useQuery({queryKey:["student-courses",session.userId],queryFn:()=>getMyCourses(session)});
  const programId=courses.data?.find(course=>course.id===selectedProgram)?.id??courses.data?.[0]?.id;
  const resources=useQuery({queryKey:["program-resources",session.accessToken,programId,type],queryFn:()=>getProgramResources(session,programId!,type),enabled:!!programId});
  const rows=useMemo(()=>resources.data??[],[resources.data]);
  const dangTim=tim.trim().length>0;
  // Đang tìm thì tìm khắp nơi, kể cả dải tương lai đang ẩn: người gõ tên một tài liệu là người biết
  // mình muốn gì, chặn họ ở ranh giới dải là bắt họ đoán xem thứ mình cần nằm ở tuần nào.
  const hienThi=useMemo(()=>{
    if(!dangTim)return type==="DOCUMENT"?rows:rows.filter(row=>row.dai!=="TUONG_LAI");
    const khoa=chuanHoa(tim.trim());
    return rows.filter(row=>chuanHoa(`${row.title} ${row.chapter_title??""}`).includes(khoa));
  },[rows,tim,dangTim,type]);
  if(courses.error||resources.error)return <div className="rounded-xl bg-error-container p-4 text-sm text-on-error-container">{((courses.error||resources.error) as Error).message}</div>;
  const dsBand=dangTim||type==="DOCUMENT"?([...bands,["TUONG_LAI","Các tuần tiếp theo","tài liệu để xem trước"]] as Array<[ProgramBand,string,string]>):bands;
  const groups=dsBand.map(([key,ten,goiY])=>({key,ten,goiY,rows:hienThi.filter(row=>row.dai===key)})).filter(group=>group.rows.length);

  const the = (row: ProgramResource) => {
    const videoUrl = type === "VIDEO" ? safeExternalUrl(row.video_url) : null;
    const duration = formatDuration(row.duration_seconds);
    const chuong = row.chapter_title ? `Chương ${row.chapter_order}` : "Toàn chương trình";
    const fileUrl = type === "VIDEO" ? row.video_url : row.file_url;
    const handleOpenDocument = () => {
      if (!row.file_url) return;
      setOpenError("");
      void openDocumentFile(session, row.file_url, row.title).catch(reason =>
        setOpenError(reason instanceof Error ? reason.message : "Không thể mở tài liệu.")
      );
    };

    return (
      <article key={row.id} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest flex flex-col justify-between hover:shadow-sm transition-shadow">
        <div>
          <div className="p-3 bg-surface-container-low/40 border-b border-outline-variant/40">
            <DocumentPreview
              fileUrl={fileUrl}
              thumbnailUrl={row.thumbnail_url}
              title={row.title}
              docType={row.doc_type || (type === "DOCUMENT" ? "DOCUMENT" : type === "VIDEO" ? "VIDEO" : type === "EXERCISE" ? "EXERCISE" : "SPECIAL_TOPIC")}
              accessToken={session.accessToken}
              variant="cover"
              className="w-full h-44 cursor-pointer"
              onClick={type === "DOCUMENT" && row.file_url ? handleOpenDocument : undefined}
            />
          </div>
          <div className="p-4">
            <h4 title={row.title} className="text-sm font-semibold line-clamp-2 break-words text-on-surface">
              {row.title}
            </h4>
            <p className="mt-1 text-xs text-on-surface-variant">
              {chuong}{row.tuan ? ` · Tuần ${row.tuan}` : ""}{duration ? ` · ${duration}` : ""}
            </p>
          </div>
        </div>
        <div className="px-4 pb-4">
          {type === "DOCUMENT" && (
            <Button
              className="w-full"
              variant="outline"
              disabled={!row.file_url}
              onClick={handleOpenDocument}
            >
              {row.file_url ? "Xem tài liệu" : "Chưa có tệp"}
            </Button>
          )}
          {type === "VIDEO" && (
            videoUrl ? (
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-[19px]">play_arrow</span>Xem video
              </a>
            ) : (
              <p className="mt-2 text-xs text-error">Video chưa có đường dẫn xem hợp lệ.</p>
            )
          )}
          {type !== "DOCUMENT" && type !== "VIDEO" && row.file_url && (
            <Button
              className="w-full"
              variant="outline"
              onClick={handleOpenDocument}
            >
              Xem chi tiết
            </Button>
          )}
        </div>
      </article>
    );
  };
  const luoi=(ds:ProgramResource[])=><div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">{ds.map(the)}</div>;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-sm text-on-surface-variant">Nội dung chính thức của chương trình</p><h2 className="text-xl font-bold">{labels[type]}</h2></div>
      <label className="flex h-10 w-full max-w-xs items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 md:w-auto">
        <span className="material-symbols-outlined text-[20px] text-on-surface-variant">search</span>
        <input value={tim} onChange={event=>setTim(event.target.value)} placeholder={`Tìm trong ${labels[type].toLowerCase()}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" aria-label={`Tìm ${labels[type].toLowerCase()}`}/>
        {dangTim&&<button type="button" onClick={()=>setTim("")} className="material-symbols-outlined text-[18px] text-on-surface-variant" aria-label="Xóa từ khóa">close</button>}
      </label>
    </header>
    {(courses.data?.length??0)>1&&<label className="flex flex-wrap items-center gap-3 text-sm">Chương trình<select className="max-w-full rounded-lg border border-outline-variant bg-surface-container-lowest p-2" value={programId} onChange={event=>setSelectedProgram(Number(event.target.value))}>{courses.data?.map(course=><option key={course.id} value={course.id}>{course.name}</option>)}</select></label>}
    {openError&&<p role="alert" className="rounded-lg bg-error-container p-3 text-sm text-error">{openError}</p>}
    {(courses.isLoading||resources.isLoading)&&<div aria-label="Đang tải tài liệu" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{[1,2,3].map(i=><div key={i} className="h-40 rounded-xl bg-surface-container animate-pulse"/>)}</div>}
    {!rows.length&&!courses.isLoading&&!resources.isLoading&&<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">Chưa có {labels[type].toLowerCase()} được xuất bản trong chương trình.</div>}
    {!!rows.length&&!groups.length&&<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center text-sm text-on-surface-variant">Không có mục nào khớp “{tim.trim()}”.</div>}
    {groups.map(group=><section key={group.key} className="space-y-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-on-surface-variant">{group.ten} <span className="font-normal normal-case text-on-surface-variant/70">· {group.goiY} · {group.rows.length}</span></h3>
      {/* Dải đã học phình theo cả năm học, nên nó gom theo chương và thu gọn sẵn. Đang tìm thì mở ra
          hết: người tìm cần thấy kết quả, không cần thấy tên chương để bấm thêm một nhịp nữa. */}
      {group.key!=="DA_HOC"?luoi(group.rows):theoChuong(group.rows).map(chuong=>
        <details key={`${chuong.key}-${dangTim}`} open={dangTim} className="rounded-xl border border-outline-variant bg-surface-container-lowest">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{chuong.ten} <span className="text-on-surface-variant">· {chuong.rows.length} mục</span></summary>
          <div className="border-t border-outline-variant p-4">{luoi(chuong.rows)}</div>
        </details>)}
    </section>)}
  </div>;
}
