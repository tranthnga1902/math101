import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Eye, FileText, Folder, FolderPlus, Pencil, Plus, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import {
  archiveTeacherDocument,
  createTeacherDocumentFolder,
  deleteTeacherDocumentFolder,
  getChapters,
  getCourses,
  getGrades,
  getMetadata,
  getTeacherDocuments,
  getTeacherDocumentFolders,
  moveTeacherDocument,
  openDocumentFile,
  restoreTeacherDocument,
  renameTeacherDocumentFolder,
  updateTeacherDocument,
  uploadTeacherDocument,
  type AuthSession,
  type Chapter,
  type Course,
  type DocumentItem,
  type DocumentFolder,
  type Grade,
  type MetadataOption,
} from "../api";
import { MarkdownViewer } from "../components/MarkdownViewer";
import { PdfViewer, isPdfDocument } from "../components/PdfViewer";

const queryKey = (session: AuthSession) => ["teacher-documents", session.accessToken];
const errorMessage = (reason: unknown) => reason instanceof Error ? reason.message : "Không thể thực hiện thao tác";

type ChapterGroup = { course: Course; chapters: Chapter[] };

/** Gom chương theo khóa học để hiển thị chọn "Chuyên đề" dạng optgroup. */
function useChapterGroups(session: AuthSession): { groups: ChapterGroup[]; isLoading: boolean } {
  const coursesQuery = useQuery({ queryKey: ["courses", session.accessToken], queryFn: () => getCourses(session) });
  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const chapterQueries = useQueries({
    queries: courses.map(course => ({
      queryKey: ["chapters", session.accessToken, course.id],
      queryFn: () => getChapters(session, course.id),
    })),
  });
  const groups = useMemo(() => courses.map((course, index) => ({ course, chapters: chapterQueries[index]?.data ?? [] })), [courses, chapterQueries]);
  return { groups, isLoading: coursesQuery.isLoading || chapterQueries.some(item => item.isLoading) };
}

function ChapterOptions({ groups }: { groups: ChapterGroup[] }) {
  return <>{groups.filter(group => group.chapters.length).map(group => <optgroup label={group.course.name} key={group.course.id}>{group.chapters.map(chapter => <option value={chapter.id} key={chapter.id}>{chapter.title}</option>)}</optgroup>)}</>;
}

export function TeacherDocumentLibrary({ session }: { session: AuthSession }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [audience, setAudience] = useState("");
  const [docType, setDocType] = useState("");
  const [sort, setSort] = useState("NEWEST");
  const [showArchived, setShowArchived] = useState(false);
  const [chapterId, setChapterId] = useState("");
  const [folderId,setFolderId]=useState<"ALL"|"NONE"|number>("ALL");
  const [folderEditor,setFolderEditor]=useState<{mode:"create"|"rename";id?:number;name:string}|null>(null);
  const [editing, setEditing] = useState<DocumentItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [markdownDoc, setMarkdownDoc] = useState<DocumentItem | null>(null);
  const [pdfDoc, setPdfDoc] = useState<DocumentItem | null>(null);
  const query = useQuery({ queryKey: queryKey(session), queryFn: () => getTeacherDocuments(session) });
  const foldersQuery=useQuery({queryKey:["teacher-document-folders",session.accessToken],queryFn:()=>getTeacherDocumentFolders(session)});
  const metadataQuery = useQuery({ queryKey: ["metadata", session.accessToken], queryFn: () => getMetadata(session) });
  const gradesQuery = useQuery({ queryKey: ["grades", session.accessToken], queryFn: () => getGrades(session) });
  const { groups: chapterGroups } = useChapterGroups(session);
  const rows = query.data ?? [];
  const visible = useMemo(() => rows.filter(row =>
    row.title.toLocaleLowerCase("vi").includes(search.trim().toLocaleLowerCase("vi")) &&
    (!audience || row.audience === audience) &&
    (!docType || row.docType === docType) &&
    (!chapterId || row.chapterId === Number(chapterId)) &&
    (folderId==="ALL"||(folderId==="NONE"?row.folderId==null:row.folderId===folderId)) &&
    (showArchived ? row.status === "HIDDEN" : row.status !== "HIDDEN")
  ).sort((a,b) => sort === "TITLE" ? a.title.localeCompare(b.title,"vi") : sort === "OLDEST" ? new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime() : new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()), [rows, search, audience, docType, chapterId, folderId, showArchived, sort]);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["teacher-documents"] });
  const invalidateFolders=()=>queryClient.invalidateQueries({queryKey:["teacher-document-folders"]});
  const archive = useMutation({ mutationFn: (id: number) => archiveTeacherDocument(session, id), onSuccess: invalidate });
  const restore = useMutation({ mutationFn: (id: number) => restoreTeacherDocument(session, id), onSuccess: invalidate });
  const createFolder=useMutation({mutationFn:(name:string)=>createTeacherDocumentFolder(session,name),onSuccess:invalidateFolders});
  const renameFolder=useMutation({mutationFn:(input:{id:number;name:string})=>renameTeacherDocumentFolder(session,input.id,input.name),onSuccess:invalidateFolders});
  const removeFolder=useMutation({mutationFn:(id:number)=>deleteTeacherDocumentFolder(session,id),onSuccess:async()=>{setFolderId("ALL");await Promise.all([invalidateFolders(),invalidate()])}});
  const moveDocument=useMutation({mutationFn:(input:{documentId:number;folderId:number|null})=>moveTeacherDocument(session,input.documentId,input.folderId),onSuccess:async()=>{await Promise.all([invalidateFolders(),invalidate()])}});
  const mutationError=[archive,restore,createFolder,renameFolder,removeFolder,moveDocument].find(item=>item.isError)?.error;
  const error = query.isError ? errorMessage(query.error) : foldersQuery.isError?errorMessage(foldersQuery.error):mutationError?errorMessage(mutationError):"";
  const folders=(foldersQuery.data??[]) as DocumentFolder[];
  const types=(metadataQuery.data?.documentTypes??[]).filter(item=>!['SGK','SBT'].includes(item.value));
  const audiences=metadataQuery.data?.documentAudiences??[];
  const grades=gradesQuery.data??[];
  const clearFilters=()=>{setSearch("");setAudience("");setDocType("");setChapterId("");setFolderId("ALL");setShowArchived(false);setSort("NEWEST")};

  const confirmArchive = (row: DocumentItem) => {
    if (confirm(`Lưu trữ tài liệu “${row.title}”? Tài liệu sẽ không còn xuất hiện khi chọn để gắn mới vào bài học.`)) archive.mutate(row.id);
  };

  const openDoc = (row: DocumentItem) => {
    if (row.contentMarkdown) { setMarkdownDoc(row); return; }
    openFile(row);
  };
  /** PDF xem ngay trong app; định dạng khác (docx…) vẫn đẩy sang tab mới như trước. */
  const openFile = (row: DocumentItem) => {
    if (isPdfDocument(row)) { setPdfDoc(row); return; }
    void openDocumentFile(session, row.fileUrl, row.title);
  };

  return <section className="flex flex-col gap-4" aria-labelledby="teacher-documents-title">
    <header className="flex items-center justify-between gap-4">
      <div><h2 id="teacher-documents-title" className="text-lg font-bold text-on-surface">Tài liệu của tôi</h2><p className="text-sm text-on-surface-variant">Quản lý tài liệu do bạn tải lên. Sách giáo khoa của Admin chỉ có quyền xem.</p></div>
      <div className="flex items-center gap-2"><button onClick={() => setBulkUploading(true)} className="h-10 px-4 rounded-lg border border-outline-variant text-on-surface font-semibold text-sm flex items-center gap-2"><Upload size={18}/> Tải nhiều file</button><button onClick={() => setUploading(true)} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-semibold text-sm flex items-center gap-2"><Plus size={18}/> Tải tài liệu</button></div>
    </header>
    <div className="grid grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)] gap-4 items-start">
    <aside className="lg:sticky lg:top-16 border border-outline-variant rounded-xl bg-surface-container-lowest overflow-hidden">
      <div className="h-12 px-4 flex items-center justify-between border-b border-outline-variant"><h3 className="text-sm font-bold text-on-surface">Thư mục tài liệu</h3><button title="Thêm thư mục" aria-label="Thêm thư mục" onClick={()=>setFolderEditor({mode:"create",name:""})} className="w-8 h-8 grid place-items-center rounded-lg text-primary hover:bg-primary-container"><FolderPlus size={18}/></button></div>
      <nav aria-label="Thư mục tài liệu" className="p-2 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible thin-scrollbar">
        <button aria-pressed={folderId==="ALL"} onClick={()=>setFolderId("ALL")} className={`h-10 px-3 min-w-max lg:w-full flex items-center gap-2 rounded-lg text-sm ${folderId==="ALL"?"bg-primary-container text-primary font-semibold":"hover:bg-surface-container"}`}><Folder size={17}/><span className="flex-1 text-left">Tất cả tài liệu</span><b>{rows.filter(row=>row.status!=="HIDDEN").length}</b></button>
        <button aria-pressed={folderId==="NONE"} onClick={()=>setFolderId("NONE")} className={`h-10 px-3 min-w-max lg:w-full flex items-center gap-2 rounded-lg text-sm ${folderId==="NONE"?"bg-primary-container text-primary font-semibold":"hover:bg-surface-container"}`}><Folder size={17}/><span className="flex-1 text-left">Chưa phân loại</span><b>{rows.filter(row=>row.folderId==null&&row.status!=="HIDDEN").length}</b></button>
        {folders.map(folder=><div key={folder.id} className={`h-10 min-w-max lg:w-full flex items-center rounded-lg overflow-hidden group ${folderId===folder.id?"bg-primary-container text-primary":"hover:bg-surface-container"}`}><button aria-pressed={folderId===folder.id} onClick={()=>setFolderId(folder.id)} className="h-full pl-3 flex-1 flex items-center gap-2 text-sm min-w-0"><Folder size={17} className="shrink-0"/><span className="flex-1 text-left truncate">{folder.name}</span><b>{folder.documentCount}</b></button><button title="Đổi tên" aria-label={`Đổi tên ${folder.name}`} onClick={()=>setFolderEditor({mode:"rename",id:folder.id,name:folder.name})} className="w-8 h-full grid place-items-center opacity-60 hover:opacity-100"><Pencil size={14}/></button><button title="Xóa thư mục" aria-label={`Xóa ${folder.name}`} onClick={()=>{if(confirm(`Xóa thư mục “${folder.name}”? Tài liệu bên trong sẽ chuyển về Chưa phân loại.`))removeFolder.mutate(folder.id)}} className="w-8 h-full grid place-items-center text-error opacity-60 hover:opacity-100"><Trash2 size={14}/></button></div>)}
        <button onClick={()=>setFolderEditor({mode:"create",name:""})} className="h-10 px-3 min-w-max lg:w-full flex items-center gap-2 rounded-lg text-primary text-sm font-semibold hover:bg-primary-container"><FolderPlus size={17}/> Thêm thư mục</button>
      </nav>
    </aside>
    <div className="min-w-0 flex flex-col gap-4">
    <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 p-3 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-sm">
      <label className="relative flex-1"><Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant"/><input aria-label="Tìm tài liệu" value={search} onChange={event => setSearch(event.target.value)} placeholder="Tìm theo tên tài liệu..." className="w-full h-10 pl-9 pr-3 border border-outline-variant rounded-lg bg-surface-container-lowest"/></label>
      <select aria-label="Lọc loại tài liệu" value={docType} onChange={event => setDocType(event.target.value)} className="h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-sm"><option value="">Mọi loại</option>{types.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select>
      <select aria-label="Lọc phạm vi" value={audience} onChange={event => setAudience(event.target.value)} className="h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-sm"><option value="">Mọi phạm vi</option>{audiences.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select>
      <select aria-label="Lọc chuyên đề" value={chapterId} onChange={event => setChapterId(event.target.value)} className="h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-sm"><option value="">Mọi chuyên đề</option><ChapterOptions groups={chapterGroups}/></select>
      <select aria-label="Sắp xếp" value={sort} onChange={event => setSort(event.target.value)} className="h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-sm"><option value="NEWEST">Mới nhất</option><option value="OLDEST">Cũ nhất</option><option value="TITLE">Tên A–Z</option></select>
      <label className="h-10 flex items-center gap-2 px-3 border border-outline-variant rounded-lg text-sm"><input type="checkbox" checked={showArchived} onChange={event => setShowArchived(event.target.checked)}/> Thùng lưu trữ</label>
    </div>
    <div className="flex items-center justify-between text-xs text-on-surface-variant"><span>{visible.length} / {rows.length} tài liệu</span>{(search||audience||docType||chapterId||showArchived||sort!=="NEWEST")&&<button onClick={clearFilters} className="font-semibold text-primary">Xóa bộ lọc</button>}</div>
    {error && <div className="api-error">{error} <button onClick={() => void query.refetch()}>Thử lại</button></div>}
    {query.isLoading ? <div className="flex flex-col gap-2">{[1,2,3].map(item => <div key={item} className="h-20 rounded-lg bg-surface-container animate-pulse"/>)}</div> :
      <div className="flex flex-col gap-2">{visible.map(row => <article key={row.id} className="grid grid-cols-[1fr_auto] items-center border border-outline-variant rounded-lg bg-surface-container-lowest p-4 gap-4">
        <div className="flex items-start gap-3">{row.thumbnailUrl?<img src={row.thumbnailUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 border border-outline-variant"/>:<span className="w-10 h-10 rounded-lg bg-primary-container text-primary flex items-center justify-center shrink-0"><FileText size={20}/></span>}<div className="min-w-0"><h3 className="font-semibold text-on-surface line-clamp-2">{row.title}</h3><p className="text-xs text-on-surface-variant mt-1">{new Intl.DateTimeFormat("vi-VN").format(new Date(row.createdAt))}</p></div></div>
        <div className="flex items-center justify-between gap-2"><div className="flex flex-wrap gap-1"><span className={`text-xs px-2 py-1 rounded ${row.audience === "STUDENT_ALLOWED" ? "bg-primary-container text-primary" : "bg-surface-container text-on-surface-variant"}`}>{audiences.find(item=>item.value===row.audience)?.label??row.audience}</span><span className="text-xs px-2 py-1 rounded bg-surface-container text-on-surface-variant">{types.find(item=>item.value===row.docType)?.label??row.docType}</span></div><div className="flex items-center gap-1">{row.status!=="HIDDEN"&&<select title="Di chuyển tới thư mục" aria-label={`Thư mục của ${row.title}`} value={row.folderId??0} disabled={moveDocument.isPending} onChange={event=>moveDocument.mutate({documentId:row.id,folderId:Number(event.target.value)||null})} className="h-9 max-w-36 px-2 text-xs border border-outline-variant rounded-lg"><option value={0}>Chưa phân loại</option>{folders.map(folder=><option value={folder.id} key={folder.id}>{folder.name}</option>)}</select>}<button title="Xem tài liệu" aria-label={`Xem ${row.title}`} onClick={() => openDoc(row)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container"><Eye size={17}/></button>{row.status !== "HIDDEN" ? <><button title="Sửa thông tin" aria-label={`Sửa ${row.title}`} onClick={() => setEditing(row)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container"><Pencil size={17}/></button><button title="Lưu trữ" aria-label={`Lưu trữ ${row.title}`} onClick={() => confirmArchive(row)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container"><Archive size={17}/></button></>:<button title="Khôi phục" aria-label={`Khôi phục ${row.title}`} disabled={restore.isPending} onClick={()=>restore.mutate(row.id)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container"><RotateCcw size={17}/></button>}</div></div>
      </article>)}</div>}
    {!query.isLoading && !visible.length && <div className="py-12 border border-dashed border-outline-variant rounded-lg text-center"><FileText size={28} className="mx-auto mb-2 text-on-surface-variant"/><p className="font-semibold text-on-surface">{rows.length ? "Không có tài liệu phù hợp bộ lọc" : "Chưa có tài liệu của riêng bạn"}</p><button onClick={() => rows.length ? clearFilters() : setUploading(true)} className="mt-3 text-sm font-semibold text-primary">{rows.length ? "Xóa bộ lọc" : "Tải tài liệu đầu tiên"}</button></div>}
    </div>
    </div>
    {(uploading || editing) && <DocumentEditor session={session} document={editing} folders={folders} initialFolderId={editing?.folderId??(typeof folderId==="number"?folderId:null)} types={types} audiences={audiences} grades={grades} chapterGroups={chapterGroups} onClose={() => { setUploading(false); setEditing(null); }} onDone={()=>{void Promise.all([invalidate(),invalidateFolders()])}}/>}
    {bulkUploading && <BulkDocumentUpload session={session} types={types.filter(item => item.value !== "VIDEO")} chapterGroups={chapterGroups} onClose={() => setBulkUploading(false)} onDone={invalidate}/>}
    {folderEditor && <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setFolderEditor(null)}}><form onSubmit={async event=>{event.preventDefault();const name=folderEditor.name.trim();if(!name)return;try{if(folderEditor.mode==="create")await createFolder.mutateAsync(name);else if(folderEditor.id)await renameFolder.mutateAsync({id:folderEditor.id,name});setFolderEditor(null)}catch{}}} className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant">
      <header className="h-14 px-5 border-b border-outline-variant flex items-center justify-between"><h2 className="text-lg font-bold text-on-surface">{folderEditor.mode==="create"?"Thêm thư mục":"Đổi tên thư mục"}</h2><button type="button" onClick={()=>setFolderEditor(null)} aria-label="Đóng"><X size={20}/></button></header>
      <div className="p-5"><label className="text-sm font-medium text-on-surface">Tên thư mục<input autoFocus required maxLength={120} value={folderEditor.name} onChange={event=>setFolderEditor({...folderEditor,name:event.target.value})} placeholder="Ví dụ: Giáo án học kỳ 1" className="mt-2 w-full h-11 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest"/></label>{(createFolder.isError||renameFolder.isError)&&<div className="api-error mt-3">{errorMessage(createFolder.error??renameFolder.error)}</div>}</div>
      <footer className="h-16 px-5 border-t border-outline-variant flex items-center justify-end gap-2"><button type="button" onClick={()=>setFolderEditor(null)} className="h-10 px-4 border border-outline-variant rounded-lg">Hủy</button><button disabled={!folderEditor.name.trim()||createFolder.isPending||renameFolder.isPending} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-semibold disabled:opacity-50">{createFolder.isPending||renameFolder.isPending?"Đang lưu...":"Lưu thư mục"}</button></footer>
    </form></div>}
    {markdownDoc && markdownDoc.contentMarkdown && <MarkdownViewer session={session} title={markdownDoc.title} markdown={markdownDoc.contentMarkdown} fileUrl={markdownDoc.fileUrl} onClose={() => setMarkdownDoc(null)} onOpenPdf={isPdfDocument(markdownDoc) ? () => { setMarkdownDoc(null); setPdfDoc(markdownDoc); } : undefined} />}
    {pdfDoc && <PdfViewer session={session} documentId={pdfDoc.id} title={pdfDoc.title} fileUrl={pdfDoc.fileUrl} onClose={() => setPdfDoc(null)} />}
  </section>;
}

function DocumentEditor({ session, document, folders, initialFolderId, types, audiences, grades, chapterGroups, onClose, onDone }: { session: AuthSession; document: DocumentItem | null; folders:DocumentFolder[];initialFolderId:number|null;types:MetadataOption[];audiences:MetadataOption[];grades:Grade[];chapterGroups:ChapterGroup[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(document?.title ?? "");
  const [audience, setAudience] = useState(document?.audience === "STUDENT_ALLOWED" ? "STUDENT_ALLOWED" : "TEACHER_ONLY");
  const [docType,setDocType]=useState(document?.docType??types[0]?.value??"KHBD");
  const [gradeId,setGradeId]=useState(document?.gradeId??0);
  const [chapterId,setChapterId]=useState(document?.chapterId??0);
  const [selectedFolderId,setSelectedFolderId]=useState(initialFolderId??0);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState(document?.docType==="VIDEO" ? document.fileUrl ?? "" : "");
  const isVideo = docType === "VIDEO";
  const mutation = useMutation({ mutationFn: async () => {
    const saved=document
      ? await updateTeacherDocument(session, document.id, { title:title.trim(), docType, audience, gradeId:gradeId||null, chapterId:chapterId||null })
      : await uploadTeacherDocument(session, { title:title.trim(), docType, audience, gradeId:gradeId||null, chapterId:chapterId||null, file: isVideo ? null : (file as File), videoUrl: isVideo ? videoUrl.trim() : null });
    if((saved.folderId??null)!==(selectedFolderId||null))await moveTeacherDocument(session,saved.id,selectedFolderId||null);
    return saved;
  },
    onSuccess: () => { onDone(); onClose(); } });
  return <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center" onMouseDown={event => { if(event.target === event.currentTarget) onClose(); }}><form onSubmit={event => { event.preventDefault(); mutation.mutate(); }} className="w-[560px] bg-surface-container-lowest rounded-lg shadow-xl">
    <header className="h-14 px-5 border-b border-outline-variant flex items-center justify-between"><h2 className="text-lg font-bold text-on-surface">{document ? "Sửa thông tin tài liệu" : "Tải tài liệu lên"}</h2><button type="button" onClick={onClose} aria-label="Đóng"><X size={20}/></button></header>
    <div className="p-5 grid grid-cols-2 gap-4"><label className="col-span-2 text-sm font-medium text-on-surface">Tên tài liệu<input autoFocus required maxLength={255} value={title} onChange={event => setTitle(event.target.value)} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg"/></label><label className="text-sm font-medium text-on-surface">Loại tài liệu<select required value={docType} onChange={event=>setDocType(event.target.value)} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg">{types.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label className="text-sm font-medium text-on-surface">Khối<select value={gradeId} onChange={event=>setGradeId(Number(event.target.value))} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg"><option value={0}>Dùng chung mọi khối</option>{grades.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label><label className="col-span-2 text-sm font-medium text-on-surface">Thư mục<select value={selectedFolderId} onChange={event=>setSelectedFolderId(Number(event.target.value))} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg"><option value={0}>Chưa phân loại</option>{folders.map(folder=><option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label><label className="col-span-2 text-sm font-medium text-on-surface">Phạm vi<select value={audience} onChange={event => setAudience(event.target.value)} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg">{audiences.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label className="col-span-2 text-sm font-medium text-on-surface">Chuyên đề (chương)<select value={chapterId} onChange={event=>setChapterId(Number(event.target.value))} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg"><option value={0}>Không gắn chương</option><ChapterOptions groups={chapterGroups}/></select></label>{isVideo ? <label className="col-span-2 text-sm font-medium text-on-surface">Đường dẫn video (URL)<input required type="url" placeholder="https://..." value={videoUrl} onChange={event=>setVideoUrl(event.target.value)} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg"/><small className="block mt-1 text-on-surface-variant">Dán liên kết video (YouTube, Drive chia sẻ công khai...). Hệ thống chưa lưu trữ file video.</small></label> : !document && <label className="col-span-2 text-sm font-medium text-on-surface">File PDF, DOC hoặc DOCX<input required type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-1 w-full p-2 border border-outline-variant rounded-lg"/><small className="block mt-1 text-on-surface-variant">Chỉ nhận PDF, DOC, DOCX. Hệ thống kiểm tra định dạng lại ở máy chủ.</small></label>}{mutation.isError && <div className="col-span-2 api-error">{errorMessage(mutation.error)}</div>}</div>
    <footer className="h-16 px-5 border-t border-outline-variant flex items-center justify-end gap-2"><button type="button" onClick={onClose} className="h-10 px-4 border border-outline-variant rounded-lg">Hủy</button><button disabled={mutation.isPending || (!document && !isVideo && !file) || (!document && isVideo && !videoUrl.trim())} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">{document ? <Pencil size={17}/> : <Upload size={17}/>} {mutation.isPending ? "Đang lưu..." : document ? "Lưu thay đổi" : "Tải lên"}</button></footer>
  </form></div>;
}

type BulkDocRow = { id: string; file: File; title: string; docType: string; chapterId: number; status: "pending" | "uploading" | "done" | "error"; error?: string };
const deriveDocTitle = (name: string) => name.replace(/\.[^.]+$/, "").trim() || name;

/** Modal tải nhiều tài liệu cùng lúc: chọn nhiều file, tự gán tên theo tên file, xác nhận loại/chuyên đề rồi tải lên tuần tự. */
function BulkDocumentUpload({ session, types, chapterGroups, onClose, onDone }: { session: AuthSession; types: MetadataOption[]; chapterGroups: ChapterGroup[]; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<BulkDocRow[]>([]);
  const [defaultType, setDefaultType] = useState(types[0]?.value ?? "");
  const [defaultChapterId, setDefaultChapterId] = useState(0);
  const [busy, setBusy] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: BulkDocRow[] = Array.from(files).map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file, title: deriveDocTitle(file.name), docType: defaultType || types[0]?.value || "", chapterId: defaultChapterId, status: "pending",
    }));
    setRows(current => [...current, ...next]);
  };
  const updateRow = (id: string, patch: Partial<BulkDocRow>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  const removeRow = (id: string) => setRows(current => current.filter(row => row.id !== id));
  const applyDefaults = () => setRows(current => current.map(row => row.status === "done" ? row : { ...row, docType: defaultType, chapterId: defaultChapterId }));

  const uploadRow = async (row: BulkDocRow) => {
    updateRow(row.id, { status: "uploading", error: undefined });
    try {
      await uploadTeacherDocument(session, { title: row.title.trim() || deriveDocTitle(row.file.name), docType: row.docType, audience: "TEACHER_ONLY", chapterId: row.chapterId || null, file: row.file });
      updateRow(row.id, { status: "done" });
      onDone();
    } catch (reason) {
      updateRow(row.id, { status: "error", error: errorMessage(reason) });
    }
  };
  const uploadAll = async () => {
    setBusy(true);
    const pending = rows.filter(row => row.status === "pending" || row.status === "error");
    const CONCURRENCY = 3;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      await Promise.all(pending.slice(i, i + CONCURRENCY).map(uploadRow));
    }
    setBusy(false);
  };

  const doneCount = rows.filter(row => row.status === "done").length;
  const canUpload = rows.some(row => row.status === "pending" || row.status === "error");

  return <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="w-[760px] max-w-full max-h-[90vh] bg-surface-container-lowest rounded-lg shadow-xl flex flex-col">
      <header className="h-14 px-5 border-b border-outline-variant flex items-center justify-between shrink-0"><h2 className="text-lg font-bold text-on-surface">Tải nhiều tài liệu</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Đóng"><X size={20}/></button></header>
      <div className="p-5 flex flex-col gap-4 overflow-y-auto">
        <label className="text-sm font-medium text-on-surface">Chọn file (PDF, DOC, DOCX — chọn được nhiều file cùng lúc)
          <input type="file" multiple accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { addFiles(event.target.files); event.target.value = ""; }} className="mt-1 w-full p-2 border border-outline-variant rounded-lg"/>
        </label>
        {rows.length > 0 && <>
          <div className="flex flex-wrap items-end gap-2 p-3 border border-outline-variant rounded-lg bg-surface-container-low">
            <label className="text-xs font-medium text-on-surface-variant">Loại tài liệu mặc định<select value={defaultType} onChange={event => setDefaultType(event.target.value)} className="mt-1 h-9 px-2 border border-outline-variant rounded-lg block">{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
            <label className="text-xs font-medium text-on-surface-variant">Chuyên đề mặc định<select value={defaultChapterId} onChange={event => setDefaultChapterId(Number(event.target.value))} className="mt-1 h-9 px-2 border border-outline-variant rounded-lg block"><option value={0}>Không gắn chương</option><ChapterOptions groups={chapterGroups}/></select></label>
            <button type="button" onClick={applyDefaults} className="h-9 px-3 border border-outline-variant rounded-lg text-sm font-semibold">Áp dụng cho tất cả</button>
          </div>
          <div className="flex flex-col gap-2">
            {rows.map(row => <div key={row.id} className="flex flex-col gap-1 p-2 border border-outline-variant rounded-lg">
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] items-center gap-2">
                <input value={row.title} onChange={event => updateRow(row.id, { title: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} className="h-9 px-2 border border-outline-variant rounded-lg text-sm min-w-0"/>
                <select value={row.docType} onChange={event => updateRow(row.id, { docType: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} className="h-9 px-2 border border-outline-variant rounded-lg text-sm">{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
                <select value={row.chapterId} onChange={event => updateRow(row.id, { chapterId: Number(event.target.value) })} disabled={row.status === "uploading" || row.status === "done"} className="h-9 px-2 border border-outline-variant rounded-lg text-sm"><option value={0}>Không gắn chương</option><ChapterOptions groups={chapterGroups}/></select>
                <span className="text-xs font-semibold w-20 text-center">{row.status === "pending" ? "Chờ" : row.status === "uploading" ? "Đang tải…" : row.status === "done" ? "✓ Xong" : "✗ Lỗi"}</span>
                {row.status === "uploading" || row.status === "done" ? <span className="w-9"/> : <button type="button" title="Bỏ khỏi danh sách" aria-label={`Bỏ ${row.title}`} onClick={() => removeRow(row.id)} className="w-9 h-9 grid place-items-center text-error"><X size={16}/></button>}
              </div>
              {row.status === "error" && <small className="text-error px-1">{row.error}</small>}
            </div>)}
          </div>
        </>}
      </div>
      <footer className="h-16 px-5 border-t border-outline-variant flex items-center justify-between shrink-0">
        <span className="text-sm text-on-surface-variant">{doneCount} / {rows.length} đã tải lên</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-10 px-4 border border-outline-variant rounded-lg">Đóng</button>
          <button type="button" onClick={() => void uploadAll()} disabled={busy || !canUpload} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-semibold disabled:opacity-50">{busy ? "Đang tải…" : `Tải lên (${rows.filter(row => row.status === "pending" || row.status === "error").length})`}</button>
        </div>
      </footer>
    </div>
  </div>;
}
