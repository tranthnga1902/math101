import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Plus, X } from "lucide-react";
import {
  deleteDocument,
  getDocuments,
  getMetadata,
  openDocumentFile,
  uploadDocument,
  type AuthSession,
  type DocumentItem,
  type MetadataOption,
} from "../api";
import { PdfThumbnail } from "../PdfThumbnail";
import "./document-management.css";

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
  const [selected, setSelected] = useState<number[]>([]);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [upload, setUpload] = useState(false);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [categoryDialog, setCategoryDialog] = useState<CategoryDialog>(null);
  const [deleteType, setDeleteType] = useState<ManagedType | null>(null);
  const menuArea = useRef<HTMLElement>(null);

  const documentsQuery = useQuery({ queryKey: [DOCUMENTS_QUERY_KEY, session.accessToken], queryFn: () => getDocuments(session) });
  const metadataQuery = useQuery({ queryKey: [METADATA_QUERY_KEY, session.accessToken], queryFn: () => getMetadata(session) });
  const invalidateDocuments = () => queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] });
  const error = documentsQuery.isError ? message(documentsQuery.error) : metadataQuery.isError ? message(metadataQuery.error) : "";

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
      if (!menuArea.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const deleteMutation = useMutation({
    mutationFn: (ids: number[]) => Promise.all(ids.map(id => deleteDocument(session, id))),
    onSuccess: () => { setSelected([]); void invalidateDocuments(); },
  });

  const visible = useMemo(() => rows.filter(row =>
    (!selectedTypes.length || selectedTypes.includes(row.docType)) &&
    row.title.toLocaleLowerCase("vi").includes(search.toLocaleLowerCase("vi"))
  ), [rows, selectedTypes, search]);
  const counts = useMemo(() => Object.fromEntries(types.map(type => [type.value, rows.filter(row => row.docType === type.value).length])), [rows, types]);
  const toggleType = (value: string) => setSelectedTypes(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const toggle = (id: number) => setSelected(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const archive = () => {
    if (!selected.length || !confirm(`Xóa ${selected.length} tài liệu đã chọn?`)) return;
    deleteMutation.mutate(selected);
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
      <div className="docs-toolbar"><div><h1>Kho Tài Liệu</h1><input aria-label="Tìm kiếm tài liệu" placeholder="Tìm kiếm tài liệu…" value={search} onChange={event => setSearch(event.target.value)} /></div><div><button className={view === "grid" ? "active" : ""} onClick={() => setView("grid")}>Lưới</button><button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>Danh sách</button><button className="docs-primary" onClick={() => setUpload(true)}>Tải lên</button></div></div>
      {error && <div className="api-error">{error}</div>}
      <div className={`docs-collection ${view}`}>{visible.map(row => <article className={selected.includes(row.id) ? "selected" : ""} key={row.id}><input className="doc-check" type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /><button className="doc-preview" onClick={() => void openDocumentFile(session, row.fileUrl, row.title)}>{row.fileUrl && row.docType !== "VIDEO" ? <PdfThumbnail fileUrl={row.fileUrl} accessToken={session.accessToken} pageNumber={1} className="doc-pdf-preview" renderScale={0.75} thumbnailUrl={row.thumbnailUrl} docType={row.docType}/> : <span className={`doc-kind ${row.docType.toLowerCase()}`}>{row.docType === "VIDEO" ? "VIDEO" : "TÀI LIỆU"}</span>}</button><div className="doc-info"><div><h2>{row.title}</h2><button aria-label="Mở tài liệu" onClick={() => void openDocumentFile(session, row.fileUrl, row.title)}>⋮</button></div><p><span>{types.find(item => item.value === row.docType)?.label ?? row.docType}</span><time>{new Intl.DateTimeFormat("vi-VN").format(new Date(row.createdAt))}</time></p></div></article>)}</div>
      {!visible.length && <div className="docs-empty">Không có tài liệu phù hợp.</div>}
      {selected.length > 0 && <div className="docs-floating"><b>{selected.length}</b><span>Đã chọn</span><button onClick={() => setSelected([])}>Bỏ chọn</button><button className="danger" onClick={archive}>Xóa</button></div>}
    </main>
    {upload && <DocumentUpload session={session} types={types} onClose={() => setUpload(false)} onDone={async (document, category) => {
      if (!category.builtin) {
        const mappings = JSON.parse(localStorage.getItem(mappingStorageKey(session)) || "{}") as Record<string, string>;
        mappings[String(document.id)] = category.value;
        localStorage.setItem(mappingStorageKey(session), JSON.stringify(mappings));
      }
      setUpload(false);
      await invalidateDocuments();
    }} />}
    {categoryDialog && <CategoryEditor initialName={categoryDialog.mode === "rename" ? categoryDialog.category.label : ""} title={categoryDialog.mode === "rename" ? "Đổi tên phân loại" : "Thêm phân loại"} onClose={() => setCategoryDialog(null)} onSave={saveCategory} />}
    {deleteType && <DeleteCategoryDialog category={deleteType} count={counts[deleteType.value] ?? 0} targets={types.filter(item => item.value !== deleteType.value)} onClose={() => setDeleteType(null)} onDelete={removeCategory} />}
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    const category = types.find(item => item.value === type);
    if (!category) return;
    setBusy(true);
    try {
      const backendType = category.builtin ? category.value : (types.find(item => item.builtin && item.value === "KHBD")?.value || types.find(item => item.builtin)?.value || "KHBD");
      const document = await uploadDocument(session, { title, docType: backendType, audience, file });
      await onDone(document, category);
    } catch (reason) {
      setError(message(reason));
      setBusy(false);
    }
  };
  return <div className="docs-overlay"><form className="docs-modal" onSubmit={submit}><header><h2>Tải tài liệu lên</h2><button type="button" onClick={onClose}>×</button></header><label>Tên tài liệu<input required value={title} onChange={event => setTitle(event.target.value)} /></label><label>Loại tài liệu<select required value={type} onChange={event => setType(event.target.value)}>{types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label><label>Phạm vi<select value={audience} onChange={event => setAudience(event.target.value)}><option value="TEACHER_RESTRICTED">Chỉ giáo viên</option><option value="STUDENT_ALLOWED">Cho phép học sinh</option></select></label><label>Chọn file<input required type="file" onChange={event => setFile(event.target.files?.[0] ?? null)} /></label>{error && <div className="api-error">{error}</div>}<footer><button type="button" onClick={onClose}>Hủy</button><button className="docs-primary" disabled={busy}>{busy ? "Đang tải…" : "Tải lên"}</button></footer></form></div>;
}
