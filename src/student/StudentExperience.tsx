import { useEffect, useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import {
  changePassword,
  getChapters,
  getCourses,
  getLastPosition,
  getMetadata,
  getMyAssignments,
  getMyCourses,
  getStudentDocuments,
  getStudentProgress,
  getTextbooks,
  getStudentTaxonomyTree,
  openDocumentFile,
  openTextbookInBrowser,
  saveLastPosition,
  type AuthSession,
  type Chapter,
  type Course,
  type StudentCourse,
  type DocumentItem,
  type LastPosition,
  type TaxonomyNode,
} from "../api";
import { MarkdownViewer } from "../components/MarkdownViewer";
import { PdfViewer, isPdfDocument } from "../components/PdfViewer";
import { YoutubeVideoModal, youtubeEmbedUrl, youtubeThumbnailUrl } from "../components/YoutubeVideoModal";
import { StudentShell, type StudentTab } from "./StudentShell";
import { ProfileSettings } from "../settings/ProfileSettings";
import { TodayPage } from "./TodayPage";
import { LessonsPage } from "./LessonsPage";
import { MyClassesPage } from "./MyClassesPage";
import { StudentFeesPage } from "../finance/StudentFeesPage";
import { LessonDetailPage } from "./LessonDetailPage";
import { AssignmentsPage } from "./AssignmentsPage";
import { WorksheetRunner } from "./WorksheetRunner";
import { avatarInitials, buildGreeting, formatPercent } from "./format";
import { AuthedImage } from "../lib/authedImage";
import { ProgramResourcePage } from "./ProgramResourcePage";
import { ChapterDetailPage } from "./ChapterDetailPage";
import { StudentHomePage } from "./StudentHomePage";
import { DocumentPreview } from "../components/DocumentPreview";

type StudentExperienceProps = {
  session: AuthSession;
  onLogout: () => void;
};

type Route =
  | { kind: "tab"; tab: StudentTab }
  | { kind: "lesson"; lessonId: number }
  | { kind: "chapter"; course: StudentCourse; chapterId: number }
  | { kind: "worksheet"; assignmentId: number };

// App không dùng react-router nên "vị trí" là chính state Route này, không phải URL. Khóa logic
// nằm ở cột route, còn id để trong context (jsonb) — thêm trang PDF hay câu số mấy sau này
// không phải migrate lại bảng.
const routeKey = (route: Route) => `student/${route.kind}`;
const routeContext = (route: Route): Record<string, unknown> =>
  route.kind === "tab" ? { tab: route.tab }
    : route.kind === "lesson" ? { lessonId: route.lessonId }
      : route.kind === "chapter" ? { courseId: route.course.id, chapterId: route.chapterId }
      : { assignmentId: route.assignmentId };

/** Chỉ dựng lại bài học và phiếu đang dở; quay về một cái tab thì chẳng đáng gọi là "học tiếp". */
function resumableRoute(row: LastPosition | null): Route | null {
  const context = row?.context;
  if (!row || !context) return null;
  if (row.route === "student/lesson" && typeof context.lessonId === "number") return { kind: "lesson", lessonId: context.lessonId };
  if (row.route === "student/worksheet" && typeof context.assignmentId === "number") return { kind: "worksheet", assignmentId: context.assignmentId };
  return null;
}

function ChangePasswordDialog({
  session,
  onClose,
}: {
  session: AuthSession;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await changePassword(session, current, next, confirm);
      setMessage("Đổi mật khẩu thành công.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (reason) {
      setMessage((reason as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
      <form onSubmit={submit} className="bg-surface-container-lowest border border-outline-variant rounded-xl w-full max-w-md p-6 space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Đổi mật khẩu</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="w-8 h-8 rounded-full hover:bg-surface-container">
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>
        <label className="block text-sm">Mật khẩu hiện tại
          <input type="password" required value={current} onChange={(e) => setCurrent(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface" />
        </label>
        <label className="block text-sm">Mật khẩu mới
          <input type="password" required value={next} onChange={(e) => setNext(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface" />
        </label>
        <label className="block text-sm">Nhập lại
          <input type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className="mt-1 w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface" />
        </label>
        {message && <div className="text-sm text-on-surface">{message}</div>}
        <footer className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-10 px-4 rounded-lg border border-outline-variant text-sm">Huỷ</button>
          <button type="submit" disabled={busy} className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-medium disabled:opacity-50">
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function ProfileTab({
  session,
  onChangePassword,
  onLogout,
}: {
  session: AuthSession;
  onChangePassword: () => void;
  onLogout: () => void;
}) {
  const courses = useQuery({
    queryKey: ["student-courses", session.userId],
    queryFn: () => getMyCourses(session),
  });
  const progress = useQuery({
    queryKey: ["student-progress", session.userId],
    queryFn: () => getStudentProgress(session),
  });
  const assignments = useQuery({
    queryKey: ["student-assignments", session.userId],
    queryFn: () => getMyAssignments(session),
  });

  const flatLessons = useMemo(() => courses.data?.flatMap((course) => course.chapters.flatMap((chapter) => chapter.lessons)) ?? [], [courses.data]);
  const completedLessons = flatLessons.filter((lesson) => (progress.data ?? []).find((item) => item.lessonId === lesson.id)?.completedAt || lesson.completionPercent >= 100).length;
  const completedAssignments = (assignments.data ?? []).filter((item) => item.progressStatus === "COMPLETED").length;
  const totalLessons = flatLessons.length;
  const percent = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <section className="md:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-4">
        <h2 className="text-lg font-semibold">Tiến độ của em</h2>
        <div className="grid grid-cols-3 gap-3">
          <article className="bg-surface-container-low rounded-xl p-4">
            <small className="text-xs text-on-surface-variant">Bài đã hoàn thành</small>
            <b className="block text-2xl mt-1">{completedLessons}/{totalLessons}</b>
          </article>
          <article className="bg-surface-container-low rounded-xl p-4">
            <small className="text-xs text-on-surface-variant">Phiếu đã nộp</small>
            <b className="block text-2xl mt-1">{completedAssignments}</b>
          </article>
          <article className="bg-surface-container-low rounded-xl p-4">
            <small className="text-xs text-on-surface-variant">Tỉ lệ hoàn thành</small>
            <b className="block text-2xl mt-1">{formatPercent(percent)}</b>
          </article>
        </div>
        <div>
          <div className="h-1 rounded-full bg-surface-container-highest overflow-hidden">
            <div className="h-full bg-primary" style={{ width: formatPercent(percent) }} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onChangePassword} className="h-10 px-4 rounded-lg border border-outline-variant text-sm font-medium">Đổi mật khẩu</button>
          <button type="button" onClick={onLogout} className="h-10 px-4 rounded-lg border border-outline-variant text-error text-sm font-medium hover:bg-error-container hover:border-error">Đăng xuất</button>
        </div>
      </section>
      <section className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-3">
        <h3 className="text-base font-semibold">Thông tin tài khoản</h3>
        <dl className="text-sm space-y-2">
          <div className="flex justify-between"><dt className="text-on-surface-variant">Email</dt><dd>{session.email}</dd></div>
          <div className="flex justify-between"><dt className="text-on-surface-variant">Vai trò</dt><dd>Học sinh</dd></div>
          <div className="flex justify-between"><dt className="text-on-surface-variant">Mã tài khoản</dt><dd>#{session.userId}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function TextbooksTab({ session }: { session: AuthSession }) {
  const query = useQuery({
    queryKey: ["student-textbooks"],
    queryFn: () => getTextbooks(session),
  });
  const [error, setError] = useState("");
  const openBook = async (id: number) => {
    try {
      await openTextbookInBrowser(session, id);
    } catch (reason) {
      setError((reason as Error).message);
    }
  };

  if (query.error) {
    return (
      <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">
        {(query.error as Error).message}
      </div>
    );
  }
  const books = query.data ?? [];
  if (!books.length) {
    return (
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
        Thư viện SGK chưa có sách phù hợp với khối của em.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm">{error}</div>}
      <h2 className="text-lg font-semibold">Sách giáo khoa</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {books.map((book) => (
          <article key={book.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 space-y-3">
            <div className="aspect-[3/4] bg-surface-container rounded-lg overflow-hidden">
              <AuthedImage url={book.thumbnailUrl} accessToken={session.accessToken} alt={book.title}
                className="w-full h-full object-cover"
                fallback={<div className="w-full h-full flex items-center justify-center text-on-surface-variant">
                  <span className="material-symbols-outlined text-4xl">auto_stories</span>
                </div>} />
            </div>
            <h3 className="text-base font-semibold">{book.title}</h3>
            <p className="text-xs text-on-surface-variant">
              {book.docType === "SGK" ? "Sách giáo khoa" : book.docType === "SBT" ? "Sách bài tập" : book.docType}
              {book.totalPages ? ` · ${book.totalPages} trang` : ""}
            </p>
            <button
              type="button"
              onClick={() => void openBook(book.id)}
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary text-on-primary text-sm font-medium"
            >
              Đọc sách
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Gom chương theo khóa học (dùng để lọc và gắn nhãn "chuyên đề" cho tài liệu). */
function useChapterLookup(session: AuthSession) {
  const coursesQuery = useQuery({ queryKey: ["courses", session.accessToken], queryFn: () => getCourses(session) });
  const courses = useMemo(() => coursesQuery.data ?? [], [coursesQuery.data]);
  const chapterQueries = useQueries({
    queries: courses.map((course) => ({
      queryKey: ["chapters", session.accessToken, course.id],
      queryFn: () => getChapters(session, course.id),
    })),
  });
  const groups = useMemo(
    () => courses.map((course, index) => ({ course, chapters: chapterQueries[index]?.data ?? [] })),
    [courses, chapterQueries],
  );
  const lookup = useMemo(() => {
    const map = new Map<number, { chapter: Chapter; course: Course }>();
    groups.forEach((group) => group.chapters.forEach((chapter) => map.set(chapter.id, { chapter, course: group.course })));
    return map;
  }, [groups]);
  return { groups, lookup };
}

function VideosTab({ session }: { session: AuthSession }) {
  const query = useQuery({ queryKey: ["student-materials", session.userId], queryFn: () => getStudentDocuments(session) });
  const { lookup } = useChapterLookup(session);
  const [selected, setSelected] = useState<DocumentItem | null>(null);
  const videos = (query.data ?? []).filter((doc) => doc.docType === "VIDEO");

  if (query.isLoading) return <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{[1,2,3].map(item => <div key={item} className="aspect-video animate-pulse rounded-xl bg-surface-container" />)}</div>;
  if (query.error) return <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">{(query.error as Error).message}</div>;

  return <div className="space-y-5">
    <div><h2 className="text-xl font-bold">Kho video bài học</h2><p className="mt-1 text-sm text-on-surface-variant">Xem các video được nhà trường thiết kế và chia sẻ cho em.</p></div>
    {!videos.length ? <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-10 text-center text-sm text-on-surface-variant">Chưa có video nào được chia sẻ.</div> :
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">{videos.map(video => {
        const info = video.chapterId ? lookup.get(video.chapterId) : undefined;
        const thumbnail = youtubeThumbnailUrl(video.fileUrl);
        return <article key={video.id} className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm">
          <button type="button" onClick={() => setSelected(video)} className="group relative flex aspect-video w-full items-center justify-center overflow-hidden bg-slate-900 text-white">
            {thumbnail && <img src={thumbnail} alt={`Ảnh video ${video.title}`} className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />}
            <span className="material-symbols-outlined relative z-10 text-[58px] drop-shadow-lg transition-transform group-hover:scale-110">play_circle</span>
          </button>
          <div className="p-4"><h3 className="line-clamp-2 text-sm font-semibold">{video.title}</h3><p className="mt-2 text-xs text-on-surface-variant">{info ? `${info.course.name} · ${info.chapter.title}` : "Video học tập"}</p><button type="button" onClick={() => setSelected(video)} className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-xs font-semibold text-on-primary"><span className="material-symbols-outlined text-[17px]">play_arrow</span>Xem video</button></div>
        </article>;
      })}</div>}
    {selected && <YoutubeVideoModal title={selected.title} url={selected.fileUrl} onClose={() => setSelected(null)} />}
  </div>;
}

function MaterialsTab({ session, mode }: { session: AuthSession; mode: "materials" | "topics" }) {
  const query = useQuery({ queryKey: ["student-materials", session.userId], queryFn: () => getStudentDocuments(session) });
  const metadataQuery = useQuery({ queryKey: ["metadata", session.accessToken], queryFn: () => getMetadata(session) });
  const { groups, lookup } = useChapterLookup(session);
  const [docType, setDocType] = useState("");
  const [openError, setOpenError] = useState("");
  const [markdownDoc, setMarkdownDoc] = useState<DocumentItem | null>(null);
  const [videoDoc, setVideoDoc] = useState<DocumentItem | null>(null);
  const [pdfDoc, setPdfDoc] = useState<DocumentItem | null>(null);

  const types = (metadataQuery.data?.documentTypes ?? []).filter((item) => item.value !== "DE_THI");
  const docs = (query.data ?? []).filter((doc) =>
    (mode === "topics" ? doc.chapterId != null : doc.chapterId == null)
  );
  const visible = useMemo(
    () => docs.filter((doc) => !docType || doc.docType === docType),
    [docs, docType],
  );
  // Chỉ ghép tên khóa học vào nhãn chương khi học sinh có nhiều hơn 1 khóa học —
  // tránh lặp thừa "Toán 10 · Chương X" ở mọi khối khi chỉ học đúng 1 khóa.
  const courseCount = useMemo(
    () => new Set(groups.filter((g) => g.chapters.length).map((g) => g.course.id)).size,
    [groups],
  );
  const sections = useMemo(() => {
    const map = new Map<string, { label: string; items: DocumentItem[] }>();
    visible.forEach((doc) => {
      const info = doc.chapterId ? lookup.get(doc.chapterId) : undefined;
      const isVideo = doc.docType === "VIDEO" || (!!doc.fileUrl && !!youtubeEmbedUrl(doc.fileUrl));
      const area = isVideo ? "video" : "document";
      const key = info ? `${area}-${info.course.id}-${info.chapter.id}` : `${area}-other`;
      const chapterLabel = info
        ? courseCount > 1
          ? `${info.course.name} · ${info.chapter.title}`
          : info.chapter.title
        : "Tài liệu dùng chung";
      const label = mode === "topics" ? `Chuyên đề · ${chapterLabel}` : chapterLabel;
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(doc);
    });
    return Array.from(map.values());
  }, [visible, lookup, courseCount, mode]);

  const openDoc = (doc: DocumentItem) => {
    if (doc.docType === "VIDEO" || (doc.fileUrl && youtubeEmbedUrl(doc.fileUrl))) {
      setVideoDoc(doc);
      return;
    }
    if (doc.contentMarkdown) {
      setMarkdownDoc(doc);
      return;
    }
    openFile(doc);
  };

  /** PDF xem ngay trong app; định dạng khác (docx…) vẫn đẩy sang tab mới như trước. */
  const openFile = (doc: DocumentItem) => {
    if (isPdfDocument(doc)) {
      setPdfDoc(doc);
      return;
    }
    openDocumentFile(session, doc.fileUrl, doc.title).catch((reason: unknown) => setOpenError((reason as Error).message));
  };

  if (query.error) {
    return (
      <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">
        {(query.error as Error).message}
      </div>
    );
  }
  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2, 3].map((item) => <div key={item} className="h-28 rounded-xl bg-surface-container animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {openError && <div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm">{openError}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label="Lọc loại tài liệu" value={docType} onChange={(e) => setDocType(e.target.value)} className="h-10 px-3 border border-outline-variant rounded-lg bg-surface text-sm">
          <option value="">Mọi loại</option>
          {types.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}
        </select>
      </div>
      {!sections.length && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center text-sm text-on-surface-variant">
          {mode === "topics" ? "Chưa có tài liệu chuyên đề nào được chia sẻ cho em." : "Chưa có tài liệu dùng chung nào được chia sẻ cho em."}
        </div>
      )}
      {sections.map((section) => (
        <section key={section.label} className="space-y-3">
          <h3 className="text-base font-semibold flex items-center gap-2"><span className="material-symbols-outlined text-primary">{section.items[0]?.docType === "VIDEO" ? "smart_display" : "auto_stories"}</span>{section.label}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {section.items.map((doc) => {
              const isYt = !!doc.fileUrl && !!youtubeEmbedUrl(doc.fileUrl);
              const isVid = doc.docType === "VIDEO" || isYt;
              const thumb = doc.thumbnailUrl || (isYt ? youtubeThumbnailUrl(doc.fileUrl) : undefined);
              return (
                <article key={doc.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 flex items-start gap-3 hover:border-primary/40 transition-colors">
                  <DocumentPreview
                    fileUrl={doc.fileUrl}
                    thumbnailUrl={doc.thumbnailUrl}
                    title={doc.title}
                    docType={doc.docType}
                    accessToken={session.accessToken}
                    variant="compact"
                    className="w-16 h-20 shadow-xs cursor-pointer shrink-0"
                    onClick={() => void openDoc(doc)}
                  />
                  <div className="min-w-0 flex-1">
                    <h4
                      className="font-semibold text-sm line-clamp-2 hover:text-primary cursor-pointer transition-colors"
                      onClick={() => void openDoc(doc)}
                    >
                      {doc.title}
                    </h4>
                    <p className="text-xs text-on-surface-variant mt-1">{types.find((item) => item.value === doc.docType)?.label ?? doc.docType}</p>
                    <button type="button" onClick={() => void openDoc(doc)} className="mt-2 inline-flex h-8 px-3 items-center rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-opacity">
                      {isVid ? "Xem video" : "Mở tài liệu"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {markdownDoc && markdownDoc.contentMarkdown && (
        <MarkdownViewer session={session} title={markdownDoc.title} markdown={markdownDoc.contentMarkdown} fileUrl={markdownDoc.fileUrl}
          onClose={() => setMarkdownDoc(null)}
          onOpenPdf={isPdfDocument(markdownDoc) ? () => { setMarkdownDoc(null); setPdfDoc(markdownDoc); } : undefined} />
      )}
      {videoDoc && videoDoc.fileUrl && <YoutubeVideoModal title={videoDoc.title} url={videoDoc.fileUrl} onClose={() => setVideoDoc(null)} />}
      {pdfDoc && <PdfViewer session={session} documentId={pdfDoc.id} title={pdfDoc.title} fileUrl={pdfDoc.fileUrl} onClose={() => setPdfDoc(null)} />}
    </div>
  );
}

function StudentTopicsTab({session}:{session:AuthSession}){
  const treeQuery=useQuery({queryKey:["student-taxonomy",session.userId],queryFn:()=>getStudentTaxonomyTree(session)});
  const docsQuery=useQuery({queryKey:["student-topic-documents",session.userId],queryFn:()=>getStudentDocuments(session)});
  const [expanded,setExpanded]=useState<number[]>([]),[selectedId,setSelectedId]=useState<number|null>(null),[pdfDoc,setPdfDoc]=useState<DocumentItem|null>(null),[markdownDoc,setMarkdownDoc]=useState<DocumentItem|null>(null),[videoDoc,setVideoDoc]=useState<DocumentItem|null>(null),[openError,setOpenError]=useState("");
  const nodes=treeQuery.data??[],docs=(docsQuery.data??[]).filter(doc=>doc.taxonomyNodeId!=null);
  const children=useMemo(()=>{const map=new Map<number,TaxonomyNode[]>();nodes.forEach(node=>{const key=node.parentId??0;if(!map.has(key))map.set(key,[]);map.get(key)!.push(node)});map.forEach(list=>list.sort((a,b)=>a.orderNo-b.orderNo));return map},[nodes]);
  const selected=nodes.find(node=>node.id===selectedId)??null;
  const selectedDocs=selectedId==null?[]:docs.filter(doc=>doc.taxonomyNodeId===selectedId);
  const openDoc=(doc:DocumentItem)=>{
    if(doc.docType==="VIDEO"||(doc.fileUrl&&youtubeEmbedUrl(doc.fileUrl))){setVideoDoc(doc);return}
    if(doc.contentMarkdown){setMarkdownDoc(doc);return}
    if(isPdfDocument(doc)){setPdfDoc(doc);return}
    openDocumentFile(session,doc.fileUrl,doc.title).catch(reason=>setOpenError((reason as Error).message))
  };
  if(treeQuery.isLoading||docsQuery.isLoading)return <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4"><div className="h-80 rounded-xl bg-surface-container animate-pulse"/><div className="h-80 rounded-xl bg-surface-container animate-pulse"/></div>;
  const error=treeQuery.error||docsQuery.error;if(error)return <div className="bg-error-container text-on-error-container px-4 py-3 rounded-lg text-sm">{(error as Error).message}</div>;
  return <div className="space-y-5"><header><h2 className="text-xl font-bold">Chuyên đề học tập</h2><p className="mt-1 text-sm text-on-surface-variant">Nội dung chính thức do quản trị viên biên soạn.</p></header>{openError&&<div className="bg-error-container text-on-error-container px-4 py-2 rounded-lg text-sm">{openError}</div>}<div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-4 items-start"><aside className="rounded-xl border border-outline-variant bg-surface-container-lowest overflow-hidden"><div className="px-4 py-3 border-b border-outline-variant"><b className="text-sm">Cây chuyên đề</b><p className="text-[11px] text-on-surface-variant">Chuyên đề · Bài · Dạng</p></div><div className="max-h-[65vh] overflow-auto py-1">{(children.get(0)??[]).map(node=><StudentTopicRow key={node.id} node={node} level={0} children={children} expanded={expanded} selectedId={selectedId} onToggle={id=>setExpanded(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id])} onSelect={setSelectedId}/>)}{!nodes.length&&<p className="p-4 text-sm text-on-surface-variant">Admin chưa tạo chuyên đề nào.</p>}</div></aside><section className="min-h-80 rounded-xl border border-outline-variant bg-surface-container-lowest">{!selected?<div className="h-80 grid place-items-center text-center text-sm text-on-surface-variant p-8">Chọn một chuyên đề hoặc bài học để xem nội dung.</div>:<><header className="p-5 border-b border-outline-variant"><span className="text-[11px] font-semibold text-primary">{selected.depth===1?"CHUYÊN ĐỀ":selected.depth===2?"BÀI HỌC":"DẠNG TOÁN"}</span><h3 className="mt-1 text-lg font-bold">{selected.title}</h3>{selected.description&&<p className="mt-2 text-sm text-on-surface-variant">{selected.description}</p>}</header><div className="p-5"><h4 className="text-sm font-semibold mb-3">Tài liệu học tập ({selectedDocs.length})</h4>{selectedDocs.length?<div className="grid grid-cols-1 md:grid-cols-2 gap-3">{selectedDocs.map(doc=><div key={doc.id} onClick={()=>openDoc(doc)} className="p-3.5 rounded-xl border border-outline-variant bg-surface-container-lowest flex items-start gap-3 text-left hover:border-primary/50 hover:bg-surface-container-low transition-colors cursor-pointer"><DocumentPreview fileUrl={doc.fileUrl} thumbnailUrl={doc.thumbnailUrl} title={doc.title} docType={doc.docType} accessToken={session.accessToken} variant="compact" className="w-16 h-20 shadow-xs shrink-0"/><div className="min-w-0 flex-1"><b className="block text-sm text-on-surface line-clamp-2 leading-tight">{doc.title}</b><small className="block mt-1 text-xs text-on-surface-variant">{doc.docType}</small><button type="button" onClick={e=>{e.stopPropagation();openDoc(doc);}} className="mt-2 inline-flex h-7 px-2.5 items-center rounded-md bg-primary text-on-primary text-[11px] font-medium hover:opacity-90 transition-opacity">{doc.docType==="VIDEO"?"Xem video":"Xem tài liệu"}</button></div></div>)}</div>:<p className="py-8 text-center text-sm text-on-surface-variant">Mục này chưa có tài liệu được chia sẻ cho em.</p>}</div></>}</section></div>{pdfDoc&&<PdfViewer session={session} documentId={pdfDoc.id} title={pdfDoc.title} fileUrl={pdfDoc.fileUrl} onClose={()=>setPdfDoc(null)}/>} {markdownDoc&&<MarkdownViewer session={session} title={markdownDoc.title} markdown={markdownDoc.contentMarkdown??""} fileUrl={markdownDoc.fileUrl} onClose={()=>setMarkdownDoc(null)} onOpenPdf={isPdfDocument(markdownDoc)?()=>{setMarkdownDoc(null);setPdfDoc(markdownDoc)}:undefined}/>} {videoDoc&&videoDoc.fileUrl&&<YoutubeVideoModal title={videoDoc.title} url={videoDoc.fileUrl} onClose={()=>setVideoDoc(null)}/>}</div>;
}

function StudentTopicRow({node,level,children,expanded,selectedId,onToggle,onSelect}:{node:TaxonomyNode;level:number;children:Map<number,TaxonomyNode[]>;expanded:number[];selectedId:number|null;onToggle:(id:number)=>void;onSelect:(id:number)=>void}){const items=children.get(node.id)??[],open=expanded.includes(node.id);return <div><div className={`flex items-center pr-2 ${selectedId===node.id?"bg-primary-container/20":"hover:bg-surface-container-low"}`} style={{paddingLeft:8+level*14}}><button type="button" disabled={!items.length} onClick={()=>onToggle(node.id)} className="w-7 h-9 grid place-items-center disabled:opacity-0"><span className="material-symbols-outlined text-[18px]">{open?"expand_more":"chevron_right"}</span></button><button type="button" onClick={()=>onSelect(node.id)} className="flex-1 min-w-0 py-2 text-left text-sm truncate">{node.title}</button>{node.documentCount>0&&<small className="text-on-surface-variant">{node.documentCount}</small>}</div>{open&&items.map(child=><StudentTopicRow key={child.id} node={child} level={level+1} children={children} expanded={expanded} selectedId={selectedId} onToggle={onToggle} onSelect={onSelect}/>)}</div>}

export function StudentExperience({ session, onLogout }: StudentExperienceProps) {
  const [route, setRoute] = useState<Route>({ kind: "tab", tab: "today" });
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [resume, setResume] = useState<Route | null>(null);

  const tab: StudentTab = route.kind === "tab" ? route.tab : route.kind === "lesson" || route.kind === "chapter" ? "lessons" : "assignments";

  const openLesson = (lessonId: number) => setRoute({ kind: "lesson", lessonId });
  const openWorksheet = (assignmentId: number) => setRoute({ kind: "worksheet", assignmentId });
  const goTab = (next: StudentTab) => setRoute({ kind: "tab", tab: next });

  // Gợi ý quay lại chỗ đang dở thay vì tự nhảy tới: tự nhảy thì em vừa đăng nhập đã bị ném vào
  // giữa một bài mình không chọn, và không có cách nào thoát ra ngoài trừ bấm lùi.
  useEffect(() => {
    let alive = true;
    getLastPosition(session)
      .then(row => { if (alive) setResume(resumableRoute(row)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [session]);

  // Ghi sau khi em đứng yên 2 giây, để bấm lướt qua vài tab không bắn ra một loạt request.
  useEffect(() => {
    const timer = setTimeout(() => { saveLastPosition(session, routeKey(route), routeContext(route)).catch(() => {}); }, 2000);
    return () => clearTimeout(timer);
  }, [session, route]);

  return (
    <StudentShell
      session={session}
      tab={tab}
      onTabChange={goTab}
      onLogout={onLogout}
      onChangePassword={() => setPasswordOpen(true)}
      greeting={buildGreeting(session)}
      avatarLabel={avatarInitials(session)}
    >
      {route.kind === "tab" && resume && (
        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap rounded-lg border border-outline-variant bg-primary-container/30 p-3">
          <p className="text-sm text-on-surface">
            Em đang dở {resume.kind === "lesson" ? "một bài học" : "một phiếu bài tập"} lần trước.
          </p>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setResume(null)}
              className="h-9 px-3 rounded-lg text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              Để sau
            </button>
            <button type="button" onClick={() => { setRoute(resume); setResume(null); }}
              className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity">
              Học tiếp
            </button>
          </div>
        </div>
      )}
      {route.kind === "lesson" ? (
        <LessonDetailPage session={session} lessonId={route.lessonId} onBack={() => goTab("lessons")} onOpenLesson={openLesson} />
      ) : route.kind === "chapter" ? (
        <ChapterDetailPage session={session} course={route.course} chapterId={route.chapterId} onBack={() => goTab("lessons")} onOpenLesson={openLesson} />
      ) : route.kind === "worksheet" ? (
        <WorksheetRunner session={session} assignmentId={route.assignmentId} onBack={() => goTab("assignments")} />
      ) : route.tab === "today" ? (
        <StudentHomePage
          session={session}
          onOpenLesson={openLesson}
          onOpenWorksheet={openWorksheet}
          onSeeAllAssignments={() => goTab("assignments")}
          onGoTab={goTab}
        />
      ) : route.tab === "fees" ? (
        <StudentFeesPage session={session}/>
      ) : route.tab === "classes" ? (
        <MyClassesPage session={session} onOpenLesson={openLesson} onOpenWorksheet={openWorksheet} />
      ) : route.tab === "lessons" ? (
        <LessonsPage session={session} onOpenLesson={openLesson} onOpenChapter={(course,chapterId)=>setRoute({kind:"chapter",course,chapterId})} />
      ) : route.tab === "videos" ? (
        <ProgramResourcePage session={session} type="VIDEO" />
      ) : route.tab === "assignments" ? (
        <AssignmentsPage session={session} onOpenLesson={openLesson} onOpenWorksheet={openWorksheet} />
      ) : route.tab === "textbooks" ? (
        <TextbooksTab session={session} />
      ) : route.tab === "materials" ? (
        <ProgramResourcePage session={session} type="DOCUMENT" />
      ) : route.tab === "exercises" ? (
        <ProgramResourcePage session={session} type="EXERCISE" />
      ) : route.tab === "settings" ? (
        <ProfileSettings session={session}/>
      ) : (
        <ProfileTab session={session} onChangePassword={() => setPasswordOpen(true)} onLogout={onLogout} />
      )}
      {passwordOpen && <ChangePasswordDialog session={session} onClose={() => setPasswordOpen(false)} />}
    </StudentShell>
  );
}
