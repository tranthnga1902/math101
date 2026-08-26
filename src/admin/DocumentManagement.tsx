import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Plus, X } from "lucide-react";
import {
  convertDocumentToMarkdown,
  deleteDocument,
  getDocuments,
  getMetadata,
  openDocumentFile,
  saveDocumentMarkdown,
  uploadDocument,
  type AuthSession,
  type DocumentItem,
  type MetadataOption,
} from "../api";
import { OcrCancelled, ocrPdfToMarkdown } from "../lib/pdfOcr";
import { PdfThumbnail } from "../PdfThumbnail";
import { MarkdownViewer } from "../components/MarkdownViewer";
import { PdfViewer, isPdfDocument } from "../components/PdfViewer";
import { YoutubeVideoModal, youtubeEmbedUrl, youtubeThumbnailUrl } from "../components/YoutubeVideoModal";
import "./document-management.css";

const isPdfDoc = isPdfDocument;

type ManagedType = MetadataOption & { builtin: boolean };
type CategoryDialog = { mode: "create" } | { mode: "rename"; category: ManagedType } | null;

const message = (reason: unknown) => reason instanceof Error ? reason.message : "Không thể thực hiện thao tác";
const storageKey = (session: AuthSession) => `math10.document-categories.${session.userId}`;
const hiddenStorageKey = (session: AuthSession) => `math10.hidden-document-categories.${session.userId}`;
const mappingStorageKey = (session: AuthSession) => `math10.document-category-mappings.${session.userId}`;
const DOCUMENTS_QUERY_KEY = "admin-documents";
const METADATA_QUERY_KEY = "admin-document-metadata";

function loadSavedTypes(session: AuthSession): ManagedType[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(session)) || "[]") as ManagedType[];
    return Array.isArray(parsed) ? parsed.filter(item => item?.value && item?.label) : [];
  } catch {
    return [];
  }
}

export function DocumentManagement({ session }: { session: AuthSession }) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<DocumentItem[]>([]);
  const [types, setTypes] = useState<ManagedType[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [upload, setUpload] = useState(false);
  const [bulkUpload, setBulkUpload] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [openDocMenu, setOpenDocMenu] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog>(null);
  const [deleteType, setDeleteType] = useState<ManagedType | null>(null);
  const [markdownDoc, setMarkdownDoc] = useState<DocumentItem | null>(null);
  const [videoDoc, setVideoDoc] = useState<DocumentItem | null>(null);
  const [pdfDoc, setPdfDoc] = useState<DocumentItem | null>(null);
  const [converting, setConverting] = useState<number | null>(null);
  const [convertErrors, setConvertErrors] = useState<Record<number, string>>({});
  const [ocrJob, setOcrJob] = useState<{ id: number; text: string } | null>(null);
  const menuArea = useRef<HTMLElement>(null);
  // Cờ hủy đọc qua ref: vòng lặp OCR đang chạy phải thấy giá trị mới nhất, state thì
  // bị đóng băng trong closure của lần render đã bắt đầu công việc.
  const ocrCancel = useRef(false);

  const documentsQuery = useQuery({ queryKey: [DOCUMENTS_QUERY_KEY, session.accessToken], queryFn: () => getDocuments(session) });
  const metadataQuery = useQuery({ queryKey: [METADATA_QUERY_KEY, session.accessToken], queryFn: () => getMetadata(session) });
  const invalidateDocuments = () => queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
  const error = documentsQuery.isError ? message(documentsQuery.error) : metadataQuery.isError ? message(metadataQuery.error) : "";
  const persistCategoryMapping = (document: DocumentItem, category: ManagedType) => {
    if (category.builtin) return;
    const mappings = JSON.parse(localStorage.getItem(mappingStorageKey(session)) || "{}") as Record<string, string>;
    mappings[String(document.id)] = category.value;
    localStorage.setItem(mappingStorageKey(session), JSON.stringify(mappings));
  };

  const convertMutation = useMutation({
    mutationFn: (id: number) => convertDocumentToMarkdown(session, id),
    onMutate: (id: number) => {
      setConverting(id);
      setConvertErrors(current => { const next = { ...current }; delete next[id]; return next; });
    },
    onSuccess: () => { void invalidateDocuments(); },
    onError: (reason: unknown, id: number) => { setConvertErrors(current => ({ ...current, [id]: message(reason) })); },
    onSettled: () => setConverting(null),
  });
  const openRow = (row: DocumentItem) => {
    if (row.docType === "VIDEO") { setVideoDoc(row); return; }
    if (row.contentMarkdown) { setMarkdownDoc(row); return; }
    openFile(row);
  };
  /** PDF xem ngay trong app; định dạng khác (docx…) vẫn đẩy sang tab mới như trước. */
  const openFile = (row: DocumentItem) => {
    if (isPdfDoc(row)) { setPdfDoc(row); return; }
    void openDocumentFile(session, row.fileUrl, row.title);
  };

  const persistTypes = useCallback((next: ManagedType[]) => {
    setTypes(next);
    localStorage.setItem(storageKey(session), JSON.stringify(next));
  }, [session]);

  useEffect(() => {
    if (!documentsQuery.data || !metadataQuery.data) return;
    const documents = documentsQuery.data;
    const metadata = metadataQuery.data;
    const saved = loadSavedTypes(session);
    const hidden = new Set<string>(JSON.parse(localStorage.getItem(hiddenStorageKey(session)) || "[]"));
    const savedByValue = new Map(saved.map(item => [item.value, item]));
    const builtin = metadata.documentTypes.filter(item => !hidden.has(item.value)).map(item => ({
      ...item,
      label: savedByValue.get(item.value)?.label || item.label,
      builtin: true,
    }));
    const custom = saved.filter(item => !metadata.documentTypes.some(base => base.value === item.value));
    const mappings = JSON.parse(localStorage.getItem(mappingStorageKey(session)) || "{}") as Record<string, string>;
    setRows(documents.map(document => ({ ...document, docType: mappings[String(document.id)] || document.docType })));
    setTypes([...builtin, ...custom]);
  }, [documentsQuery.data, metadataQuery.data, session]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!menuArea.current?.contains(target)) setOpenMenu(null);
      // Bấm lại chính nút ⋮ phải đóng menu (do onClick xử lý) — nếu đóng luôn ở đây thì
      // onClick sẽ mở lại ngay sau đó và menu không bao giờ tắt được bằng nút.
      if (!target.closest(".doc-menu") && !target.closest(".doc-menu-trigger")) setOpenDocMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDocument(session, id),
    onMutate: () => setDeleteError(""),
    onSuccess: () => { void invalidateDocuments(); },
    onError: (reason: unknown) => setDeleteError(message(reason)),
  });

  const visible = useMemo(() => rows.filter(row =>
    (!selectedTypes.length || selectedTypes.includes(row.docType)) &&
    row.title.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))
  ), [rows, selectedTypes, search]);
  const counts = useMemo(() => Object.fromEntries(types.map(type => [type.value, rows.filter(row => row.docType === type.value).length])), [rows, types]);
  const toggleType = (value: string) => setSelectedTypes(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const deleteOne = (row: DocumentItem) => {
    if (!confirm(`Xóa tài liệu "${row.title}"? Thao tác này không hoàn tác được.`)) return;
    deleteMutation.mutate(row.id);
  };
  /** OCR chạy ngay trên trình duyệt này (backend không có OCR) — xem src/lib/pdfOcr.ts. */
  const runOcr = async (row: DocumentItem) => {
    if (ocrJob) return;
    if (!confirm(`Nhận dạng chữ trong "${row.title}"?\n\nMáy sẽ đọc từng trang ngay trên trình duyệt này — mỗi trang mất vài giây, đừng đóng tab. Lần đầu cần tải khoảng 5 MB dữ liệu nhận dạng.\n\nCông thức toán thường bị sai, bạn nhớ đọc lại và sửa sau khi xong.`)) return;
    ocrCancel.current = false;
    setConvertErrors(current => { const next = { ...current }; delete next[row.id]; return next; });
    setOcrJob({ id: row.id, text: "Đang tải file PDF…" });
    try {
      const result = await ocrPdfToMarkdown({
        fileUrl: row.fileUrl,
        accessToken: session.accessToken,
        isCancelled: () => ocrCancel.current,
        onProgress: progress => setOcrJob({
          id: row.id,
          text: progress.phase === "download" ? "Đang tải file PDF…"
            : progress.phase === "prepare" ? "Đang tải bộ nhận dạng tiếng Việt…"
            : `Đang đọc trang ${progress.page}/${progress.total}…`,
        }),
      });
      setOcrJob({ id: row.id, text: "Đang lưu nội dung…" });
      await saveDocumentMarkdown(session, row.id, result.markdown);
      await invalidateDocuments();
    } catch (reason) {
      if (!(reason instanceof OcrCancelled)) setConvertErrors(current => ({ ...current, [row.id]: message(reason) }));
    } finally {
      setOcrJob(null);
    }
  };
  const saveCategory = (name: string) => {
    const label = name.trim();
    if (!label) return;
    if (categoryDialog?.mode === "rename") {
      persistTypes(types.map(item => item.value === categoryDialog.category.value ? { ...item, label } : item));
    } else {
      persistTypes([...types, { value: `CUSTOM_${Date.now()}`, label, builtin: false }]);
    }
    setCategoryDialog(null);
  };
  const removeCategory = () => {
    if (!deleteType) return;
    if (deleteType.builtin) {
      const hidden = new Set<string>(JSON.parse(localStorage.getItem(hiddenStorageKey(session)) || "[]"));
      hidden.add(deleteType.value);
      localStorage.setItem(hiddenStorageKey(session), JSON.stringify([...hidden]));
    }
    persistTypes(types.filter(item => item.value !== deleteType.value));
    setSelectedTypes(current => current.filter(value => value !== deleteType.value));
    setDeleteType(null);
  };

  return <section className="docs-page">
    <aside className="docs-filter" ref={menuArea}>
      <div className="docs-filter-heading"><h3>LOẠI FILE</h3><button aria-label="Thêm phân loại" title="Thêm phân loại" onClick={() => setCategoryDialog({ mode: "create" })}><Plus size={17} /></button></div>
      <div className="docs-category-row">
        <label><input type="checkbox" checked={!selectedTypes.length} onChange={() => setSelectedTypes([])} /><span>Tất cả tài liệu</span><b>{rows.length}</b></label>
        <button className="docs-category-more" aria-label="Tất cả tài liệu là phân loại mặc định" title="Không thể sửa phân loại mặc định này" disabled><MoreVertical size={17} /></button>
      </div>
      {types.map(item => <div className="docs-category-row" key={item.value}>
        <label><input type="checkbox" checked={selectedTypes.includes(item.value)} onChange={() => toggleType(item.value)} /><span title={item.label}>{item.label}</span><b>{counts[item.value] ?? 0}</b></label>
        <button className="docs-category-more" aria-label={`Thao tác với ${item.label}`} aria-expanded={openMenu === item.value} onClick={() => setOpenMenu(current => current === item.value ? null : item.value)}><MoreVertical size={17} /></button>
        {openMenu === item.value && <div className="docs-category-menu" role="menu">
          <button role="menuitem" onClick={() => { setOpenMenu(null); setCategoryDialog({ mode: "rename", category: item }); }}>Đổi tên</button>
          <button className="danger" role="menuitem" onClick={() => { setOpenMenu(null); setDeleteType(item); }}>Xóa</button>
        </div>}
      </div>)}
    </aside>
    <main>
      <div className="docs-toolbar"><div><h1>Kho Tài Liệu</h1><input aria-label="Tìm kiếm tài liệu" placeholder="Tìm kiếm tài liệu…" value={search} onChange={event => setSearch(event.target.value)} /></div><div><button onClick={() => setBulkUpload(true)}>Tải nhiều file</button><button className="docs-primary" onClick={() => setUpload(true)}>Tải lên</button></div></div>
      {(error || deleteError) && <div className="api-error">{error || deleteError}</div>}
      <div className="docs-collection">{visible.map(row => { const thumbnail = row.docType === "VIDEO" ? youtubeThumbnailUrl(row.fileUrl) : null; return <article key={row.id}><button className={`doc-preview${thumbnail ? " doc-video-preview" : ""}`} onClick={() => openRow(row)}>{thumbnail ? <><img src={thumbnail} alt={`Ảnh video ${row.title}`}/><span className="doc-video-play material-symbols-outlined">play_circle</span></> : row.fileUrl && row.docType !== "VIDEO" ? <PdfThumbnail fileUrl={row.fileUrl} accessToken={session.accessToken} pageNumber={1} className="doc-pdf-preview" renderScale={0.75} thumbnailUrl={row.thumbnailUrl} docType={row.docType}/> : <span className={`doc-kind ${row.docType.toLowerCase()}`}>{row.docType === "VIDEO" ? "VIDEO" : "TÀI LIỆU"}</span>}</button><div className="doc-info"><div><h2>{row.title}</h2><span className="doc-menu-wrap"><button className="doc-menu-trigger" aria-label={`Thao tác với ${row.title}`} aria-expanded={openDocMenu === row.id} onClick={() => setOpenDocMenu(current => current === row.id ? null : row.id)}><MoreVertical size={17}/></button>{openDocMenu === row.id && <span className="doc-menu" role="menu"><button role="menuitem" onClick={() => { setOpenDocMenu(null); openRow(row); }}>{row.contentMarkdown ? "Đọc bản Markdown" : row.docType === "VIDEO" ? "Xem video" : "Mở tài liệu"}</button>{row.contentMarkdown && <button role="menuitem" onClick={() => { setOpenDocMenu(null); openFile(row); }}>Mở file gốc</button>}{isPdfDoc(row) && !row.contentMarkdown && <button role="menuitem" disabled={converting === row.id} onClick={() => { setOpenDocMenu(null); convertMutation.mutate(row.id); }}>{converting === row.id ? "Đang chuyển đổi…" : "Chuyển sang Markdown"}</button>}{isPdfDoc(row) && <button role="menuitem" disabled={!!ocrJob || converting === row.id} onClick={() => { setOpenDocMenu(null); void runOcr(row); }}>{row.contentMarkdown ? "Nhận dạng lại chữ (OCR)" : "Nhận dạng chữ (OCR)"}</button>}<hr/><button className="danger" role="menuitem" disabled={deleteMutation.isPending} onClick={() => { setOpenDocMenu(null); deleteOne(row); }}>Xóa tài liệu</button></span>}</span></div><p><span>{types.find(item => item.value === row.docType)?.label ?? row.docType}</span><time>{new Intl.DateTimeFormat("vi-VN").format(new Date(row.createdAt))}</time></p>{isPdfDoc(row) && (row.contentMarkdown || converting === row.id || ocrJob?.id === row.id || convertErrors[row.id]) && <p className="doc-markdown-row">{ocrJob?.id === row.id ? <><span className="doc-markdown-badge">{ocrJob.text}</span><button className="doc-ocr-cancel" onClick={() => { ocrCancel.current = true; }}>Hủy</button></> : row.contentMarkdown ? <span className="doc-markdown-badge">Markdown ✓</span> : converting === row.id ? <span className="doc-markdown-badge">Đang chuyển đổi…</span> : null}{convertErrors[row.id] && <span className="doc-markdown-error">{convertErrors[row.id]}</span>}</p>}</div></article>; })}</div>
      {!visible.length && <div className="docs-empty">Không có tài liệu phù hợp.</div>}
    </main>
    {upload && <DocumentUpload session={session} types={types} onClose={() => setUpload(false)} onDone={async (document, category) => {
      persistCategoryMapping(document, category);
      setUpload(false);
      await invalidateDocuments();
    }} />}
    {categoryDialog && <CategoryEditor initialName={categoryDialog.mode === "rename" ? categoryDialog.category.label : ""} title={categoryDialog.mode === "rename" ? "Đổi tên phân loại" : "Thêm phân loại"} onClose={() => setCategoryDialog(null)} onSave={saveCategory} />}
    {deleteType && <DeleteCategoryDialog category={deleteType} count={counts[deleteType.value] ?? 0} targets={types.filter(item => item.value !== deleteType.value)} onClose={() => setDeleteType(null)} onDelete={removeCategory} />}
    {markdownDoc && markdownDoc.contentMarkdown && <MarkdownViewer session={session} title={markdownDoc.title} markdown={markdownDoc.contentMarkdown} fileUrl={markdownDoc.fileUrl} onClose={() => setMarkdownDoc(null)} onOpenPdf={isPdfDoc(markdownDoc) ? () => { setMarkdownDoc(null); setPdfDoc(markdownDoc); } : undefined} />}
    {pdfDoc && <PdfViewer session={session} documentId={pdfDoc.id} title={pdfDoc.title} fileUrl={pdfDoc.fileUrl} onClose={() => setPdfDoc(null)} />}
    {videoDoc && <YoutubeVideoModal title={videoDoc.title} url={videoDoc.fileUrl} onClose={() => setVideoDoc(null)} />}
    {bulkUpload && <AdminBulkUpload session={session} types={types} onClose={() => setBulkUpload(false)} onRowDone={persistCategoryMapping} onDone={invalidateDocuments} />}
  </section>;
}

function CategoryEditor({ initialName, title, onClose, onSave }: { initialName: string; title: string; onClose: () => void; onSave: (name: string) => void }) {
  const [name, setName] = useState(initialName);
  return <div className="docs-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><form className="docs-modal docs-category-modal" onSubmit={event => { event.preventDefault(); onSave(name); }}><header><h2>{title}</h2><button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button></header><label>Tên phân loại mới<input autoFocus required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label><footer><button type="button" onClick={onClose}>Hủy</button><button className="docs-primary" disabled={!name.trim()}>Lưu</button></footer></form></div>;
}

function DeleteCategoryDialog({ category, count, targets, onClose, onDelete }: { category: ManagedType; count: number; targets: ManagedType[]; onClose: () => void; onDelete: () => void }) {
  const [destination, setDestination] = useState("");
  return <div className="docs-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}><section className="docs-modal docs-category-modal" role="dialog" aria-modal="true" aria-labelledby="delete-category-title"><header><h2 id="delete-category-title">Xóa phân loại</h2><button type="button" aria-label="Đóng" onClick={onClose}><X size={18} /></button></header><p>Bạn có chắc muốn xóa phân loại này không?</p><strong>{category.label}</strong>{count > 0 && <><label>Chuyển {count} tài liệu sang<select required value={destination} onChange={event => setDestination(event.target.value)}><option value="">Chưa phân loại</option>{targets.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label><small>Phân loại sẽ được gỡ khỏi danh sách; tài liệu bên trong vẫn an toàn và có thể xem tại “Tất cả tài liệu”.</small></>}<footer><button type="button" onClick={onClose}>Hủy</button><button type="button" className="docs-danger" onClick={onDelete}>Xóa phân loại</button></footer></section></div>;
}

function DocumentUpload({ session, types, onClose, onDone }: { session: AuthSession; types: ManagedType[]; onClose: () => void; onDone: (document: DocumentItem, category: ManagedType) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(types[0]?.value ?? "");
  const [audience, setAudience] = useState("TEACHER_RESTRICTED");
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const category = types.find(item => item.value === type);
    if (!category) return;
    const isVideo = category.builtin && category.value === "VIDEO";
    if ((!isVideo && !file) || (isVideo && !youtubeEmbedUrl(videoUrl))) return;
    setBusy(true);
    try {
      const backendType = category.builtin ? category.value : (types.find(item => item.builtin && item.value === "KHBD")?.value || types.find(item => item.builtin)?.value || "KHBD");
      const document = await uploadDocument(session, { title, docType: backendType, audience, file: isVideo ? null : file, videoUrl: isVideo ? videoUrl.trim() : null });
      await onDone(document, category);
    } catch (reason) {
      setError(message(reason));
      setBusy(false);
    }
  };
  const isVideo = types.find(item => item.value === type)?.builtin && type === "VIDEO";
  const invalidVideo = isVideo && !!videoUrl && !youtubeEmbedUrl(videoUrl);
  return <div className="docs-overlay"><form className="docs-modal" onSubmit={submit}><header><h2>{isVideo ? "Thêm video YouTube" : "Tải tài liệu lên"}</h2><button type="button" onClick={onClose}>×</button></header><label>Tên tài liệu<input required value={title} onChange={event => setTitle(event.target.value)} /></label><label>Loại tài liệu<select required value={type} onChange={event => setType(event.target.value)}>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label>Phạm vi<select value={audience} onChange={event => setAudience(event.target.value)}><option value="TEACHER_RESTRICTED">Chỉ giáo viên</option><option value="STUDENT_ALLOWED">Cho phép học sinh</option></select></label>{isVideo ? <label>Link video YouTube<input required type="url" placeholder="https://www.youtube.com/watch?v=..." value={videoUrl} onChange={event => setVideoUrl(event.target.value)} />{invalidVideo && <small className="docs-field-error">Link YouTube không hợp lệ.</small>}<small>Video sẽ phát ngay trong website, học sinh không bị chuyển sang YouTube.</small></label> : <label>Chọn file<input required type="file" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>}{error && <div className="api-error">{error}</div>}<footer><button type="button" onClick={onClose}>Hủy</button><button className="docs-primary" disabled={busy || (isVideo ? !youtubeEmbedUrl(videoUrl) : !file)}>{busy ? "Đang tải…" : isVideo ? "Thêm video" : "Tải lên"}</button></footer></form></div>;
}

type AdminBulkRow = { id: string; file: File; title: string; typeValue: string; audience: string; status: "pending" | "uploading" | "done" | "error"; error?: string };
const deriveDocTitle = (name: string) => name.replace(/\.[^.]+$/, "").trim() || name;

/** Modal tải nhiều tài liệu cùng lúc cho Admin: chọn nhiều file, gán tên/loại/phạm vi hàng loạt rồi tải tuần tự (giới hạn đồng thời). */
function AdminBulkUpload({ session, types, onClose, onRowDone, onDone }: { session: AuthSession; types: ManagedType[]; onClose: () => void; onRowDone: (document: DocumentItem, category: ManagedType) => void; onDone: () => void }) {
  const [rows, setRows] = useState<AdminBulkRow[]>([]);
  const [defaultType, setDefaultType] = useState(types[0]?.value ?? "");
  const [defaultAudience, setDefaultAudience] = useState("TEACHER_RESTRICTED");
  const [busy, setBusy] = useState(false);

  const addFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const next: AdminBulkRow[] = Array.from(files).map(file => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
      file, title: deriveDocTitle(file.name), typeValue: defaultType || types[0]?.value || "", audience: defaultAudience, status: "pending",
    }));
    setRows(current => [...current, ...next]);
  };
  const updateRow = (id: string, patch: Partial<AdminBulkRow>) => setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row));
  const removeRow = (id: string) => setRows(current => current.filter(row => row.id !== id));
  const applyDefaults = () => setRows(current => current.map(row => row.status === "done" ? row : { ...row, typeValue: defaultType, audience: defaultAudience }));

  const uploadRow = async (row: AdminBulkRow) => {
    const category = types.find(item => item.value === row.typeValue);
    if (!category) { updateRow(row.id, { status: "error", error: "Chưa chọn loại tài liệu" }); return; }
    updateRow(row.id, { status: "uploading", error: undefined });
    try {
      const backendType = category.builtin ? category.value : (types.find(item => item.builtin && item.value === "KHBD")?.value || types.find(item => item.builtin)?.value || "KHBD");
      const title = row.title.trim() || deriveDocTitle(row.file.name);
      const document = await uploadDocument(session, { title, docType: backendType, audience: row.audience, file: row.file });
      onRowDone(document, category);
      updateRow(row.id, { status: "done" });
      onDone();
    } catch (reason) {
      updateRow(row.id, { status: "error", error: message(reason) });
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

  return <div className="docs-overlay" onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="docs-modal docs-bulk-modal">
      <header><h2>Tải nhiều tài liệu</h2><button type="button" onClick={onClose} disabled={busy}><X size={18} /></button></header>
      <label>Chọn file (PDF, DOC, DOCX — chọn được nhiều file cùng lúc)
        <input type="file" multiple accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={event => { addFiles(event.target.files); event.target.value = ""; }} />
      </label>
      {rows.length > 0 && <>
        <div className="docs-bulk-defaults">
          <label>Loại tài liệu mặc định<select value={defaultType} onChange={event => setDefaultType(event.target.value)}>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
          <label>Phạm vi mặc định<select value={defaultAudience} onChange={event => setDefaultAudience(event.target.value)}><option value="TEACHER_RESTRICTED">Chỉ giáo viên</option><option value="STUDENT_ALLOWED">Cho phép học sinh</option></select></label>
          <button type="button" onClick={applyDefaults}>Áp dụng cho tất cả</button>
        </div>
        <div className="docs-bulk-rows">
          {rows.map(row => <div key={row.id} className="docs-bulk-row">
            <input value={row.title} onChange={event => updateRow(row.id, { title: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} />
            <select value={row.typeValue} onChange={event => updateRow(row.id, { typeValue: event.target.value })} disabled={row.status === "uploading" || row.status === "done"}>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select>
            <select value={row.audience} onChange={event => updateRow(row.id, { audience: event.target.value })} disabled={row.status === "uploading" || row.status === "done"}><option value="TEACHER_RESTRICTED">Chỉ giáo viên</option><option value="STUDENT_ALLOWED">Cho phép học sinh</option></select>
            <span className="docs-bulk-status">{row.status === "pending" ? "Chờ" : row.status === "uploading" ? "Đang tải…" : row.status === "done" ? "✓ Xong" : "✗ Lỗi"}</span>
            {row.status === "uploading" || row.status === "done" ? <span /> : <button type="button" title="Bỏ khỏi danh sách" aria-label={`Bỏ ${row.title}`} onClick={() => removeRow(row.id)}><X size={16} /></button>}
            {row.status === "error" && <small className="docs-bulk-error">{row.error}</small>}
          </div>)}
        </div>
      </>}
      <footer>
        <span>{doneCount} / {rows.length} đã tải lên</span>
        <div><button type="button" onClick={onClose} disabled={busy}>Đóng</button><button type="button" className="docs-primary" onClick={() => void uploadAll()} disabled={busy || !canUpload}>{busy ? "Đang tải…" : `Tải lên (${rows.filter(row => row.status === "pending" || row.status === "error").length})`}</button></div>
      </footer>
    </div>
  </div>;
}
