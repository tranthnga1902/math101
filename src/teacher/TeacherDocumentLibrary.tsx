import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Eye, FileText, Folder, FolderInput, FolderPlus, MoreVertical, Pencil, PlayCircle, Plus, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
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
import { YoutubeVideoModal, canonicalYoutubeUrl, parseYoutubeList, youtubeEmbedUrl, youtubeThumbnailUrl } from "../components/YoutubeVideoModal";
import { AuthedImage } from "../lib/authedImage";

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
  const [initialDocType, setInitialDocType] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [markdownDoc, setMarkdownDoc] = useState<DocumentItem | null>(null);
  const [pdfDoc, setPdfDoc] = useState<DocumentItem | null>(null);
  const [videoDoc, setVideoDoc] = useState<DocumentItem | null>(null);
  const [openDocMenu, setOpenDocMenu] = useState<number | null>(null);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMoveFolderId, setBulkMoveFolderId] = useState<number | null>(null);
  const [bulkMoveModalOpen, setBulkMoveModalOpen] = useState(false);

  useEffect(() => {
    setSelectedIds(current => {
      if (!current.size) return current;
      const existing = new Set(rows.map(row => row.id));
      const next = new Set([...current].filter(id => existing.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  const bulkMoveMutation = useMutation({
    mutationFn: async ({ ids, folderId }: { ids: number[]; folderId: number | null }) => {
      const failures: string[] = [];
      await Promise.allSettled(
        ids.map(async id => {
          try {
            await moveTeacherDocument(session, id, folderId);
          } catch (e) {
            failures.push(errorMessage(e));
          }
        })
      );
      if (failures.length > 0) throw new Error(`Có ${failures.length}/${ids.length} tài liệu không chuyển được.`);
    },
    onSuccess: async () => {
      setSelectedIds(new Set());
      setBulkMoveModalOpen(false);
      await Promise.all([invalidateFolders(), invalidate()]);
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const failures: string[] = [];
      await Promise.allSettled(
        ids.map(async id => {
          try {
            await archiveTeacherDocument(session, id);
          } catch (e) {
            failures.push(errorMessage(e));
          }
        })
      );
      if (failures.length > 0) throw new Error(`Có ${failures.length}/${ids.length} tài liệu không lưu trữ được.`);
    },
    onSuccess: async () => {
      setSelectedIds(new Set());
      await invalidate();
    },
  });

  const bulkRestoreMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const failures: string[] = [];
      await Promise.allSettled(
        ids.map(async id => {
          try {
            await restoreTeacherDocument(session, id);
          } catch (e) {
            failures.push(errorMessage(e));
          }
        })
      );
      if (failures.length > 0) throw new Error(`Có ${failures.length}/${ids.length} tài liệu không khôi phục được.`);
    },
    onSuccess: async () => {
      setSelectedIds(new Set());
      await invalidate();
    },
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const allVisibleSelected = visible.length > 0 && visible.every(row => selectedIds.has(row.id));
  const toggleSelectAll = () => {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visible.map(row => row.id)));
  };

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".doc-menu") && !target.closest(".doc-menu-trigger")) setOpenDocMenu(null);
      if (!target.closest(".bulk-menu") && !target.closest(".bulk-menu-trigger")) setBulkMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const mutationError=[archive,restore,createFolder,renameFolder,removeFolder,moveDocument,bulkMoveMutation,bulkArchiveMutation,bulkRestoreMutation].find(item=>item.isError)?.error;
  const error = query.isError ? errorMessage(query.error) : foldersQuery.isError?errorMessage(foldersQuery.error):mutationError?errorMessage(mutationError):"";
  const folders=(foldersQuery.data??[]) as DocumentFolder[];
  const types=(metadataQuery.data?.documentTypes??[]).filter(item=>!['SGK','SBT'].includes(item.value));
  const audiences=metadataQuery.data?.documentAudiences??[];
  const grades=gradesQuery.data??[];
  const clearFilters=()=>{setSearch("");setAudience("");setDocType("");setChapterId("");setFolderId("ALL");setShowArchived(false);setSort("NEWEST");setSelectedIds(new Set());};

  const confirmArchive = (row: DocumentItem) => {
    if (confirm(`Lưu trữ tài liệu “${row.title}”? Tài liệu sẽ không còn xuất hiện khi chọn để gắn mới vào bài học.`)) archive.mutate(row.id);
  };

  const openDoc = (row: DocumentItem) => {
    if (row.docType === "VIDEO" || (row.fileUrl && youtubeEmbedUrl(row.fileUrl))) {
      setVideoDoc(row);
      return;
    }
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
      <div className="flex items-center gap-2">
        <button onClick={() => setBulkUploading(true)} className="h-10 px-4 rounded-lg border border-outline-variant text-on-surface font-semibold text-sm flex items-center gap-2"><Upload size={18}/> Tải nhiều file</button>
        <button onClick={() => { setEditing(null); setInitialDocType("VIDEO_BULK"); setUploading(true); }} className="h-10 px-3.5 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 font-semibold text-sm flex items-center gap-2"><PlayCircle size={18}/> Thêm nhiều video</button>
        <button onClick={() => { setEditing(null); setInitialDocType("VIDEO"); setUploading(true); }} className="h-10 px-4 rounded-lg border border-outline-variant text-on-surface font-semibold text-sm flex items-center gap-2"><PlayCircle size={18}/> Thêm video</button>
        <button onClick={() => { setEditing(null); setInitialDocType(""); setUploading(true); }} className="h-10 px-4 rounded-lg bg-primary text-on-primary font-semibold text-sm flex items-center gap-2"><Plus size={18}/> Tải tài liệu</button>
      </div>
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
    <div className="flex items-center justify-between text-xs text-on-surface-variant gap-2 flex-wrap">
      <div className="flex items-center gap-3">
        {visible.length > 0 && (
          <label className="flex items-center gap-1.5 font-medium text-on-surface cursor-pointer">
            <input
              type="checkbox"
              className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
            />
            <span>Chọn tất cả ({visible.length})</span>
          </label>
        )}
        <span>{visible.length} / {rows.length} tài liệu</span>
      </div>
      {(search||audience||docType||chapterId||showArchived||sort!=="NEWEST")&&<button onClick={clearFilters} className="font-semibold text-primary">Xóa bộ lọc</button>}
    </div>

    {selectedIds.size > 0 && (
      <div className="sticky top-28 z-20 flex flex-wrap items-center gap-2.5 p-3 bg-primary-container text-on-primary-container rounded-xl shadow-md border border-primary/20">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          <strong className="text-sm font-bold">Đã chọn {selectedIds.size} tài liệu</strong>
        </div>

        <div className="h-4 w-px bg-on-primary-container/20 mx-1 hidden sm:block" />

        {/* Nút dấu ... menu chung cho các thao tác hàng loạt */}
        <div className="relative">
          <button
            onClick={() => setBulkMenuOpen(v => !v)}
            className="bulk-menu-trigger h-8 px-3 rounded-md bg-white text-on-surface text-xs font-semibold flex items-center gap-1.5 shadow-sm hover:bg-white/90"
            title="Thao tác hàng loạt"
            aria-label="Thao tác hàng loạt"
          >
            <MoreVertical size={14} className="text-primary" />
            <span>Thao tác ({selectedIds.size}) ▾</span>
          </button>
          {bulkMenuOpen && (
            <div className="bulk-menu absolute left-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-2xl border border-outline-variant py-1.5 z-30 text-left" role="menu">
              <div className="px-3 py-1.5 border-b border-outline-variant/60 text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                <span>Thao tác {selectedIds.size} tài liệu</span>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">CHUNG</span>
              </div>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                role="menuitem"
                onClick={() => {
                  setBulkMenuOpen(false);
                  setBulkMoveFolderId(folders[0]?.id ?? null);
                  setBulkMoveModalOpen(true);
                }}
              >
                <FolderInput size={15} className="text-primary shrink-0" />
                <span>Chuyển vào thư mục…</span>
              </button>
              {!showArchived ? (
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                  role="menuitem"
                  disabled={bulkArchiveMutation.isPending}
                  onClick={() => {
                    setBulkMenuOpen(false);
                    if (confirm(`Lưu trữ ${selectedIds.size} tài liệu đã chọn? Tài liệu sẽ chuyển vào Thùng lưu trữ.`)) {
                      bulkArchiveMutation.mutate([...selectedIds]);
                    }
                  }}
                >
                  <Archive size={15} className="text-primary shrink-0" />
                  <span>Lưu trữ {selectedIds.size} tài liệu</span>
                </button>
              ) : (
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                  role="menuitem"
                  disabled={bulkRestoreMutation.isPending}
                  onClick={() => {
                    setBulkMenuOpen(false);
                    if (confirm(`Khôi phục ${selectedIds.size} tài liệu đã chọn?`)) {
                      bulkRestoreMutation.mutate([...selectedIds]);
                    }
                  }}
                >
                  <RotateCcw size={15} className="text-primary shrink-0" />
                  <span>Khôi phục {selectedIds.size} tài liệu</span>
                </button>
              )}
              <hr className="my-1 border-outline-variant" />
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-variant"
                role="menuitem"
                onClick={() => { setBulkMenuOpen(false); setSelectedIds(new Set()); }}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setBulkMoveFolderId(folders[0]?.id ?? null);
            setBulkMoveModalOpen(true);
          }}
          className="h-8 px-3 rounded-md bg-white/90 hover:bg-white text-on-surface text-xs font-semibold flex items-center gap-1.5 shadow-sm"
        >
          <FolderInput size={14} /> Chuyển thư mục…
        </button>

        {!showArchived ? (
          <button
            disabled={bulkArchiveMutation.isPending}
            onClick={() => {
              if (confirm(`Lưu trữ ${selectedIds.size} tài liệu đã chọn? Tài liệu sẽ chuyển vào Thùng lưu trữ.`)) {
                bulkArchiveMutation.mutate([...selectedIds]);
              }
            }}
            className="h-8 px-3 rounded-md bg-white/90 hover:bg-white text-on-surface text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <Archive size={14} /> {bulkArchiveMutation.isPending ? "Đang lưu trữ…" : "Lưu trữ đã chọn"}
          </button>
        ) : (
          <button
            disabled={bulkRestoreMutation.isPending}
            onClick={() => {
              if (confirm(`Khôi phục ${selectedIds.size} tài liệu đã chọn?`)) {
                bulkRestoreMutation.mutate([...selectedIds]);
              }
            }}
            className="h-8 px-3 rounded-md bg-white/90 hover:bg-white text-on-surface text-xs font-semibold flex items-center gap-1.5 shadow-sm"
          >
            <RotateCcw size={14} /> {bulkRestoreMutation.isPending ? "Đang khôi phục…" : "Khôi phục đã chọn"}
          </button>
        )}

        <button
          onClick={() => setSelectedIds(new Set())}
          className="h-8 px-3 rounded-md border border-outline-variant/60 hover:bg-black/5 text-xs font-semibold ml-auto"
        >
          Bỏ chọn
        </button>
      </div>
    )}

    {error && <div className="api-error">{error} <button onClick={() => void query.refetch()}>Thử lại</button></div>}
    {query.isLoading ? <div className="flex flex-col gap-2">{[1,2,3].map(item => <div key={item} className="h-20 rounded-lg bg-surface-container animate-pulse"/>)}</div> :
      <div className="flex flex-col gap-2">{visible.map(row => {
        const isYt = !!row.fileUrl && !!youtubeEmbedUrl(row.fileUrl);
        const isVid = row.docType === "VIDEO" || isYt;
        const thumb = row.thumbnailUrl || (isYt ? youtubeThumbnailUrl(row.fileUrl) : undefined);
        const isSelected = selectedIds.has(row.id);
        return (
          <article key={row.id} className={`grid grid-cols-[1fr_auto] items-center border rounded-lg bg-surface-container-lowest p-4 gap-4 transition-all hover:shadow-sm ${isSelected ? "border-primary ring-2 ring-primary/40 bg-primary/5" : "border-outline-variant"}`}>
            <div className="flex items-start gap-3">
              <label className="mt-1 flex items-center cursor-pointer" title="Chọn tài liệu" onClick={e => e.stopPropagation()}>
                <input
                  type="checkbox"
                  className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                  checked={isSelected}
                  onChange={() => toggleSelect(row.id)}
                />
              </label>
              <div className="relative w-12 h-12 shrink-0">
                <AuthedImage
                  url={thumb}
                  accessToken={session.accessToken}
                  alt=""
                  className="w-12 h-12 rounded-lg object-cover border border-outline-variant"
                  fallback={
                    <span className={`w-12 h-12 rounded-lg flex items-center justify-center ${isVid ? "bg-red-50 text-red-600" : "bg-primary-container text-primary"}`}>
                      {isVid ? <PlayCircle size={22} /> : <FileText size={20} />}
                    </span>
                  }
                />
                {isVid && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-lg pointer-events-none">
                    <PlayCircle size={20} className="text-white drop-shadow" />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-on-surface line-clamp-2">{row.title}</h3>
                <p className="text-xs text-on-surface-variant mt-1">{new Intl.DateTimeFormat("vi-VN").format(new Date(row.createdAt))}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <span className={`text-xs px-2 py-1 rounded ${row.audience === "STUDENT_ALLOWED" ? "bg-primary-container text-primary" : "bg-surface-container text-on-surface-variant"}`}>
                  {audiences.find(item => item.value === row.audience)?.label ?? row.audience}
                </span>
                <span className={`text-xs px-2 py-1 rounded ${isVid ? "bg-red-50 text-red-700 font-medium" : "bg-surface-container text-on-surface-variant"}`}>
                  {types.find(item => item.value === row.docType)?.label ?? row.docType}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {row.status !== "HIDDEN" && (
                  <select title="Di chuyển tới thư mục" aria-label={`Thư mục của ${row.title}`} value={row.folderId ?? 0} disabled={moveDocument.isPending} onChange={event => moveDocument.mutate({ documentId: row.id, folderId: Number(event.target.value) || null })} className="h-9 max-w-36 px-2 text-xs border border-outline-variant rounded-lg">
                    <option value={0}>Chưa phân loại</option>
                    {folders.map(folder => <option value={folder.id} key={folder.id}>{folder.name}</option>)}
                  </select>
                )}
                <button title="Xem tài liệu" aria-label={`Xem ${row.title}`} onClick={() => openDoc(row)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container">
                  <Eye size={17} />
                </button>
                {row.status !== "HIDDEN" ? (
                  <>
                    <button title="Sửa thông tin" aria-label={`Sửa ${row.title}`} onClick={() => setEditing(row)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container">
                      <Pencil size={17} />
                    </button>
                    <button title="Lưu trữ" aria-label={`Lưu trữ ${row.title}`} onClick={() => confirmArchive(row)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container">
                      <Archive size={17} />
                    </button>
                  </>
                ) : (
                  <button title="Khôi phục" aria-label={`Khôi phục ${row.title}`} disabled={restore.isPending} onClick={() => restore.mutate(row.id)} className="w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container">
                    <RotateCcw size={17} />
                  </button>
                )}

                {/* Nút ... menu thao tác (hỗ trợ thao tác chung khi chọn nhiều) */}
                <div className="relative">
                  <button
                    className="doc-menu-trigger w-9 h-9 inline-flex items-center justify-center rounded-lg hover:bg-surface-container text-on-surface-variant"
                    title={`Thao tác với ${row.title}`}
                    aria-label={`Thao tác với ${row.title}`}
                    aria-expanded={openDocMenu === row.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDocMenu(current => current === row.id ? null : row.id);
                    }}
                  >
                    <MoreVertical size={17} />
                  </button>
                  {openDocMenu === row.id && (
                    <div className="doc-menu absolute right-0 top-full mt-1 w-56 bg-white rounded-xl shadow-xl border border-outline-variant py-1 z-30 text-left" role="menu">
                      {selectedIds.size > 0 && selectedIds.has(row.id) ? (
                        <>
                          <div className="px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-xs font-bold text-primary flex items-center justify-between">
                            <span>Thao tác {selectedIds.size} tài liệu</span>
                            <span className="text-[10px] bg-primary text-white px-1.5 py-0.2 rounded font-semibold">ĐÃ CHỌN</span>
                          </div>
                          <button
                            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                            role="menuitem"
                            onClick={() => {
                              setOpenDocMenu(null);
                              setBulkMoveFolderId(folders[0]?.id ?? null);
                              setBulkMoveModalOpen(true);
                            }}
                          >
                            <FolderInput size={15} className="text-primary shrink-0" />
                            <span>Chuyển {selectedIds.size} tài liệu…</span>
                          </button>
                          {!showArchived ? (
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                              role="menuitem"
                              disabled={bulkArchiveMutation.isPending}
                              onClick={() => {
                                setOpenDocMenu(null);
                                if (confirm(`Lưu trữ ${selectedIds.size} tài liệu đã chọn? Tài liệu sẽ chuyển vào Thùng lưu trữ.`)) {
                                  bulkArchiveMutation.mutate([...selectedIds]);
                                }
                              }}
                            >
                              <Archive size={15} className="text-primary shrink-0" />
                              <span>Lưu trữ {selectedIds.size} tài liệu</span>
                            </button>
                          ) : (
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                              role="menuitem"
                              disabled={bulkRestoreMutation.isPending}
                              onClick={() => {
                                setOpenDocMenu(null);
                                if (confirm(`Khôi phục ${selectedIds.size} tài liệu đã chọn?`)) {
                                  bulkRestoreMutation.mutate([...selectedIds]);
                                }
                              }}
                            >
                              <RotateCcw size={15} className="text-primary shrink-0" />
                              <span>Khôi phục {selectedIds.size} tài liệu</span>
                            </button>
                          )}
                          <hr className="my-1 border-outline-variant" />
                          <span className="px-3 py-1 text-[11px] font-semibold text-on-surface-variant/80 uppercase block">Chỉ tài liệu này</span>
                          <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant flex items-center gap-2" role="menuitem" onClick={() => { setOpenDocMenu(null); openDoc(row); }}>
                            <Eye size={15} /> Xem tài liệu
                          </button>
                          {row.status !== "HIDDEN" && (
                            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant flex items-center gap-2" role="menuitem" onClick={() => { setOpenDocMenu(null); setEditing(row); }}>
                              <Pencil size={15} /> Sửa thông tin
                            </button>
                          )}
                          <button className="w-full text-left px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); toggleSelect(row.id); }}>
                            Bỏ chọn tài liệu này
                          </button>
                        </>
                      ) : (
                        <>
                          {selectedIds.size > 0 && (
                            <div className="p-1.5 border-b border-outline-variant/60 bg-primary/5">
                              <button
                                className="w-full text-left px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded flex items-center justify-between"
                                onClick={() => toggleSelect(row.id)}
                              >
                                <span>+ Thêm vào nhóm đã chọn</span>
                                <span className="text-[10px] bg-primary/10 px-1.5 py-0.5 rounded font-bold">{selectedIds.size} đã chọn</span>
                              </button>
                            </div>
                          )}
                          <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant flex items-center gap-2" role="menuitem" onClick={() => { setOpenDocMenu(null); openDoc(row); }}>
                            <Eye size={15} /> Xem tài liệu
                          </button>
                          {row.status !== "HIDDEN" ? (
                            <>
                              <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant flex items-center gap-2" role="menuitem" onClick={() => { setOpenDocMenu(null); setEditing(row); }}>
                                <Pencil size={15} /> Sửa thông tin
                              </button>
                              <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface" role="menuitem" onClick={() => { setOpenDocMenu(null); confirmArchive(row); }}>
                                <Archive size={15} /> Lưu trữ
                              </button>
                            </>
                          ) : (
                            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant flex items-center gap-2" role="menuitem" disabled={restore.isPending} onClick={() => { setOpenDocMenu(null); restore.mutate(row.id); }}>
                              <RotateCcw size={15} /> Khôi phục
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </article>
        );
      })}</div>}
    {!query.isLoading && !visible.length && <div className="py-12 border border-dashed border-outline-variant rounded-lg text-center"><FileText size={28} className="mx-auto mb-2 text-on-surface-variant"/><p className="font-semibold text-on-surface">{rows.length ? "Không có tài liệu phù hợp bộ lọc" : "Chưa có tài liệu của riêng bạn"}</p><button onClick={() => rows.length ? clearFilters() : setUploading(true)} className="mt-3 text-sm font-semibold text-primary">{rows.length ? "Xóa bộ lọc" : "Tải tài liệu đầu tiên"}</button></div>}
    </div>
    </div>
    {(uploading || editing) && <DocumentEditor session={session} document={editing} folders={folders} initialFolderId={editing?.folderId??(typeof folderId==="number"?folderId:null)} initialDocType={initialDocType} types={types} audiences={audiences} grades={grades} chapterGroups={chapterGroups} onClose={() => { setUploading(false); setEditing(null); }} onDone={()=>{void Promise.all([invalidate(),invalidateFolders()])}}/>}
    {bulkUploading && <BulkDocumentUpload session={session} types={types.filter(item => item.value !== "VIDEO")} folders={folders} initialFolderId={typeof folderId === "number" ? folderId : null} chapterGroups={chapterGroups} onClose={() => setBulkUploading(false)} onDone={() => { void Promise.all([invalidate(), invalidateFolders()]); }} />}
    {folderEditor && <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={event=>{if(event.target===event.currentTarget)setFolderEditor(null)}}><form onSubmit={async event=>{event.preventDefault();const name=folderEditor.name.trim();if(!name)return;try{if(folderEditor.mode==="create")await createFolder.mutateAsync(name);else if(folderEditor.id)await renameFolder.mutateAsync({id:folderEditor.id,name});setFolderEditor(null)}catch{}}} className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant">
      <header className="h-14 px-5 border-b border-outline-variant flex items-center justify-between"><h2 className="text-lg font-bold text-on-surface">{folderEditor.mode==="create"?"Thêm thư mục":"Đổi tên thư mục"}</h2><button type="button" onClick={()=>setFolderEditor(null)} aria-label="Đóng"><X size={20}/></button></header>
      <div className="p-5"><label className="text-sm font-medium text-on-surface">Tên thư mục<input autoFocus required maxLength={120} value={folderEditor.name} onChange={event=>setFolderEditor({...folderEditor,name:event.target.value})} placeholder="Ví dụ: Giáo án học kỳ 1" className="mt-2 w-full h-11 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest"/></label>{(createFolder.isError||renameFolder.isError)&&<div className="api-error mt-3">{errorMessage(createFolder.error??renameFolder.error)}</div>}</div>
      <footer className="h-16 px-5 border-t border-outline-variant flex items-center justify-end gap-2"><button type="button" onClick={()=>setFolderEditor(null)} className="h-10 px-4 border border-outline-variant rounded-lg">Hủy</button><button disabled={!folderEditor.name.trim()||createFolder.isPending||renameFolder.isPending} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-semibold disabled:opacity-50">{createFolder.isPending||renameFolder.isPending?"Đang lưu...":"Lưu thư mục"}</button></footer>
    </form></div>}
    {markdownDoc && markdownDoc.contentMarkdown && <MarkdownViewer session={session} title={markdownDoc.title} markdown={markdownDoc.contentMarkdown} fileUrl={markdownDoc.fileUrl} onClose={() => setMarkdownDoc(null)} onOpenPdf={isPdfDocument(markdownDoc) ? () => { setMarkdownDoc(null); setPdfDoc(markdownDoc); } : undefined} />}
    {pdfDoc && <PdfViewer session={session} documentId={pdfDoc.id} title={pdfDoc.title} fileUrl={pdfDoc.fileUrl} onClose={() => setPdfDoc(null)} />}
    {videoDoc && videoDoc.fileUrl && <YoutubeVideoModal title={videoDoc.title} url={videoDoc.fileUrl} onClose={() => setVideoDoc(null)} />}
    {bulkMoveModalOpen && (
      <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) setBulkMoveModalOpen(false); }}>
        <div className="w-full max-w-md bg-surface-container-lowest rounded-xl shadow-xl border border-outline-variant p-5">
          <header className="flex items-center justify-between pb-3 border-b border-outline-variant mb-4">
            <h3 className="text-base font-bold text-on-surface">Chuyển {selectedIds.size} tài liệu vào thư mục</h3>
            <button type="button" onClick={() => setBulkMoveModalOpen(false)} aria-label="Đóng"><X size={18} /></button>
          </header>
          <label className="text-sm font-medium text-on-surface block mb-2">Chọn thư mục đích</label>
          <select
            value={bulkMoveFolderId ?? 0}
            onChange={e => setBulkMoveFolderId(Number(e.target.value) || null)}
            className="w-full h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest text-sm mb-4"
          >
            <option value={0}>Chưa phân loại (Không thuộc thư mục nào)</option>
            {folders.map(f => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
          <footer className="flex justify-end gap-2 pt-3 border-t border-outline-variant">
            <button type="button" onClick={() => setBulkMoveModalOpen(false)} className="h-9 px-4 border border-outline-variant rounded-lg text-sm">Hủy</button>
            <button
              disabled={bulkMoveMutation.isPending}
              onClick={() => bulkMoveMutation.mutate({ ids: [...selectedIds], folderId: bulkMoveFolderId })}
              className="h-9 px-4 bg-primary text-on-primary rounded-lg font-semibold text-sm disabled:opacity-50"
            >
              {bulkMoveMutation.isPending ? "Đang chuyển…" : "Xác nhận chuyển"}
            </button>
          </footer>
        </div>
      </div>
    )}
  </section>;
}

type BulkVideoRow = {
  id: string;
  youtubeId: string;
  canonicalUrl: string;
  thumbnailUrl: string;
  title: string;
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
};

function DocumentEditor({ session, document, folders, initialFolderId, initialDocType, types, audiences, grades, chapterGroups, onClose, onDone }: { session: AuthSession; document: DocumentItem | null; folders:DocumentFolder[];initialFolderId:number|null;initialDocType?:string;types:MetadataOption[];audiences:MetadataOption[];grades:Grade[];chapterGroups:ChapterGroup[]; onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState(document?.title ?? "");
  const [audience, setAudience] = useState(document?.audience === "STUDENT_ALLOWED" ? "STUDENT_ALLOWED" : "TEACHER_ONLY");
  const [docType,setDocType]=useState(document?.docType ?? (initialDocType === "VIDEO" || initialDocType === "VIDEO_BULK" ? "VIDEO" : (initialDocType || types[0]?.value || "KHBD")));
  const [gradeId,setGradeId]=useState(document?.gradeId??0);
  const [chapterId,setChapterId]=useState(document?.chapterId??0);
  const [selectedFolderId,setSelectedFolderId]=useState(initialFolderId??0);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState(document?.docType==="VIDEO" ? document.fileUrl ?? "" : "");
  const [youtubeMode, setYoutubeMode] = useState<"single" | "bulk">(initialDocType === "VIDEO_BULK" ? "bulk" : "single");
  const [bulkUrlsText, setBulkUrlsText] = useState("");
  const [bulkVideoRows, setBulkVideoRows] = useState<BulkVideoRow[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  const isVideo = docType === "VIDEO";
  const isBulkYt = !document && isVideo && youtubeMode === "bulk";
  const ytThumb = isVideo && videoUrl.trim() ? youtubeThumbnailUrl(videoUrl) : null;

  const onBulkUrlsChange = (text: string) => {
    setBulkUrlsText(text);
    const parsed = parseYoutubeList(text);
    setBulkVideoRows(current => {
      const existingTitles = new Map(current.map(r => [r.youtubeId, r.title]));
      return parsed.map(p => ({
        id: p.id,
        youtubeId: p.youtubeId,
        canonicalUrl: p.canonicalUrl,
        thumbnailUrl: p.thumbnailUrl,
        title: existingTitles.get(p.youtubeId) || p.title,
        status: "pending" as const,
      }));
    });
  };

  const updateBulkRow = (id: string, patch: Partial<BulkVideoRow>) => {
    setBulkVideoRows(cur => cur.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeBulkRow = (id: string) => {
    setBulkVideoRows(cur => cur.filter(r => r.id !== id));
  };

  const mutation = useMutation({ mutationFn: async () => {
    const finalTitle = title.trim() || (isVideo ? "Video YouTube" : "");
    const normalizedVideoUrl = isVideo ? canonicalYoutubeUrl(videoUrl) : null;
    const saved=document
      ? await updateTeacherDocument(session, document.id, { title:finalTitle, docType, audience, gradeId:gradeId||null, chapterId:chapterId||null })
      : await uploadTeacherDocument(session, { title:finalTitle, docType, audience, gradeId:gradeId||null, chapterId:chapterId||null, file: isVideo ? null : (file as File), videoUrl: normalizedVideoUrl });
    if((saved.folderId??null)!==(selectedFolderId||null))await moveTeacherDocument(session,saved.id,selectedFolderId||null);
    return saved;
  },
    onSuccess: () => { onDone(); onClose(); } });

  const submitBulk = async () => {
    if (!bulkVideoRows.length) return;
    setBulkBusy(true);
    const pending = bulkVideoRows.filter(r => r.status === "pending" || r.status === "error");
    const CONCURRENCY = 3;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      await Promise.all(pending.slice(i, i + CONCURRENCY).map(async row => {
        updateBulkRow(row.id, { status: "uploading", error: undefined });
        try {
          const saved = await uploadTeacherDocument(session, {
            title: row.title.trim() || "Video YouTube",
            docType: "VIDEO",
            audience,
            gradeId: gradeId || null,
            chapterId: chapterId || null,
            videoUrl: row.canonicalUrl,
          });
          if (selectedFolderId) {
            await moveTeacherDocument(session, saved.id, selectedFolderId);
          }
          updateBulkRow(row.id, { status: "done" });
        } catch (reason) {
          updateBulkRow(row.id, { status: "error", error: errorMessage(reason) });
        }
      }));
    }
    onDone();
    setBulkBusy(false);
    if (bulkVideoRows.every(r => r.status === "done")) {
      onClose();
    }
  };

  const isPending = mutation.isPending || bulkBusy;
  const bulkDoneCount = bulkVideoRows.filter(r => r.status === "done").length;
  const bulkPendingCount = bulkVideoRows.filter(r => r.status === "pending" || r.status === "error").length;
  const canSubmit = isBulkYt
    ? (bulkVideoRows.length > 0 && bulkPendingCount > 0 && !bulkBusy)
    : (!mutation.isPending &&
       (title.trim() || isVideo) &&
       (document || (isVideo ? !!videoUrl.trim() : !!file)));

  return <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={event => { if(event.target === event.currentTarget && !isPending) onClose(); }}>
    <form onSubmit={event => { event.preventDefault(); if (isBulkYt) void submitBulk(); else mutation.mutate(); }} className={`${isBulkYt ? "w-[720px]" : "w-[560px]"} max-w-full max-h-[92vh] flex flex-col bg-surface-container-lowest rounded-lg shadow-xl overflow-hidden`}>
      <header className="h-14 px-5 border-b border-outline-variant flex items-center justify-between shrink-0"><h2 className="text-lg font-bold text-on-surface">{document ? "Sửa thông tin tài liệu" : isBulkYt ? "Tải lên nhiều video YouTube" : "Tải tài liệu lên"}</h2><button type="button" onClick={onClose} disabled={isPending} aria-label="Đóng"><X size={20}/></button></header>
      <div className="p-5 grid grid-cols-2 gap-4 overflow-y-auto">
        {!document && isVideo && (
          <div className="col-span-2 flex rounded-lg border border-outline-variant p-1 bg-surface-container">
            <button
              type="button"
              onClick={() => setYoutubeMode("single")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                youtubeMode === "single" ? "bg-surface-container-lowest shadow text-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Một video (1 link)
            </button>
            <button
              type="button"
              onClick={() => setYoutubeMode("bulk")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                youtubeMode === "bulk" ? "bg-surface-container-lowest shadow text-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Nhiều video cùng lúc (dán nhiều link)
            </button>
          </div>
        )}
        {!isBulkYt && (
          <label className="col-span-2 text-sm font-medium text-on-surface">Tên tài liệu<input autoFocus required maxLength={255} value={title} onChange={event => setTitle(event.target.value)} placeholder={isVideo ? "Video YouTube (hoặc để trống)" : undefined} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest"/></label>
        )}
        <label className="text-sm font-medium text-on-surface">Loại tài liệu<select required value={docType} onChange={event=>setDocType(event.target.value)} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest">{types.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className="text-sm font-medium text-on-surface">Khối<select value={gradeId} onChange={event=>setGradeId(Number(event.target.value))} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest"><option value={0}>Dùng chung mọi khối</option>{grades.map(item=><option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
        <label className="col-span-2 text-sm font-medium text-on-surface">Thư mục<select value={selectedFolderId} onChange={event=>setSelectedFolderId(Number(event.target.value))} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest"><option value={0}>Chưa phân loại</option>{folders.map(folder=><option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>
        <label className="col-span-2 text-sm font-medium text-on-surface">Phạm vi<select value={audience} onChange={event => setAudience(event.target.value)} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest">{audiences.map(item=><option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
        <label className="col-span-2 text-sm font-medium text-on-surface">Chuyên đề (chương)<select value={chapterId} onChange={event=>setChapterId(Number(event.target.value))} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg bg-surface-container-lowest"><option value={0}>Không gắn chương</option><ChapterOptions groups={chapterGroups}/></select></label>
        {isVideo ? (
          isBulkYt ? (
            <div className="col-span-2 space-y-3 pt-1">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-on-surface">
                    Dán danh sách link YouTube (mỗi link 1 dòng)
                  </label>
                  <span className="text-xs text-on-surface-variant font-medium">
                    Đã nhận diện: <b className="text-primary">{bulkVideoRows.length}</b> video
                  </span>
                </div>
                <textarea
                  rows={4}
                  placeholder={`https://www.youtube.com/watch?v=...\nhttps://youtu.be/...\nhttps://www.youtube.com/shorts/...`}
                  value={bulkUrlsText}
                  onChange={event => onBulkUrlsChange(event.target.value)}
                  className="w-full p-2.5 rounded-lg border border-outline-variant text-xs focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest"
                />
                <small className="text-on-surface-variant block mt-1">
                  Hỗ trợ link xem thường, link ngắn (youtu.be), Shorts, Live, nhúng (embed)... Tự động lọc trùng lặp.
                </small>
              </div>

              {bulkVideoRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-on-surface-variant">
                    Danh sách video nhận diện được ({bulkVideoRows.length}):
                  </div>
                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                    {bulkVideoRows.map((row, idx) => (
                      <div key={row.id} className="flex items-center gap-3 p-2 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container transition-colors">
                        <span className="text-xs font-semibold text-on-surface-variant w-5 text-center shrink-0">{idx + 1}</span>
                        <img src={row.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded shadow-sm shrink-0 border border-outline-variant" />
                        <div className="flex-1 min-w-0">
                          <input
                            value={row.title}
                            onChange={e => updateBulkRow(row.id, { title: e.target.value })}
                            placeholder="Tiêu đề video"
                            disabled={row.status === "uploading" || row.status === "done"}
                            className="w-full h-8 px-2 rounded border border-outline-variant text-xs disabled:opacity-50 bg-surface-container-lowest"
                          />
                          <span className="text-[10px] text-on-surface-variant truncate block mt-0.5">{row.canonicalUrl}</span>
                        </div>
                        <div className="w-20 text-xs font-medium text-right shrink-0">
                          {row.status === "pending" && <span className="text-on-surface-variant">Chờ</span>}
                          {row.status === "uploading" && <span className="text-primary font-semibold animate-pulse">Đang tải…</span>}
                          {row.status === "done" && <span className="text-[#3f6212] font-semibold">✓ Xong</span>}
                          {row.status === "error" && <span className="text-error" title={row.error}>✗ Lỗi</span>}
                        </div>
                        {row.status !== "uploading" && row.status !== "done" && (
                          <button type="button" onClick={() => removeBulkRow(row.id)} title="Xóa khỏi danh sách" className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-error rounded hover:bg-error/10 shrink-0">
                            <X size={15} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="col-span-2 space-y-2">
              <label className="block text-sm font-medium text-on-surface">Đường dẫn video YouTube (URL)<input required type="text" placeholder="https://www.youtube.com/watch?v=... hoặc youtu.be/..." value={videoUrl} onChange={event=>{const val=event.target.value; setVideoUrl(val); if(!title.trim() && val.trim()) setTitle("Video YouTube");}} className="mt-1 w-full h-10 px-3 border border-outline-variant rounded-lg text-sm bg-surface-container-lowest"/><small className="block mt-1 text-on-surface-variant">Hỗ trợ link xem thường, link ngắn (youtu.be), Shorts, Live, nhúng (embed)...</small></label>
              {ytThumb && <div className="flex items-center gap-3 p-3 bg-surface-container rounded-lg border border-outline-variant"><img src={ytThumb} alt="YouTube thumbnail preview" className="w-24 h-14 object-cover rounded shadow-sm"/><div className="text-xs space-y-0.5"><span className="font-semibold text-primary flex items-center gap-1">✓ Đã nhận diện video YouTube</span><span className="text-on-surface-variant block truncate max-w-xs">{canonicalYoutubeUrl(videoUrl)}</span></div></div>}
            </div>
          )
        ) : !document && <label className="col-span-2 text-sm font-medium text-on-surface">File PDF, DOC hoặc DOCX<input required type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => setFile(event.target.files?.[0] ?? null)} className="mt-1 w-full p-2 border border-outline-variant rounded-lg"/><small className="block mt-1 text-on-surface-variant">Chỉ nhận PDF, DOC, DOCX. Hệ thống kiểm tra định dạng lại ở máy chủ.</small></label>}
        {mutation.isError && <div className="col-span-2 api-error">{errorMessage(mutation.error)}</div>}
      </div>
      <footer className="h-16 px-5 border-t border-outline-variant flex items-center justify-between shrink-0">
        {isBulkYt ? (
          <span className="text-xs text-on-surface-variant font-medium">
            {bulkDoneCount} / {bulkVideoRows.length} đã tải lên
          </span>
        ) : <div />}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="h-10 px-4 border border-outline-variant rounded-lg">{isBulkYt && bulkDoneCount > 0 ? "Đóng" : "Hủy"}</button>
          <button type="submit" disabled={!canSubmit} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-semibold flex items-center gap-2 disabled:opacity-50">{document ? <Pencil size={17}/> : <Upload size={17}/>} {isPending ? "Đang lưu..." : document ? "Lưu thay đổi" : isBulkYt ? `Tải lên (${bulkPendingCount})` : "Tải lên"}</button>
        </div>
      </footer>
    </form>
  </div>;
}

type BulkDocRow = { id: string; file: File; title: string; docType: string; chapterId: number; status: "pending" | "uploading" | "done" | "error"; error?: string };
const deriveDocTitle = (name: string) => name.replace(/\.[^.]+$/, "").trim() || name;

/** Modal tải nhiều tài liệu cùng lúc: chọn nhiều file hoặc dán danh sách link YouTube, tự gán tên, xác nhận loại/chuyên đề rồi tải lên tuần tự. */
function BulkDocumentUpload({ session, types, folders = [], initialFolderId = null, chapterGroups, onClose, onDone }: { session: AuthSession; types: MetadataOption[]; folders?: DocumentFolder[]; initialFolderId?: number | null; chapterGroups: ChapterGroup[]; onClose: () => void; onDone: () => void }) {
  const [tab, setTab] = useState<"files" | "youtube">("files");

  // File upload state
  const [rows, setRows] = useState<BulkDocRow[]>([]);
  const [defaultType, setDefaultType] = useState(types[0]?.value ?? "");
  const [defaultChapterId, setDefaultChapterId] = useState(0);
  const [busy, setBusy] = useState(false);

  // YouTube bulk state
  const [videoUrlsText, setVideoUrlsText] = useState("");
  const [videoRows, setVideoRows] = useState<BulkVideoRow[]>([]);
  const [videoChapterId, setVideoChapterId] = useState(0);
  const [videoFolderId, setVideoFolderId] = useState<number>(initialFolderId ?? 0);
  const [videoAudience, setVideoAudience] = useState("TEACHER_ONLY");

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

  const onVideoUrlsChange = (text: string) => {
    setVideoUrlsText(text);
    const parsed = parseYoutubeList(text);
    setVideoRows(current => {
      const existingTitles = new Map(current.map(r => [r.youtubeId, r.title]));
      return parsed.map(p => ({
        id: p.id,
        youtubeId: p.youtubeId,
        canonicalUrl: p.canonicalUrl,
        thumbnailUrl: p.thumbnailUrl,
        title: existingTitles.get(p.youtubeId) || p.title,
        status: "pending" as const,
      }));
    });
  };

  const updateVideoRow = (id: string, patch: Partial<BulkVideoRow>) => {
    setVideoRows(cur => cur.map(r => r.id === id ? { ...r, ...patch } : r));
  };

  const removeVideoRow = (id: string) => {
    setVideoRows(cur => cur.filter(r => r.id !== id));
  };

  const uploadAllVideos = async () => {
    setBusy(true);
    const pending = videoRows.filter(r => r.status === "pending" || r.status === "error");
    const CONCURRENCY = 3;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      await Promise.all(pending.slice(i, i + CONCURRENCY).map(async row => {
        updateVideoRow(row.id, { status: "uploading", error: undefined });
        try {
          const saved = await uploadTeacherDocument(session, {
            title: row.title.trim() || "Video YouTube",
            docType: "VIDEO",
            audience: videoAudience,
            chapterId: videoChapterId || null,
            videoUrl: row.canonicalUrl,
          });
          if (videoFolderId) {
            await moveTeacherDocument(session, saved.id, videoFolderId);
          }
          updateVideoRow(row.id, { status: "done" });
          onDone();
        } catch (reason) {
          updateVideoRow(row.id, { status: "error", error: errorMessage(reason) });
        }
      }));
    }
    setBusy(false);
  };

  const doneCount = rows.filter(row => row.status === "done").length;
  const canUploadFiles = rows.some(row => row.status === "pending" || row.status === "error");
  const videoDoneCount = videoRows.filter(row => row.status === "done").length;
  const canUploadVideos = videoRows.some(row => row.status === "pending" || row.status === "error");

  return <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="w-[780px] max-w-full max-h-[92vh] bg-surface-container-lowest rounded-lg shadow-xl flex flex-col overflow-hidden">
      <header className="h-14 px-5 border-b border-outline-variant flex items-center justify-between shrink-0"><h2 className="text-lg font-bold text-on-surface">Tải nhiều tài liệu</h2><button type="button" onClick={onClose} disabled={busy} aria-label="Đóng"><X size={20}/></button></header>
      
      <div className="flex border-b border-outline-variant px-5 bg-surface-container-low shrink-0">
        <button
          type="button"
          onClick={() => setTab("files")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            tab === "files" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <Upload size={16} /> Tải nhiều file (PDF, Word)
        </button>
        <button
          type="button"
          onClick={() => setTab("youtube")}
          className={`py-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            tab === "youtube" ? "border-primary text-primary" : "border-transparent text-on-surface-variant hover:text-on-surface"
          }`}
        >
          <PlayCircle size={16} /> Tải nhiều video YouTube
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4 overflow-y-auto">
        {tab === "files" ? (
          <>
            <label className="text-sm font-medium text-on-surface">Chọn file (PDF, DOC, DOCX — chọn được nhiều file cùng lúc)
              <input type="file" multiple accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { addFiles(event.target.files); event.target.value = ""; }} className="mt-1 w-full p-2 border border-outline-variant rounded-lg"/>
            </label>
            {rows.length > 0 && <>
              <div className="flex flex-wrap items-end gap-2 p-3 border border-outline-variant rounded-lg bg-surface-container-low">
                <label className="text-xs font-medium text-on-surface-variant">Loại tài liệu mặc định<select value={defaultType} onChange={event => setDefaultType(event.target.value)} className="mt-1 h-9 px-2 border border-outline-variant rounded-lg block">{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
                <label className="text-xs font-medium text-on-surface-variant">Chuyên đề mặc định<select value={defaultChapterId} onChange={event => setDefaultChapterId(Number(event.target.value))} className="mt-1 h-9 px-2 border border-outline-variant rounded-lg block"><option value={0}>Không gắn chương</option><ChapterOptions groups={chapterGroups}/></select></label>
                <button type="button" onClick={applyDefaults} className="h-9 px-3 border border-outline-variant rounded-lg text-sm font-semibold">Áp dụng cho tất cả</button>
              </div>
              <div className="flex flex-col gap-2 max-h-[40vh] overflow-y-auto pr-1">
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
          </>
        ) : (
          <>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-on-surface">
                  Dán danh sách link YouTube (mỗi link 1 dòng)
                </label>
                <span className="text-xs text-on-surface-variant font-medium">
                  Đã nhận diện: <b className="text-primary">{videoRows.length}</b> video
                </span>
              </div>
              <textarea
                rows={4}
                placeholder={`https://www.youtube.com/watch?v=...\nhttps://youtu.be/...\nhttps://www.youtube.com/shorts/...`}
                value={videoUrlsText}
                onChange={event => onVideoUrlsChange(event.target.value)}
                className="w-full p-2.5 rounded-lg border border-outline-variant text-xs focus:ring-2 focus:ring-primary outline-none bg-surface-container-lowest"
              />
              <small className="text-on-surface-variant block mt-1">
                Hỗ trợ link xem thường, link ngắn (youtu.be), Shorts, Live, nhúng (embed)... Tự động lọc trùng lặp.
              </small>
            </div>

            {videoRows.length > 0 && (
              <>
                <div className="flex flex-wrap items-end gap-2 p-3 border border-outline-variant rounded-lg bg-surface-container-low">
                  <label className="text-xs font-medium text-on-surface-variant">Chuyên đề áp dụng<select value={videoChapterId} onChange={event => setVideoChapterId(Number(event.target.value))} className="mt-1 h-9 px-2 border border-outline-variant rounded-lg block"><option value={0}>Không gắn chương</option><ChapterOptions groups={chapterGroups}/></select></label>
                  <label className="text-xs font-medium text-on-surface-variant">Thư mục áp dụng<select value={videoFolderId} onChange={event => setVideoFolderId(Number(event.target.value))} className="mt-1 h-9 px-2 border border-outline-variant rounded-lg block"><option value={0}>Chưa phân loại</option>{folders.map(folder => <option value={folder.id} key={folder.id}>{folder.name}</option>)}</select></label>
                  <label className="text-xs font-medium text-on-surface-variant">Phạm vi<select value={videoAudience} onChange={event => setVideoAudience(event.target.value)} className="mt-1 h-9 px-2 border border-outline-variant rounded-lg block"><option value="TEACHER_ONLY">Chỉ giáo viên</option><option value="STUDENT_ALLOWED">Cho phép học sinh</option></select></label>
                </div>

                <div className="flex flex-col gap-2 max-h-[36vh] overflow-y-auto pr-1">
                  {videoRows.map((row, idx) => (
                    <div key={row.id} className="flex items-center gap-3 p-2 rounded-lg border border-outline-variant bg-surface-container-lowest hover:bg-surface-container transition-colors">
                      <span className="text-xs font-semibold text-on-surface-variant w-5 text-center shrink-0">{idx + 1}</span>
                      <img src={row.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded shadow-sm shrink-0 border border-outline-variant" />
                      <div className="flex-1 min-w-0">
                        <input
                          value={row.title}
                          onChange={e => updateVideoRow(row.id, { title: e.target.value })}
                          placeholder="Tiêu đề video"
                          disabled={row.status === "uploading" || row.status === "done"}
                          className="w-full h-8 px-2 rounded border border-outline-variant text-xs disabled:opacity-50 bg-surface-container-lowest"
                        />
                        <span className="text-[10px] text-on-surface-variant truncate block mt-0.5">{row.canonicalUrl}</span>
                      </div>
                      <div className="w-20 text-xs font-medium text-right shrink-0">
                        {row.status === "pending" && <span className="text-on-surface-variant">Chờ</span>}
                        {row.status === "uploading" && <span className="text-primary font-semibold animate-pulse">Đang tải…</span>}
                        {row.status === "done" && <span className="text-[#3f6212] font-semibold">✓ Xong</span>}
                        {row.status === "error" && <span className="text-error" title={row.error}>✗ Lỗi</span>}
                      </div>
                      {row.status !== "uploading" && row.status !== "done" && (
                        <button type="button" onClick={() => removeVideoRow(row.id)} title="Xóa khỏi danh sách" className="w-7 h-7 flex items-center justify-center text-on-surface-variant hover:text-error rounded hover:bg-error/10 shrink-0">
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <footer className="h-16 px-5 border-t border-outline-variant flex items-center justify-between shrink-0">
        <span className="text-sm text-on-surface-variant">{tab === "files" ? `${doneCount} / ${rows.length} đã tải lên` : `${videoDoneCount} / ${videoRows.length} đã tải lên`}</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="h-10 px-4 border border-outline-variant rounded-lg">Đóng</button>
          {tab === "files" ? (
            <button type="button" onClick={() => void uploadAll()} disabled={busy || !canUploadFiles} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-semibold disabled:opacity-50">{busy ? "Đang tải…" : `Tải lên (${rows.filter(row => row.status === "pending" || row.status === "error").length})`}</button>
          ) : (
            <button type="button" onClick={() => void uploadAllVideos()} disabled={busy || !canUploadVideos} className="h-10 px-4 bg-primary text-on-primary rounded-lg font-semibold disabled:opacity-50">{busy ? "Đang tải…" : `Tải lên (${videoRows.filter(row => row.status === "pending" || row.status === "error").length})`}</button>
          )}
        </div>
      </footer>
    </div>
  </div>;
}
