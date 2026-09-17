import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, FileCode, Folder, FolderInput, FolderOpen, FolderPlus, Layers, MoreVertical, Trash2, X } from "lucide-react";
import {
  convertDocumentToMarkdown,
  createAdminDocumentFolder,
  deleteAdminDocumentFolder,
  deleteDocument,
  fetchDocumentObjectUrl,
  getAdminDocumentFolders,
  getContentGroupCounts,
  getDocuments,
  getMetadata,
  moveAdminDocumentFolder,
  moveAdminDocuments,
  openDocumentFile,
  renameAdminDocumentFolder,
  saveDocumentMarkdown,
  setDocumentContentGroup,
  uploadDocument,
  type AdminDocumentFolder,
  type AuthSession,
  type ContentGroup,
  type DocumentItem,
  type FileFormat,
  type MetadataOption,
} from "../api";
import { AttachDocumentDialog } from "./AttachDocumentDialog";
import { OcrCancelled, ocrPdfToMarkdown } from "../lib/pdfOcr";
import { PdfThumbnail } from "../PdfThumbnail";
import { MarkdownViewer } from "../components/MarkdownViewer";
import { PdfViewer, isPdfDocument } from "../components/PdfViewer";
import { YoutubeVideoModal, canonicalYoutubeUrl, parseYoutubeList, youtubeEmbedUrl, youtubeThumbnailUrl } from "../components/YoutubeVideoModal";
import { AdminPage } from "./components/AdminPageLayout";
import { AdminModal } from "./components/AdminModal";
import { AdminEmptyState } from "./components/AdminEmptyState";
import { SearchInput } from "./components/AdminFilterBar";
import { Button } from "../components/ui/button";

const isPdfDoc = isPdfDocument;

const message = (reason: unknown) => reason instanceof Error ? reason.message : "Không thể thực hiện thao tác";
const DOCUMENTS_QUERY_KEY = "admin-documents";
const METADATA_QUERY_KEY = "admin-document-metadata";
const CONTENT_GROUPS_QUERY_KEY = "admin-content-groups";
const FOLDERS_QUERY_KEY = "admin-document-folders";
const EXPANDED_STORAGE_KEY = "math10.admin-document-folders.expanded";
const DRAG_TYPE = "application/x-math10-documents";

/**
 * Nhóm nội dung trả lời "dùng vào lúc nào trong quá trình học" — khác hẳn LOẠI TÀI LIỆU vốn
 * trả lời "đây là loại ấn phẩm gì". Danh sách cố định, do CSDL chốt bằng ràng buộc CHECK.
 */
const NHOM_NOI_DUNG: { value: ContentGroup; label: string }[] = [
  { value: "THEORY", label: "Lý thuyết" },
  { value: "PRACTICE", label: "Luyện tập" },
  { value: "ASSESSMENT", label: "Kiểm tra, đánh giá" },
  { value: "REFERENCE", label: "Tham khảo" },
];
/** Khóa lọc cho tài liệu chưa ai phân loại. Không phải một nhóm, nên đứng riêng ngoài NHOM_NOI_DUNG. */
const CHUA_PHAN_LOAI = "CHUA_PHAN_LOAI";
const nhomLabel = (group: ContentGroup | null) => NHOM_NOI_DUNG.find(item => item.value === group)?.label ?? "Chưa phân loại";

/**
 * Định dạng file trả lời "mở bằng gì" — do máy chủ nhận ra lúc tải lên (SCORM/xAPI phải mở gói
 * .zip mới biết), nên danh sách cố định, không sửa/xóa được.
 */
const DINH_DANG: { value: FileFormat; label: string; short: string }[] = [
  { value: "WORD", label: "Word", short: "DOC" },
  { value: "EXCEL", label: "Excel", short: "XLS" },
  { value: "POWERPOINT", label: "PowerPoint", short: "PPT" },
  { value: "PDF", label: "PDF", short: "PDF" },
  { value: "VIDEO", label: "Video", short: "VIDEO" },
  { value: "SCORM", label: "SCORM", short: "SCORM" },
  { value: "XAPI", label: "xAPI", short: "xAPI" },
];
const DINH_DANG_KHAC = "KHAC";
const dinhDangLabel = (format: FileFormat | null) => DINH_DANG.find(item => item.value === format)?.label ?? "Khác";
const FILE_ACCEPT = ".doc,.docx,.xls,.xlsx,.ppt,.pptx,.pdf,.mp4,.webm,.mov,.m4v,.zip";
const FILE_ACCEPT_HINT = "Word, Excel, PowerPoint, PDF, video (MP4, WebM, MOV) hoặc gói SCORM/xAPI (.zip)";
const isYoutubeRow = (row: DocumentItem) => !!row.fileUrl && !!youtubeEmbedUrl(row.fileUrl);
const isUploadedVideo = (row: DocumentItem) => row.fileFormat === "VIDEO" && !isYoutubeRow(row);

/** Bỏ dấu tiếng Việt để gõ "de kiem tra" vẫn ra "Đề kiểm tra". */
const foldText = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/đ/g, "d");
const collator = new Intl.Collator("vi", { numeric: true, sensitivity: "base" });

/** "Tất cả", "Chưa xếp thư mục", hoặc id một thư mục. */
type FolderKey = "ALL" | "NONE" | number;
type SortKey = "newest" | "oldest" | "name";
type FlatFolder = { folder: AdminDocumentFolder; depth: number; path: string[] };
type FolderDialog = { mode: "create"; parentId: number | null } | { mode: "rename"; folder: AdminDocumentFolder } | null;
type MovePicker = { kind: "folder"; folder: AdminDocumentFolder } | { kind: "documents"; ids: number[] } | null;

/**
 * Máy chủ trả danh sách phẳng kèm parentId; cây dựng ở đây. Thư mục có cha không còn tồn tại
 * được coi là gốc, và vòng lặp (nếu dữ liệu hỏng) bị cắt — giao diện không bao giờ treo vì cây.
 */
function buildFolderIndex(folders: AdminDocumentFolder[]) {
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const children = new Map<number | null, AdminDocumentFolder[]>();
  for (const folder of folders) {
    const key = folder.parentId != null && byId.has(folder.parentId) ? folder.parentId : null;
    const list = children.get(key) ?? [];
    list.push(folder);
    children.set(key, list);
  }
  for (const list of children.values()) list.sort((a, b) => collator.compare(a.name, b.name));
  const flat: FlatFolder[] = [];
  const seen = new Set<number>();
  const walk = (parent: number | null, depth: number, path: string[]) => {
    for (const folder of children.get(parent) ?? []) {
      if (seen.has(folder.id)) continue;
      seen.add(folder.id);
      const next = [...path, folder.name];
      flat.push({ folder, depth, path: next });
      walk(folder.id, depth + 1, next);
    }
  };
  walk(null, 0, []);
  const pathOf = new Map(flat.map(node => [node.folder.id, node.path]));
  const subtree = (id: number) => {
    const out = new Set<number>();
    const stack = [id];
    while (stack.length) {
      const current = stack.pop()!;
      if (out.has(current)) continue;
      out.add(current);
      for (const child of children.get(current) ?? []) stack.push(child.id);
    }
    return out;
  };
  const ancestors = (id: number) => {
    const out: AdminDocumentFolder[] = [];
    const guard = new Set<number>();
    let current = byId.get(id);
    while (current && !guard.has(current.id)) {
      guard.add(current.id);
      out.unshift(current);
      current = current.parentId != null ? byId.get(current.parentId) : undefined;
    }
    return out;
  };
  return { byId, children, flat, pathOf, subtree, ancestors };
}

function loadExpanded(): Set<number> {
  try {
    const parsed = JSON.parse(localStorage.getItem(EXPANDED_STORAGE_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is number => typeof item === "number") : []);
  } catch {
    return new Set();
  }
}

export function DocumentManagement({ session }: { session: AuthSession }) {
  const queryClient = useQueryClient();
  const [selectedFolder, setSelectedFolder] = useState<FolderKey>("ALL");
  const [includeSubfolders, setIncludeSubfolders] = useState(true);
  const [expanded, setExpanded] = useState<Set<number>>(loadExpanded);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sort, setSort] = useState<SortKey>("newest");
  const [fileVideoDoc, setFileVideoDoc] = useState<DocumentItem | null>(null);
  const [search, setSearch] = useState("");
  const [upload, setUpload] = useState(false);
  const [uploadInitialType, setUploadInitialType] = useState("");
  const [bulkUpload, setBulkUpload] = useState(false);
  const [openFolderMenu, setOpenFolderMenu] = useState<number | null>(null);
  const [openDocMenu, setOpenDocMenu] = useState<number | null>(null);
  const [bulkGroupMenuOpen, setBulkGroupMenuOpen] = useState(false);
  const [menuUpward, setMenuUpward] = useState(false);
  const [actionError, setActionError] = useState("");
  const [folderDialog, setFolderDialog] = useState<FolderDialog>(null);
  const [movePicker, setMovePicker] = useState<MovePicker>(null);
  const [dropTarget, setDropTarget] = useState<FolderKey | null>(null);
  const [markdownDoc, setMarkdownDoc] = useState<DocumentItem | null>(null);
  const [videoDoc, setVideoDoc] = useState<DocumentItem | null>(null);
  const [pdfDoc, setPdfDoc] = useState<DocumentItem | null>(null);
  const [attachDoc, setAttachDoc] = useState<DocumentItem | null>(null);
  const [attachDocs, setAttachDocs] = useState<DocumentItem[] | null>(null);
  const [bulkActionsMenuOpen, setBulkActionsMenuOpen] = useState(false);
  const [converting, setConverting] = useState<number | null>(null);
  const [convertErrors, setConvertErrors] = useState<Record<number, string>>({});
  const [ocrJob, setOcrJob] = useState<{ id: number; text: string } | null>(null);
  const menuArea = useRef<HTMLElement>(null);
  // Cờ hủy đọc qua ref: vòng lặp OCR đang chạy phải thấy giá trị mới nhất, state thì
  // bị đóng băng trong closure của lần render đã bắt đầu công việc.
  const ocrCancel = useRef(false);

  const documentsQuery = useQuery({ queryKey: [DOCUMENTS_QUERY_KEY, session.accessToken], queryFn: () => getDocuments(session) });
  const metadataQuery = useQuery({ queryKey: [METADATA_QUERY_KEY, session.accessToken], queryFn: () => getMetadata(session) });
  const foldersQuery = useQuery({ queryKey: [FOLDERS_QUERY_KEY, session.accessToken], queryFn: () => getAdminDocumentFolders(session) });
  // Bộ đếm nhóm lấy từ máy chủ chứ không đếm lại trên máy khách: chỉ con số của máy chủ mới có
  // phép thử canh quy tắc "chưa phân loại không phải là Tham khảo".
  const groupCountsQuery = useQuery({ queryKey: [CONTENT_GROUPS_QUERY_KEY, session.accessToken], queryFn: () => getContentGroupCounts(session) });
  const invalidateDocuments = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: [DOCUMENTS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [CONTENT_GROUPS_QUERY_KEY] }),
    queryClient.invalidateQueries({ queryKey: [FOLDERS_QUERY_KEY] }),
  ]);
  const loadError = documentsQuery.isError ? message(documentsQuery.error) : metadataQuery.isError ? message(metadataQuery.error) : foldersQuery.isError ? message(foldersQuery.error) : "";

  const rows = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const types: MetadataOption[] = useMemo(() => metadataQuery.data?.documentTypes ?? [], [metadataQuery.data]);
  const index = useMemo(() => buildFolderIndex(foldersQuery.data ?? []), [foldersQuery.data]);
  const inKnownFolder = (row: DocumentItem) => row.folderId != null && index.byId.has(row.folderId);

  useEffect(() => {
    try { localStorage.setItem(EXPANDED_STORAGE_KEY, JSON.stringify([...expanded])); } catch { /* chỉ là tiện ích, bỏ qua */ }
  }, [expanded]);

  // Thư mục đang xem vừa bị xóa (ở tab khác hoặc bởi chính mình) thì quay về "Tất cả".
  useEffect(() => {
    if (typeof selectedFolder === "number" && foldersQuery.data && !index.byId.has(selectedFolder)) setSelectedFolder("ALL");
  }, [selectedFolder, foldersQuery.data, index]);

  // Tài liệu đã bị xóa thì không còn nằm trong vùng chọn.
  useEffect(() => {
    setSelectedIds(current => {
      if (!current.size) return current;
      const existing = new Set(rows.map(row => row.id));
      const next = new Set([...current].filter(id => existing.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [rows]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".folder-menu") && !target.closest(".folder-menu-trigger")) setOpenFolderMenu(null);
      // Bấm lại chính nút ⋮ phải đóng menu (do onClick xử lý) — nếu đóng luôn ở đây thì
      // onClick sẽ mở lại ngay sau đó và menu không bao giờ tắt được bằng nút.
      if (!target.closest(".doc-menu") && !target.closest(".doc-menu-trigger")) setOpenDocMenu(null);
      if (!target.closest(".bulk-group-menu") && !target.closest(".bulk-group-trigger")) setBulkGroupMenuOpen(false);
      if (!target.closest(".bulk-actions-menu") && !target.closest(".bulk-more-trigger")) setBulkActionsMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

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
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDocument(session, id),
    onMutate: () => setActionError(""),
    onSuccess: () => { void invalidateDocuments(); },
    onError: (reason: unknown) => setActionError(message(reason)),
  });
  const groupMutation = useMutation({
    mutationFn: (x: { id: number; group: ContentGroup | null }) => setDocumentContentGroup(session, x.id, x.group),
    onMutate: () => setActionError(""),
    onSuccess: () => { void invalidateDocuments(); },
    onError: (reason: unknown) => setActionError(message(reason)),
  });
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      const failures: string[] = [];
      await Promise.allSettled(
        ids.map(async id => {
          try {
            await deleteDocument(session, id);
          } catch (e) {
            failures.push(message(e));
          }
        })
      );
      if (failures.length > 0) throw new Error(`Có ${failures.length}/${ids.length} tài liệu không xóa được: ${failures[0]}`);
    },
    onMutate: () => setActionError(""),
    onSuccess: () => {
      setSelectedIds(new Set());
      void invalidateDocuments();
    },
    onError: (reason: unknown) => setActionError(message(reason)),
  });
  const bulkGroupMutation = useMutation({
    mutationFn: async (x: { ids: number[]; group: ContentGroup | null }) => {
      const failures: string[] = [];
      await Promise.allSettled(
        x.ids.map(async id => {
          try {
            await setDocumentContentGroup(session, id, x.group);
          } catch (e) {
            failures.push(message(e));
          }
        })
      );
      if (failures.length > 0) throw new Error(`Có ${failures.length}/${x.ids.length} tài liệu không cập nhật được nhóm.`);
    },
    onMutate: () => setActionError(""),
    onSuccess: () => {
      setSelectedIds(new Set());
      setBulkGroupMenuOpen(false);
      void invalidateDocuments();
    },
    onError: (reason: unknown) => setActionError(message(reason)),
  });
  const bulkConvertMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      for (const id of ids) {
        try {
          await convertDocumentToMarkdown(session, id);
        } catch {
          // tiếp tục các file khác
        }
      }
    },
    onMutate: () => setActionError(""),
    onSuccess: () => {
      setSelectedIds(new Set());
      void invalidateDocuments();
    },
    onError: (reason: unknown) => setActionError(message(reason)),
  });
  const moveDocumentsMutation = useMutation({
    mutationFn: (x: { ids: number[]; folderId: number | null }) => moveAdminDocuments(session, x.ids, x.folderId),
    onMutate: () => setActionError(""),
    onSuccess: () => { setSelectedIds(new Set()); setMovePicker(null); void invalidateDocuments(); },
    onError: (reason: unknown) => setActionError(message(reason)),
  });
  const moveFolderMutation = useMutation({
    mutationFn: (x: { id: number; parentId: number | null }) => moveAdminDocumentFolder(session, x.id, x.parentId),
    onMutate: () => setActionError(""),
    onSuccess: (folder) => {
      setMovePicker(null);
      if (folder.parentId != null) expandPath(folder.parentId);
      void invalidateDocuments();
    },
    onError: (reason: unknown) => setActionError(message(reason)),
  });
  const deleteFolderMutation = useMutation({
    mutationFn: (folder: AdminDocumentFolder) => deleteAdminDocumentFolder(session, folder.id),
    onMutate: () => setActionError(""),
    onSuccess: (_, folder) => {
      if (typeof selectedFolder === "number" && index.subtree(folder.id).has(selectedFolder)) {
        setSelectedFolder(selectedFolder === folder.id ? (folder.parentId ?? "ALL") : selectedFolder);
      }
      void invalidateDocuments();
    },
    onError: (reason: unknown) => setActionError(message(reason)),
  });

  const expandPath = (folderId: number) => setExpanded(current => {
    const next = new Set(current);
    for (const ancestor of index.ancestors(folderId)) next.add(ancestor.id);
    return next;
  });
  const selectFolder = (key: FolderKey) => {
    setSelectedFolder(key);
    setSelectedIds(new Set());
    if (typeof key === "number") {
      const parent = index.byId.get(key)?.parentId;
      if (parent != null) expandPath(parent);
    }
  };
  const toggleExpanded = (id: number) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const openRow = (row: DocumentItem) => {
    if (isYoutubeRow(row)) { setVideoDoc(row); return; }
    if (isUploadedVideo(row)) { setFileVideoDoc(row); return; }
    if (row.contentMarkdown) { setMarkdownDoc(row); return; }
    openFile(row);
  };
  /** PDF xem ngay trong app; định dạng khác (Word, Excel, PowerPoint, gói SCORM/xAPI…) mở tab mới hoặc tải về. */
  const openFile = (row: DocumentItem) => {
    if (isPdfDoc(row)) { setPdfDoc(row); return; }
    openDocumentFile(session, row.fileUrl, row.title).catch(reason => setActionError(message(reason)));
  };

  /** Số tài liệu nằm trực tiếp trong thư mục và tính gộp cả nhánh con — đếm từ chính danh sách đang hiển thị nên không bao giờ lệch nó. */
  const folderCounts = useMemo(() => {
    const direct = new Map<number, number>();
    let unfiled = 0;
    for (const row of rows) {
      if (row.folderId != null && index.byId.has(row.folderId)) direct.set(row.folderId, (direct.get(row.folderId) ?? 0) + 1);
      else unfiled += 1;
    }
    const total = new Map<number, number>();
    for (let i = index.flat.length - 1; i >= 0; i--) {
      const id = index.flat[i].folder.id;
      const childSum = (index.children.get(id) ?? []).reduce((sum, child) => sum + (total.get(child.id) ?? 0), 0);
      total.set(id, (direct.get(id) ?? 0) + childSum);
    }
    return { direct, total, unfiled };
  }, [rows, index]);

  const folderScope = useMemo(() => {
    if (typeof selectedFolder !== "number") return null;
    return includeSubfolders ? index.subtree(selectedFolder) : new Set([selectedFolder]);
  }, [selectedFolder, includeSubfolders, index]);

  const searchTerms = useMemo(() => foldText(search).split(/\s+/).filter(Boolean), [search]);
  const visible = useMemo(() => {
    const list = rows.filter(row => {
      const known = row.folderId != null && index.byId.has(row.folderId);
      if (selectedFolder === "NONE" && known) return false;
      if (folderScope && !(row.folderId != null && folderScope.has(row.folderId))) return false;
      if (selectedTypes.length && !selectedTypes.includes(row.docType)) return false;
      // Chưa phân loại là một lựa chọn lọc thật, không phải "không lọc".
      if (selectedGroups.length && !selectedGroups.includes(row.contentGroup ?? CHUA_PHAN_LOAI)) return false;
      if (selectedFormats.length && !selectedFormats.includes(row.fileFormat ?? DINH_DANG_KHAC)) return false;
      if (searchTerms.length) {
        // Tìm theo cả đường dẫn thư mục: "de kiem tra ham so" khớp tài liệu "Đề 1" trong "Hàm số › Đề kiểm tra".
        const haystack = foldText(`${row.title} ${known ? index.pathOf.get(row.folderId!)?.join(" ") ?? "" : ""}`);
        if (!searchTerms.every(term => haystack.includes(term))) return false;
      }
      return true;
    });
    const byDate = (a: DocumentItem, b: DocumentItem) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    return list.sort(sort === "name" ? (a, b) => collator.compare(a.title, b.title) : sort === "oldest" ? byDate : (a, b) => byDate(b, a));
  }, [rows, index, selectedFolder, folderScope, selectedTypes, selectedGroups, selectedFormats, searchTerms, sort]);

  const typeCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const row of rows) result[row.docType] = (result[row.docType] ?? 0) + 1;
    return result;
  }, [rows]);
  const formatCounts = useMemo(() => {
    const result: Record<string, number> = {};
    for (const row of rows) { const key = row.fileFormat ?? DINH_DANG_KHAC; result[key] = (result[key] ?? 0) + 1; }
    return result;
  }, [rows]);
  const groupCounts = groupCountsQuery.data;
  const toggleIn = (setter: React.Dispatch<React.SetStateAction<string[]>>) => (value: string) =>
    setter(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]);
  const toggleType = toggleIn(setSelectedTypes);
  const toggleGroup = toggleIn(setSelectedGroups);
  const toggleFormat = toggleIn(setSelectedFormats);
  const typeLabel = (value: string) => types.find(item => item.value === value)?.label ?? value;
  const toggleSelected = (id: number) => setSelectedIds(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allVisibleSelected = visible.length > 0 && visible.every(row => selectedIds.has(row.id));
  const toggleSelectAll = () => setSelectedIds(allVisibleSelected ? new Set() : new Set(visible.map(row => row.id)));
  const filtersActive = selectedTypes.length + selectedGroups.length + selectedFormats.length > 0;
  const clearFilters = () => { setSelectedTypes([]); setSelectedGroups([]); setSelectedFormats([]); };
  const selectedPdfIdsWithoutMd = useMemo(() =>
    rows.filter(row => selectedIds.has(row.id) && isPdfDoc(row) && !row.contentMarkdown).map(row => row.id),
    [rows, selectedIds]
  );

  const deleteOne = (row: DocumentItem) => {
    if (!confirm(`Xóa tài liệu "${row.title}"? Thao tác này không hoàn tác được.`)) return;
    deleteMutation.mutate(row.id);
  };
  const deleteFolder = (folder: AdminDocumentFolder) => {
    const parent = folder.parentId != null ? index.byId.get(folder.parentId) : undefined;
    const count = folderCounts.direct.get(folder.id) ?? 0;
    const childCount = index.children.get(folder.id)?.length ?? 0;
    const where = parent ? `thư mục "${parent.name}"` : "mục Chưa xếp thư mục";
    const contents = [count ? `${count} tài liệu` : "", childCount ? `${childCount} thư mục con` : ""].filter(Boolean).join(" và ");
    if (!confirm(`Xóa thư mục "${folder.name}"?${contents ? `\n\n${contents} bên trong sẽ được chuyển lên ${where}.` : ""}\nKhông tài liệu nào bị xóa.`)) return;
    deleteFolderMutation.mutate(folder);
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

  // Kéo thẻ tài liệu thả vào thư mục: kéo một thẻ đang được chọn thì mang theo cả vùng chọn.
  const dragStart = (event: React.DragEvent, row: DocumentItem) => {
    const ids = selectedIds.has(row.id) ? [...selectedIds] : [row.id];
    event.dataTransfer.setData(DRAG_TYPE, JSON.stringify(ids));
    event.dataTransfer.effectAllowed = "move";
  };
  const dropProps = (key: FolderKey) => key === "ALL" ? {} : {
    onDragOver: (event: React.DragEvent) => {
      if (!event.dataTransfer.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      if (dropTarget !== key) setDropTarget(key);
    },
    onDragLeave: () => setDropTarget(current => current === key ? null : current),
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      setDropTarget(null);
      try {
        const ids = JSON.parse(event.dataTransfer.getData(DRAG_TYPE)) as number[];
        if (Array.isArray(ids) && ids.length) moveDocumentsMutation.mutate({ ids, folderId: key === "NONE" ? null : key });
      } catch { /* dữ liệu kéo không phải của trang này */ }
    },
  };

  const currentFolderId = typeof selectedFolder === "number" ? selectedFolder : null;
  const breadcrumb = currentFolderId != null ? index.ancestors(currentFolderId) : [];
  const countBadge = "ml-auto text-xs text-on-surface-variant bg-surface-variant/30 px-1.5 py-0.5 rounded-full";
  const rowClass = (active: boolean, key: FolderKey) =>
    `group flex items-center gap-1 rounded-md pr-1 text-sm ${active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-variant/60"} ${dropTarget === key ? "ring-2 ring-primary" : ""}`;

  const renderFolder = (folder: AdminDocumentFolder, depth: number): React.ReactNode => {
    const kids = index.children.get(folder.id) ?? [];
    const isOpen = expanded.has(folder.id);
    const active = selectedFolder === folder.id;
    return <div key={folder.id} className="relative">
      <div className={rowClass(active, folder.id)} style={{ paddingLeft: 4 + depth * 14 }} {...dropProps(folder.id)}>
        <button type="button" className="w-5 h-5 shrink-0 flex items-center justify-center text-on-surface-variant" aria-label={isOpen ? `Thu gọn ${folder.name}` : `Mở rộng ${folder.name}`} disabled={!kids.length} onClick={() => toggleExpanded(folder.id)}>
          {kids.length ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : null}
        </button>
        <button type="button" className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left" onClick={() => selectFolder(folder.id)} title={index.pathOf.get(folder.id)?.join(" › ")}>
          {isOpen && kids.length ? <FolderOpen size={15} className="shrink-0" /> : <Folder size={15} className="shrink-0" />}
          <span className="truncate">{folder.name}</span>
          <span className={countBadge}>{folderCounts.total.get(folder.id) ?? 0}</span>
        </button>
        <button type="button" className="folder-menu-trigger p-1 text-on-surface-variant hover:text-on-surface rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity" aria-label={`Thao tác với thư mục ${folder.name}`} aria-expanded={openFolderMenu === folder.id} onClick={() => setOpenFolderMenu(current => current === folder.id ? null : folder.id)}>
          <MoreVertical size={15} />
        </button>
      </div>
      {openFolderMenu === folder.id && <div className="folder-menu absolute right-0 top-8 w-48 bg-white rounded-lg shadow-lg border border-outline-variant py-1 z-30" role="menu">
        <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenFolderMenu(null); setFolderDialog({ mode: "create", parentId: folder.id }); }}>Tạo thư mục con</button>
        <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenFolderMenu(null); setFolderDialog({ mode: "rename", folder }); }}>Đổi tên</button>
        <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenFolderMenu(null); setMovePicker({ kind: "folder", folder }); }}>Chuyển đến…</button>
        <hr className="my-1 border-outline-variant" />
        <button className="w-full text-left px-3 py-1.5 text-sm text-error hover:bg-error/10" role="menuitem" disabled={deleteFolderMutation.isPending} onClick={() => { setOpenFolderMenu(null); deleteFolder(folder); }}>Xóa thư mục</button>
      </div>}
      {isOpen && kids.map(child => renderFolder(child, depth + 1))}
    </div>;
  };

  const sectionTitle = "text-xs font-bold text-on-surface-variant tracking-wider uppercase";
  const checkbox = "rounded border-outline-variant text-primary focus:ring-primary";
  const error = loadError || actionError;

  return <AdminPage className="grid grid-cols-[280px_1fr] gap-0 h-full w-full overflow-hidden">
    <aside className="border-r border-outline-variant bg-surface-container-lowest p-4 flex flex-col gap-1 overflow-y-auto h-full shrink-0" ref={menuArea}>
      <div className="flex items-center justify-between mb-1">
        <h3 className={sectionTitle}>THƯ MỤC</h3>
        <button className="text-primary hover:text-on-surface p-1 rounded" aria-label="Tạo thư mục gốc" title="Tạo thư mục gốc" onClick={() => setFolderDialog({ mode: "create", parentId: null })}><FolderPlus size={17} /></button>
      </div>
      <div className={rowClass(selectedFolder === "ALL", "ALL")}>
        <button type="button" className="flex-1 flex items-center gap-2 py-1.5 pl-6 text-left" onClick={() => selectFolder("ALL")}><span>Tất cả tài liệu</span><span className={countBadge}>{rows.length}</span></button>
      </div>
      <div className={rowClass(selectedFolder === "NONE", "NONE")} {...dropProps("NONE")}>
        <button type="button" className="flex-1 flex items-center gap-2 py-1.5 pl-6 text-left" onClick={() => selectFolder("NONE")}><span>Chưa xếp thư mục</span><span className={countBadge}>{folderCounts.unfiled}</span></button>
      </div>
      {(index.children.get(null) ?? []).map(folder => renderFolder(folder, 0))}
      {foldersQuery.isSuccess && !index.flat.length && <p className="text-xs text-on-surface-variant px-2 py-1">Chưa có thư mục. Bấm biểu tượng thư mục ở trên để tạo, rồi kéo tài liệu thả vào.</p>}

      <div className="flex items-center justify-between mt-5 mb-1">
        <h3 className={sectionTitle}>LOẠI TÀI LIỆU</h3>
        {filtersActive && <button className="text-xs text-primary hover:underline" onClick={clearFilters}>Bỏ lọc</button>}
      </div>
      {types.map(item => <label key={item.value} className="flex items-center gap-2 text-sm cursor-pointer py-1"><input className={checkbox} type="checkbox" checked={selectedTypes.includes(item.value)} onChange={() => toggleType(item.value)} /><span title={item.label}>{item.label}</span><span className={countBadge}>{typeCounts[item.value] ?? 0}</span></label>)}
      <h3 className={`${sectionTitle} mt-5 mb-1`}>ĐỊNH DẠNG</h3>
      {[...DINH_DANG, { value: DINH_DANG_KHAC, label: "Khác" }].map(item => (formatCounts[item.value] || item.value !== DINH_DANG_KHAC) && <label key={item.value} className="flex items-center gap-2 text-sm cursor-pointer py-1"><input className={checkbox} type="checkbox" checked={selectedFormats.includes(item.value)} onChange={() => toggleFormat(item.value)} /><span title={item.label}>{item.label}</span><span className={countBadge}>{formatCounts[item.value] ?? 0}</span></label>)}
      <h3 className={`${sectionTitle} mt-5 mb-1`}>NHÓM NỘI DUNG</h3>
      {NHOM_NOI_DUNG.map(item => <label key={item.value} className="flex items-center gap-2 text-sm cursor-pointer py-1"><input className={checkbox} type="checkbox" checked={selectedGroups.includes(item.value)} onChange={() => toggleGroup(item.value)} /><span title={item.label}>{item.label}</span><span className={countBadge}>{groupCounts?.theoNhom[item.value] ?? 0}</span></label>)}
      <label className="flex items-center gap-2 text-sm cursor-pointer py-1"><input className={checkbox} type="checkbox" checked={selectedGroups.includes(CHUA_PHAN_LOAI)} onChange={() => toggleGroup(CHUA_PHAN_LOAI)} /><span>Chưa phân loại</span><span className={countBadge}>{groupCounts?.chuaPhanLoai ?? 0}</span></label>
    </aside>
    <main className="p-6 overflow-y-auto h-full min-w-0 flex-1">
      <AdminPage.Header
        eyebrow="QUẢN TRỊ HỆ THỐNG"
        title="Kho Tài Liệu"
        description="Sắp xếp tài liệu dùng chung theo thư mục nhiều cấp; thư mục chỉ để tìm cho nhanh, không đổi quyền đọc."
      >
        <Button variant="outline" onClick={() => setFolderDialog({ mode: "create", parentId: currentFolderId })}>Thư mục mới</Button>
        <Button variant="outline" onClick={() => setBulkUpload(true)}>Tải nhiều file</Button>
        <Button variant="outline" onClick={() => { setUploadInitialType("VIDEO"); setUpload(true); }}>+ Thêm video YouTube</Button>
        <Button onClick={() => { setUploadInitialType(""); setUpload(true); }}>Tải lên tài liệu</Button>
      </AdminPage.Header>

      <nav className="flex flex-wrap items-center gap-1 text-sm mb-3" aria-label="Vị trí thư mục">
        <button className="text-primary hover:underline" onClick={() => selectFolder("ALL")}>Kho tài liệu</button>
        {selectedFolder === "NONE" && <><ChevronRight size={14} className="text-on-surface-variant" /><span className="font-semibold">Chưa xếp thư mục</span></>}
        {breadcrumb.map((folder, i) => <span key={folder.id} className="flex items-center gap-1">
          <ChevronRight size={14} className="text-on-surface-variant" />
          {i === breadcrumb.length - 1 ? <span className="font-semibold">{folder.name}</span> : <button className="text-primary hover:underline" onClick={() => selectFolder(folder.id)}>{folder.name}</button>}
        </span>)}
        <span className="ml-2 text-on-surface-variant">· {visible.length} tài liệu</span>
      </nav>

      <AdminPage.Filters>
        <SearchInput value={search} onChange={setSearch} placeholder="Tìm theo tên hoặc thư mục (không cần dấu)…" debounceMs={200} className="w-80" />
        <select aria-label="Sắp xếp" value={sort} onChange={event => setSort(event.target.value as SortKey)} className="h-10 px-3 rounded-lg border border-outline-variant bg-white text-sm">
          <option value="newest">Mới nhất trước</option>
          <option value="oldest">Cũ nhất trước</option>
          <option value="name">Tên A → Z</option>
        </select>
        {currentFolderId != null && <label className="flex items-center gap-2 text-sm cursor-pointer"><input className={checkbox} type="checkbox" checked={includeSubfolders} onChange={event => setIncludeSubfolders(event.target.checked)} />Gồm cả thư mục con</label>}
        {visible.length > 0 && <label className="flex items-center gap-2 text-sm cursor-pointer"><input className={checkbox} type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />Chọn tất cả</label>}
      </AdminPage.Filters>

      {searchTerms.length > 0 && selectedFolder !== "ALL" && <p className="mb-3 text-sm text-on-surface-variant">Đang tìm trong thư mục hiện tại. <button className="text-primary hover:underline" onClick={() => selectFolder("ALL")}>Tìm trong toàn bộ kho</button></p>}
      {error && <div className="mb-4 p-3 rounded-lg bg-error-container text-on-error-container text-sm flex items-start gap-2"><span className="flex-1">{error}</span>{actionError && <button aria-label="Đóng thông báo" onClick={() => setActionError("")}><X size={16} /></button>}</div>}

      {selectedIds.size > 0 && <div className="sticky top-0 z-20 mb-4 flex flex-wrap items-center gap-2 p-3 rounded-xl bg-primary-container text-on-primary-container shadow-md border border-primary/20">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          <strong className="text-sm font-bold">Đã chọn {selectedIds.size} tài liệu</strong>
        </div>

        <div className="h-4 w-px bg-on-primary-container/20 mx-1 hidden sm:block" />

        {/* Nút dấu ... menu chung chứa tất cả các chức năng */}
        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            className="bulk-more-trigger bg-white text-on-surface font-semibold shadow-sm hover:bg-white/90 flex items-center gap-1.5"
            onClick={() => setBulkActionsMenuOpen(v => !v)}
            aria-label="Thao tác hàng loạt"
            title="Thao tác hàng loạt cho các tài liệu đã chọn"
          >
            <MoreVertical size={16} className="text-primary" />
            <span>Thao tác ({selectedIds.size}) ▾</span>
          </Button>

          {bulkActionsMenuOpen && (
            <div className="bulk-actions-menu absolute left-0 top-full mt-1.5 w-60 bg-white rounded-xl shadow-2xl border border-outline-variant py-1.5 z-30 text-left" role="menu">
              <div className="px-3 py-1.5 border-b border-outline-variant/60 text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                <span>Thao tác {selectedIds.size} tài liệu</span>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">CHUNG</span>
              </div>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                role="menuitem"
                onClick={() => { setBulkActionsMenuOpen(false); setMovePicker({ kind: "documents", ids: [...selectedIds] }); }}
              >
                <FolderInput size={16} className="text-primary shrink-0" />
                <span>Chuyển vào thư mục…</span>
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                role="menuitem"
                onClick={() => {
                  setBulkActionsMenuOpen(false);
                  const selectedRows = rows.filter(r => selectedIds.has(r.id));
                  setAttachDocs(selectedRows);
                }}
              >
                <Layers size={16} className="text-primary shrink-0" />
                <span>Gắn vào chương trình…</span>
              </button>
              {selectedPdfIdsWithoutMd.length > 0 && (
                <button
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                  role="menuitem"
                  disabled={bulkConvertMutation.isPending}
                  onClick={() => { setBulkActionsMenuOpen(false); bulkConvertMutation.mutate(selectedPdfIdsWithoutMd); }}
                >
                  <FileCode size={16} className="text-primary shrink-0" />
                  <span>Chuyển sang Markdown ({selectedPdfIdsWithoutMd.length})</span>
                </button>
              )}
              <hr className="my-1 border-outline-variant" />
              <span className="px-3 py-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Gán nhóm nội dung</span>
              {NHOM_NOI_DUNG.map(item => (
                <button
                  key={item.value}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant flex items-center justify-between text-on-surface"
                  role="menuitem"
                  disabled={bulkGroupMutation.isPending}
                  onClick={() => { setBulkActionsMenuOpen(false); bulkGroupMutation.mutate({ ids: [...selectedIds], group: item.value }); }}
                >
                  <span>{item.label}</span>
                </button>
              ))}
              <button
                className="w-full text-left px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-variant"
                role="menuitem"
                disabled={bulkGroupMutation.isPending}
                onClick={() => { setBulkActionsMenuOpen(false); bulkGroupMutation.mutate({ ids: [...selectedIds], group: null }); }}
              >
                Gỡ phân loại
              </button>
              <hr className="my-1 border-outline-variant" />
              <button
                className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 flex items-center gap-2"
                role="menuitem"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => {
                  setBulkActionsMenuOpen(false);
                  if (confirm(`Xác nhận xóa ${selectedIds.size} tài liệu đã chọn?\nThao tác này không thể hoàn tác.`)) {
                    bulkDeleteMutation.mutate([...selectedIds]);
                  }
                }}
              >
                <Trash2 size={16} className="shrink-0" />
                <span>Xóa {selectedIds.size} tài liệu đã chọn</span>
              </button>
              <hr className="my-1 border-outline-variant" />
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-variant"
                role="menuitem"
                onClick={() => { setBulkActionsMenuOpen(false); setSelectedIds(new Set()); }}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}
        </div>

        <Button size="sm" variant="outline" className="bg-white/90 hover:bg-white text-on-surface shadow-sm" onClick={() => setMovePicker({ kind: "documents", ids: [...selectedIds] })}>
          <FolderInput size={15} className="mr-1.5" /> Chuyển thư mục…
        </Button>

        <div className="relative">
          <Button
            size="sm"
            variant="outline"
            className="bulk-group-trigger bg-white/90 hover:bg-white text-on-surface shadow-sm"
            disabled={bulkGroupMutation.isPending}
            onClick={() => setBulkGroupMenuOpen(v => !v)}
          >
            <Layers size={15} className="mr-1.5" />
            {bulkGroupMutation.isPending ? "Đang gán nhóm…" : "Gán nhóm ▾"}
          </Button>
          {bulkGroupMenuOpen && (
            <div className="bulk-group-menu absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-outline-variant py-1 z-30" role="menu">
              <span className="px-3 py-1.5 text-xs font-bold text-on-surface-variant uppercase tracking-wider block border-b border-outline-variant/60">
                Chọn nhóm áp dụng
              </span>
              {NHOM_NOI_DUNG.map(item => (
                <button
                  key={item.value}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center justify-between text-on-surface"
                  role="menuitem"
                  onClick={() => bulkGroupMutation.mutate({ ids: [...selectedIds], group: item.value })}
                >
                  <span>{item.label}</span>
                </button>
              ))}
              <hr className="my-1 border-outline-variant" />
              <button
                className="w-full text-left px-3 py-2 text-sm text-on-surface-variant hover:bg-surface-variant"
                role="menuitem"
                onClick={() => bulkGroupMutation.mutate({ ids: [...selectedIds], group: null })}
              >
                Gỡ phân loại
              </button>
            </div>
          )}
        </div>

        {selectedPdfIdsWithoutMd.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="bg-white/90 hover:bg-white text-on-surface shadow-sm"
            disabled={bulkConvertMutation.isPending}
            onClick={() => bulkConvertMutation.mutate(selectedPdfIdsWithoutMd)}
          >
            <FileCode size={15} className="mr-1.5" />
            {bulkConvertMutation.isPending ? "Đang chuyển…" : `Markdown (${selectedPdfIdsWithoutMd.length})`}
          </Button>
        )}

        <Button
          size="sm"
          variant="outline"
          className="text-error hover:bg-error-container hover:text-on-error-container border-error/30 bg-white/90 shadow-sm"
          disabled={bulkDeleteMutation.isPending}
          onClick={() => {
            if (confirm(`Xác nhận xóa ${selectedIds.size} tài liệu đã chọn?\nThao tác này không thể hoàn tác.`)) {
              bulkDeleteMutation.mutate([...selectedIds]);
            }
          }}
        >
          <Trash2 size={15} className="mr-1.5" />
          {bulkDeleteMutation.isPending ? "Đang xóa…" : "Xóa đã chọn"}
        </Button>

        <Button size="sm" variant="ghost" className="hover:bg-primary/10 ml-auto" onClick={() => setSelectedIds(new Set())}>
          Bỏ chọn
        </Button>
      </div>}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {visible.map((row) => {
          const thumbnail = isYoutubeRow(row) ? youtubeThumbnailUrl(row.fileUrl) : null;
          const showPdfPreview = !!row.fileUrl && (isPdfDoc(row) || (!!row.thumbnailUrl && !isUploadedVideo(row)));
          const selected = selectedIds.has(row.id);
          const folderPath = inKnownFolder(row) ? index.pathOf.get(row.folderId!) : undefined;
          return (
            <article key={row.id} draggable onDragStart={event => dragStart(event, row)} onDragEnd={() => setDropTarget(null)} className={`relative bg-white border rounded-xl hover:shadow-md transition-shadow flex flex-col ${selected ? "border-primary ring-2 ring-primary/40" : "border-outline-variant"} ${openDocMenu === row.id ? "z-30" : "z-0"}`}>
              <label className="absolute top-2 left-2 z-10 bg-white/90 rounded p-1 flex cursor-pointer" title="Chọn tài liệu">
                <input className={checkbox} type="checkbox" aria-label={`Chọn ${row.title}`} checked={selected} onChange={() => toggleSelected(row.id)} />
              </label>
              <button className={`relative aspect-video bg-surface-variant flex items-center justify-center overflow-hidden w-full rounded-t-xl ${thumbnail ? " doc-video-preview" : ""}`} onClick={() => openRow(row)}>
                {thumbnail ? (
                  <>
                    <img src={thumbnail} alt={`Ảnh video ${row.title}`} draggable={false} />
                    <span className="absolute inset-0 flex items-center justify-center text-white bg-black/30">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                    </span>
                  </>
                ) : showPdfPreview ? (
                  <PdfThumbnail fileUrl={row.fileUrl} accessToken={session.accessToken} pageNumber={1} className="doc-pdf-preview" renderScale={0.75} thumbnailUrl={row.thumbnailUrl} docType={row.docType} />
                ) : (
                  <span className="flex flex-col items-center gap-1 text-on-surface-variant">
                    {isUploadedVideo(row) && <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>}
                    <span className="text-lg font-bold tracking-wider">{DINH_DANG.find(item => item.value === row.fileFormat)?.short ?? "TÀI LIỆU"}</span>
                  </span>
                )}
              </button>
              <div className="p-4 flex flex-col flex-1 gap-2">
                <div className="relative pr-6">
                  <h2 className="text-base font-semibold text-on-surface line-clamp-2" title={row.title}>{row.title}</h2>
                  <div className="absolute top-0 right-0">
                    <button
                      className="doc-menu-trigger p-1 text-on-surface-variant hover:bg-surface-variant rounded-full"
                      aria-label={`Thao tác với ${row.title}`}
                      aria-expanded={openDocMenu === row.id}
                      onClick={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        const spaceBelow = window.innerHeight - rect.bottom;
                        setMenuUpward(spaceBelow < 420 && rect.top > spaceBelow);
                        setOpenDocMenu(current => current === row.id ? null : row.id);
                      }}
                    >
                      <MoreVertical size={17} />
                    </button>
                    {openDocMenu === row.id && (
                      <div
                        className={`doc-menu absolute right-0 ${menuUpward ? "bottom-full mb-1" : "top-full mt-1"} w-56 max-h-[min(480px,calc(100vh-100px))] overflow-y-auto bg-white rounded-lg shadow-xl border border-outline-variant py-1 z-30`}
                        role="menu"
                      >
                        {selectedIds.size > 0 && selectedIds.has(row.id) ? (
                          <>
                            <div className="px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-xs font-bold text-primary flex items-center justify-between">
                              <span>Thao tác {selectedIds.size} tài liệu</span>
                              <span className="text-[10px] bg-primary text-white px-1.5 py-0.2 rounded font-semibold">ĐÃ CHỌN</span>
                            </div>
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                              role="menuitem"
                              onClick={() => { setOpenDocMenu(null); setMovePicker({ kind: "documents", ids: [...selectedIds] }); }}
                            >
                              <FolderInput size={15} className="text-primary shrink-0" />
                              <span>Chuyển vào thư mục…</span>
                            </button>
                            <button
                              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                              role="menuitem"
                              onClick={() => {
                                setOpenDocMenu(null);
                                const selectedRows = rows.filter(r => selectedIds.has(r.id));
                                setAttachDocs(selectedRows);
                              }}
                            >
                              <Layers size={15} className="text-primary shrink-0" />
                              <span>Gắn vào chương trình…</span>
                            </button>
                            {selectedPdfIdsWithoutMd.length > 0 && (
                              <button
                                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant flex items-center gap-2 text-on-surface"
                                role="menuitem"
                                disabled={bulkConvertMutation.isPending}
                                onClick={() => { setOpenDocMenu(null); bulkConvertMutation.mutate(selectedPdfIdsWithoutMd); }}
                              >
                                <FileCode size={15} className="text-primary shrink-0" />
                                <span>Chuyển Markdown ({selectedPdfIdsWithoutMd.length})</span>
                              </button>
                            )}
                            <hr className="my-1 border-outline-variant" />
                            <span className="px-3 py-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Gán nhóm nội dung</span>
                            {NHOM_NOI_DUNG.map(item => (
                              <button
                                key={item.value}
                                className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant flex items-center justify-between text-on-surface"
                                role="menuitem"
                                disabled={bulkGroupMutation.isPending}
                                onClick={() => { setOpenDocMenu(null); bulkGroupMutation.mutate({ ids: [...selectedIds], group: item.value }); }}
                              >
                                <span>{item.label}</span>
                              </button>
                            ))}
                            <button
                              className="w-full text-left px-3 py-1.5 text-sm text-on-surface-variant hover:bg-surface-variant"
                              role="menuitem"
                              disabled={bulkGroupMutation.isPending}
                              onClick={() => { setOpenDocMenu(null); bulkGroupMutation.mutate({ ids: [...selectedIds], group: null }); }}
                            >
                              Gỡ phân loại
                            </button>
                            <hr className="my-1 border-outline-variant" />
                            <button
                              className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 flex items-center gap-2"
                              role="menuitem"
                              disabled={bulkDeleteMutation.isPending}
                              onClick={() => {
                                setOpenDocMenu(null);
                                if (confirm(`Xác nhận xóa ${selectedIds.size} tài liệu đã chọn?\nThao tác này không thể hoàn tác.`)) {
                                  bulkDeleteMutation.mutate([...selectedIds]);
                                }
                              }}
                            >
                              <Trash2 size={15} className="shrink-0" />
                              <span>Xóa {selectedIds.size} tài liệu đã chọn</span>
                            </button>
                            <hr className="my-1 border-outline-variant" />
                            <span className="px-3 py-1 text-[11px] font-semibold text-on-surface-variant/80 uppercase block">Chỉ tài liệu này</span>
                            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); openRow(row); }}>
                              {row.contentMarkdown ? "Đọc bản Markdown" : row.fileFormat === "VIDEO" || row.docType === "VIDEO" ? "Xem video" : "Mở tài liệu"}
                            </button>
                            {row.contentMarkdown && <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); openFile(row); }}>Mở file gốc</button>}
                            {isPdfDoc(row) && <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" disabled={!!ocrJob || converting === row.id} onClick={() => { setOpenDocMenu(null); void runOcr(row); }}>{row.contentMarkdown ? "Nhận dạng lại chữ (OCR)" : "Nhận dạng chữ (OCR)"}</button>}
                            <button className="w-full text-left px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); toggleSelected(row.id); }}>
                              Bỏ chọn tài liệu này
                            </button>
                          </>
                        ) : (
                          <>
                            {selectedIds.size > 0 && (
                              <div className="p-1.5 border-b border-outline-variant/60 bg-primary/5">
                                <button
                                  className="w-full text-left px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded flex items-center justify-between"
                                  onClick={() => toggleSelected(row.id)}
                                >
                                  <span>+ Thêm vào nhóm đã chọn</span>
                                  <span className="text-[10px] bg-primary/10 px-1.5 py-0.5 rounded font-bold">{selectedIds.size} đã chọn</span>
                                </button>
                              </div>
                            )}
                            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); openRow(row); }}>
                              {row.contentMarkdown ? "Đọc bản Markdown" : row.fileFormat === "VIDEO" || row.docType === "VIDEO" ? "Xem video" : row.fileFormat === "SCORM" || row.fileFormat === "XAPI" ? "Tải gói về" : "Mở tài liệu"}
                            </button>
                            {row.contentMarkdown && <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); openFile(row); }}>Mở file gốc</button>}
                            {isPdfDoc(row) && !row.contentMarkdown && <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" disabled={converting === row.id} onClick={() => { setOpenDocMenu(null); convertMutation.mutate(row.id); }}>{converting === row.id ? "Đang chuyển đổi…" : "Chuyển sang Markdown"}</button>}
                            {isPdfDoc(row) && <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" disabled={!!ocrJob || converting === row.id} onClick={() => { setOpenDocMenu(null); void runOcr(row); }}>{row.contentMarkdown ? "Nhận dạng lại chữ (OCR)" : "Nhận dạng chữ (OCR)"}</button>}
                            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); setMovePicker({ kind: "documents", ids: [row.id] }); }}>Chuyển vào thư mục…</button>
                            <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); setAttachDoc(row); }}>Gắn vào chương trình</button>
                            <hr className="my-1 border-outline-variant" />
                            <span className="px-3 py-1 text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Nhóm nội dung</span>
                            {NHOM_NOI_DUNG.map(item => <button key={item.value} className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" disabled={groupMutation.isPending || row.contentGroup === item.value} onClick={() => { setOpenDocMenu(null); groupMutation.mutate({ id: row.id, group: item.value }); }}>{row.contentGroup === item.value ? `✓ ${item.label}` : item.label}</button>)}
                            {row.contentGroup && <button className="w-full text-left px-3 py-1.5 text-sm hover:bg-surface-variant" role="menuitem" disabled={groupMutation.isPending} onClick={() => { setOpenDocMenu(null); groupMutation.mutate({ id: row.id, group: null }); }}>Gỡ phân loại</button>}
                            <hr className="my-1 border-outline-variant" />
                            <button className="w-full text-left px-3 py-1.5 text-sm text-error hover:bg-error/10" role="menuitem" disabled={deleteMutation.isPending} onClick={() => { setOpenDocMenu(null); deleteOne(row); }}>Xóa tài liệu</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {folderPath && selectedFolder !== row.folderId && <button className="flex items-center gap-1 text-xs text-on-surface-variant hover:text-primary text-left min-w-0" title={folderPath.join(" › ")} onClick={() => selectFolder(row.folderId!)}>
                  <Folder size={12} className="shrink-0" /><span className="truncate">{folderPath.join(" › ")}</span>
                </button>}
                <p className="flex flex-wrap gap-2 text-xs text-on-surface-variant items-center mt-auto">
                  <span className="bg-secondary-container text-on-secondary-container px-2 py-1 rounded-md font-semibold" title="Định dạng file">{dinhDangLabel(row.fileFormat)}</span>
                  <span className="bg-surface px-2 py-1 rounded-md border border-outline-variant">{typeLabel(row.docType)}</span>
                  <span className={row.contentGroup ? "bg-primary-container text-on-primary-container px-2 py-1 rounded-md" : "bg-surface px-2 py-1 rounded-md border border-outline-variant border-dashed"}>{nhomLabel(row.contentGroup)}</span>
                  <time className="ml-auto">{new Intl.DateTimeFormat("vi-VN").format(new Date(row.createdAt))}</time>
                </p>
                {isPdfDoc(row) && (row.contentMarkdown || converting === row.id || ocrJob?.id === row.id || convertErrors[row.id]) && (
                  <p className="mt-2 text-xs flex gap-2 items-center">
                    {ocrJob?.id === row.id ? (
                      <>
                        <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">{ocrJob.text}</span>
                        <button className="text-error hover:underline" onClick={() => { ocrCancel.current = true; }}>Hủy</button>
                      </>
                    ) : row.contentMarkdown ? (
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">Markdown ✓</span>
                    ) : converting === row.id ? (
                      <span className="bg-primary/10 text-primary px-2 py-1 rounded-md">Đang chuyển đổi…</span>
                    ) : null}
                    {convertErrors[row.id] && <span className="text-error">{convertErrors[row.id]}</span>}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {!visible.length && !documentsQuery.isLoading && <AdminEmptyState
        title={currentFolderId != null && !searchTerms.length && !filtersActive ? "Thư mục này chưa có tài liệu" : "Không có tài liệu phù hợp"}
        description={currentFolderId != null && !searchTerms.length && !filtersActive ? "Tải tài liệu lên ngay tại đây, hoặc kéo tài liệu có sẵn thả vào thư mục." : "Thử bỏ bớt bộ lọc, đổi từ khóa, hoặc tìm trong toàn bộ kho."}
      />}
    </main>

    {upload && <DocumentUpload session={session} types={types} folders={index.flat} initialFolderId={currentFolderId} initialType={uploadInitialType} onClose={() => { setUpload(false); setUploadInitialType(""); }} onDone={async () => {
      setUpload(false);
      setUploadInitialType("");
      await invalidateDocuments();
    }} />}
    {bulkUpload && <AdminBulkUpload session={session} types={types} folders={index.flat} initialFolderId={currentFolderId} onClose={() => setBulkUpload(false)} onDone={invalidateDocuments} />}
    {folderDialog && <FolderNameDialog
      session={session}
      dialog={folderDialog}
      parentPath={folderDialog.mode === "create" && folderDialog.parentId != null ? index.pathOf.get(folderDialog.parentId) : undefined}
      onClose={() => setFolderDialog(null)}
      onSaved={async (folder, created) => {
        setFolderDialog(null);
        if (created) {
          if (folder.parentId != null) expandPath(folder.parentId);
          setSelectedFolder(folder.id);
        }
        await invalidateDocuments();
      }}
    />}
    {movePicker && <FolderPicker
      title={movePicker.kind === "folder" ? `Chuyển thư mục "${movePicker.folder.name}"` : `Chuyển ${movePicker.ids.length} tài liệu vào thư mục`}
      rootLabel={movePicker.kind === "folder" ? "Cấp gốc (không có thư mục cha)" : "Chưa xếp thư mục"}
      folders={index.flat}
      // Không cho chọn chính thư mục đó hay con cháu của nó — máy chủ cũng chặn, đây chỉ để khỏi bấm nhầm.
      excluded={movePicker.kind === "folder" ? index.subtree(movePicker.folder.id) : new Set()}
      current={movePicker.kind === "folder" ? movePicker.folder.parentId : movePicker.ids.length === 1 ? (rows.find(row => row.id === movePicker.ids[0])?.folderId ?? null) : undefined}
      busy={moveDocumentsMutation.isPending || moveFolderMutation.isPending}
      onClose={() => setMovePicker(null)}
      onPick={target => movePicker.kind === "folder"
        ? moveFolderMutation.mutate({ id: movePicker.folder.id, parentId: target })
        : moveDocumentsMutation.mutate({ ids: movePicker.ids, folderId: target })}
    />}
    {markdownDoc && markdownDoc.contentMarkdown && <MarkdownViewer session={session} title={markdownDoc.title} markdown={markdownDoc.contentMarkdown} fileUrl={markdownDoc.fileUrl} onClose={() => setMarkdownDoc(null)} onOpenPdf={isPdfDoc(markdownDoc) ? () => { setMarkdownDoc(null); setPdfDoc(markdownDoc); } : undefined} />}
    {pdfDoc && <PdfViewer session={session} documentId={pdfDoc.id} title={pdfDoc.title} fileUrl={pdfDoc.fileUrl} onClose={() => setPdfDoc(null)} />}
    {videoDoc && <YoutubeVideoModal title={videoDoc.title} url={videoDoc.fileUrl} onClose={() => setVideoDoc(null)} />}
    {(attachDoc || (attachDocs && attachDocs.length > 0)) && (
      <AttachDocumentDialog
        session={session}
        document={attachDoc}
        documents={attachDocs}
        onClose={() => { setAttachDoc(null); setAttachDocs(null); }}
        onDone={async () => { setAttachDoc(null); setAttachDocs(null); await invalidateDocuments(); }}
      />
    )}
  </AdminPage>;
}

/** Video tải lên nằm sau endpoint có xác thực, nên tải byte kèm token rồi phát từ object URL. */
function UploadedVideoModal({ session, document, onClose }: { session: AuthSession; document: DocumentItem; onClose: () => void }) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchDocumentObjectUrl(session, document.fileUrl)
      .then(url => { if (cancelled) URL.revokeObjectURL(url); else { objectUrl = url; setSrc(url); } })
      .catch(reason => { if (!cancelled) setError(message(reason)); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [session, document.fileUrl]);
  return (
    <AdminModal open={true} onClose={onClose} title={document.title} size="xl">
      {error ? <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>
        : src ? <video src={src} controls autoPlay className="w-full max-h-[70vh] bg-black rounded-lg" />
        : <p className="text-sm text-on-surface-variant">Đang tải video…</p>}
    </AdminModal>
  );
}

/** Tạo hoặc đổi tên thư mục. Lỗi của máy chủ (trùng tên cùng cấp, quá sâu) hiện ngay trong hộp thoại để sửa tại chỗ. */
function FolderNameDialog({ session, dialog, parentPath, onClose, onSaved }: {
  session: AuthSession;
  dialog: Exclude<FolderDialog, null>;
  parentPath?: string[];
  onClose: () => void;
  onSaved: (folder: AdminDocumentFolder, created: boolean) => Promise<void>;
}) {
  const [name, setName] = useState(dialog.mode === "rename" ? dialog.folder.name : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!name.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const folder = dialog.mode === "rename"
        ? await renameAdminDocumentFolder(session, dialog.folder.id, name.trim())
        : await createAdminDocumentFolder(session, name.trim(), dialog.parentId);
      await onSaved(folder, dialog.mode === "create");
    } catch (reason) {
      setError(message(reason));
      setBusy(false);
    }
  };
  return (
    <AdminModal open={true} onClose={onClose} title={dialog.mode === "rename" ? "Đổi tên thư mục" : parentPath ? "Tạo thư mục con" : "Tạo thư mục"} size="sm" footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button disabled={!name.trim() || busy} onClick={() => void save()}>{busy ? "Đang lưu…" : "Lưu"}</Button></>}>
      <form onSubmit={save} className="space-y-3">
        {dialog.mode === "create" && <p className="text-sm text-on-surface-variant">Nằm trong: <strong className="text-on-surface">{parentPath ? parentPath.join(" › ") : "Cấp gốc"}</strong></p>}
        <label className="block text-sm font-medium text-on-surface">Tên thư mục</label>
        <input autoFocus required maxLength={120} placeholder="Ví dụ: Khối 10, Hàm số, Đề kiểm tra giữa kỳ" value={name} onChange={event => setName(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
        {error && <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}
      </form>
    </AdminModal>
  );
}

/** Chọn thư mục đích, có ô lọc nhanh không cần dấu — cây lớn thì cuộn tìm rất mệt. */
function FolderPicker({ title, rootLabel, folders, excluded, current, busy, onClose, onPick }: {
  title: string;
  rootLabel: string;
  folders: FlatFolder[];
  excluded: Set<number>;
  /** Vị trí hiện tại; undefined khi nhiều tài liệu nằm ở các nơi khác nhau. */
  current: number | null | undefined;
  busy: boolean;
  onClose: () => void;
  onPick: (folderId: number | null) => void;
}) {
  const [choice, setChoice] = useState<number | null | undefined>(undefined);
  const [filter, setFilter] = useState("");
  const terms = foldText(filter).split(/\s+/).filter(Boolean);
  const shown = folders.filter(node => !excluded.has(node.folder.id) && (!terms.length || terms.every(term => foldText(node.path.join(" ")).includes(term))));
  const option = (key: number | null, label: React.ReactNode, depth: number, hint?: string) => {
    const isCurrent = current !== undefined && current === key;
    return <button key={key ?? "root"} type="button" disabled={isCurrent} onClick={() => setChoice(key)}
      className={`w-full flex items-center gap-2 py-1.5 pr-2 rounded-md text-sm text-left ${choice === key ? "bg-primary/10 text-primary font-semibold" : "hover:bg-surface-variant/60"} disabled:opacity-50`}
      style={{ paddingLeft: 8 + depth * 16 }} title={hint}>
      {key == null ? <FolderOpen size={15} className="shrink-0" /> : <Folder size={15} className="shrink-0" />}
      <span className="truncate">{label}</span>
      {isCurrent && <span className="ml-auto text-xs">(đang ở đây)</span>}
    </button>;
  };
  return (
    <AdminModal open={true} onClose={() => { if (!busy) onClose(); }} title={title} size="md" footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Hủy</Button><Button disabled={choice === undefined || busy} onClick={() => { if (choice !== undefined) onPick(choice); }}>{busy ? "Đang chuyển…" : "Chuyển đến đây"}</Button></>}>
      <div className="space-y-3">
        <input autoFocus placeholder="Lọc thư mục…" value={filter} onChange={event => setFilter(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
        <div className="max-h-[50vh] overflow-y-auto border border-outline-variant rounded-lg p-1">
          {!terms.length && option(null, rootLabel, 0)}
          {shown.map(node => terms.length ? option(node.folder.id, node.path.join(" › "), 0) : option(node.folder.id, node.folder.name, node.depth + 1, node.path.join(" › ")))}
          {terms.length > 0 && !shown.length && <p className="p-3 text-sm text-on-surface-variant">Không có thư mục khớp.</p>}
        </div>
      </div>
    </AdminModal>
  );
}

/** Ô chọn thư mục đích cho form tải lên — thụt lề theo cấp để nhìn ra cây. */
function FolderSelect({ folders, value, onChange, disabled, className }: { folders: FlatFolder[]; value: number | null; onChange: (value: number | null) => void; disabled?: boolean; className?: string }) {
  return (
    <select value={value ?? ""} disabled={disabled} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)} className={className ?? "w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white"}>
      <option value="">— Chưa xếp thư mục —</option>
      {folders.map(node => <option key={node.folder.id} value={node.folder.id} title={node.path.join(" › ")}>{"   ".repeat(node.depth)}{node.folder.name}</option>)}
    </select>
  );
}

function DocumentUpload({ session, types, folders, initialFolderId, initialType, onClose, onDone }: { session: AuthSession; types: MetadataOption[]; folders: FlatFolder[]; initialFolderId: number | null; initialType?: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState(initialType || types[0]?.value || "KHBD");
  const [audience, setAudience] = useState("TEACHER_ONLY");
  const [folderId, setFolderId] = useState<number | null>(initialFolderId);
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoSource, setVideoSource] = useState<"youtube" | "file">("youtube");
  const [youtubeMode, setYoutubeMode] = useState<"single" | "bulk">("single");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  type BulkVideoRow = {
    id: string;
    youtubeId: string;
    canonicalUrl: string;
    thumbnailUrl: string;
    title: string;
    status: "pending" | "uploading" | "done" | "error";
    error?: string;
  };
  const [bulkUrlsText, setBulkUrlsText] = useState("");
  const [bulkVideoRows, setBulkVideoRows] = useState<BulkVideoRow[]>([]);

  const onBulkUrlsChange = (text: string) => {
    setBulkUrlsText(text);
    const parsed = parseYoutubeList(text);
    setBulkVideoRows(current => {
      const existingTitles = new Map(current.map(r => [r.youtubeId, r.title]));
      return parsed.map((p, idx) => ({
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

  const isVideo = type === "VIDEO";
  const useYoutube = isVideo && videoSource === "youtube";
  const isBulkYt = useYoutube && youtubeMode === "bulk";
  const ytEmbed = useYoutube ? youtubeEmbedUrl(videoUrl) : null;
  const ytThumb = useYoutube ? youtubeThumbnailUrl(videoUrl) : null;
  const ready = !!type && (useYoutube ? (isBulkYt ? bulkVideoRows.length > 0 : !!ytEmbed) : !!file);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    if (isBulkYt) {
      await submitBulk();
      return;
    }
    setBusy(true);
    try {
      // Tên để trống thì lấy theo tên file hoặc mặc định "Video YouTube"
      const finalTitle = title.trim() || (useYoutube ? "Video YouTube" : (file ? deriveDocTitle(file.name) : ""));
      const finalVideoUrl = useYoutube ? canonicalYoutubeUrl(videoUrl) : null;
      await uploadDocument(session, { title: finalTitle, docType: type, audience, folderId, file: useYoutube ? null : file, videoUrl: finalVideoUrl });
      await onDone();
    } catch (reason) {
      setError(message(reason));
      setBusy(false);
    }
  };

  const submitBulk = async () => {
    if (!bulkVideoRows.length) return;
    setBusy(true);
    setError("");
    const pending = bulkVideoRows.filter(r => r.status === "pending" || r.status === "error");
    const CONCURRENCY = 3;
    for (let i = 0; i < pending.length; i += CONCURRENCY) {
      await Promise.all(pending.slice(i, i + CONCURRENCY).map(async row => {
        updateBulkRow(row.id, { status: "uploading", error: undefined });
        try {
          await uploadDocument(session, {
            title: row.title.trim() || "Video YouTube",
            docType: "VIDEO",
            audience,
            folderId,
            videoUrl: row.canonicalUrl,
          });
          updateBulkRow(row.id, { status: "done" });
        } catch (reason) {
          updateBulkRow(row.id, { status: "error", error: message(reason) });
        }
      }));
    }
    await onDone();
    setBusy(false);
    if (bulkVideoRows.every(r => r.status === "done")) {
      onClose();
    }
  };

  const invalidVideo = useYoutube && !isBulkYt && !!videoUrl.trim() && !ytEmbed;

  return (
    <AdminModal
      open={true}
      onClose={onClose}
      title={isVideo ? (useYoutube ? (isBulkYt ? "Tải nhiều video YouTube cùng lúc" : "Thêm video YouTube") : "Tải video lên") : "Tải tài liệu lên"}
      size={isBulkYt ? "lg" : "md"}
      footer={
        isBulkYt ? (
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-on-surface-variant font-medium">
              {bulkVideoRows.filter(r => r.status === "done").length} / {bulkVideoRows.length} đã tải lên
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose} disabled={busy}>Hủy</Button>
              <Button
                disabled={busy || !bulkVideoRows.length || !bulkVideoRows.some(r => r.status === "pending" || r.status === "error")}
                onClick={() => void submitBulk()}
              >
                {busy ? "Đang tải…" : `Tải lên (${bulkVideoRows.filter(r => r.status === "pending" || r.status === "error").length} video)`}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button variant="outline" onClick={onClose}>Hủy</Button>
            <Button disabled={busy || !ready} onClick={submit}>
              {busy ? "Đang tải…" : isVideo ? "Thêm video" : "Tải lên"}
            </Button>
          </>
        )
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {isVideo && (
          <div className="flex gap-4 text-sm bg-surface-variant/50 p-2.5 rounded-lg">
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input type="radio" name="video-source" checked={videoSource === "youtube"} onChange={() => setVideoSource("youtube")} />
              Dùng link YouTube
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium">
              <input type="radio" name="video-source" checked={videoSource === "file"} onChange={() => setVideoSource("file")} />
              Tải file video lên
            </label>
          </div>
        )}

        {useYoutube && (
          <div className="flex rounded-lg border border-outline-variant p-1 bg-surface-variant/40">
            <button
              type="button"
              onClick={() => setYoutubeMode("single")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                youtubeMode === "single" ? "bg-white shadow text-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Một video (1 link)
            </button>
            <button
              type="button"
              onClick={() => setYoutubeMode("bulk")}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                youtubeMode === "bulk" ? "bg-white shadow text-primary" : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Nhiều video cùng lúc (dán nhiều link)
            </button>
          </div>
        )}

        {!isBulkYt && (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Tên tài liệu</label>
            <input placeholder={useYoutube ? "Tên video (để trống sẽ mặc định là Video YouTube)" : "Để trống để lấy theo tên file"} value={title} onChange={event => setTitle(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Loại tài liệu</label>
            <select required value={type} onChange={event => setType(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              {types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Phạm vi</label>
            <select value={audience} onChange={event => setAudience(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
              <option value="TEACHER_ONLY">Chỉ giáo viên</option>
              <option value="STUDENT_ALLOWED">Cho phép học sinh</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-1">Thư mục</label>
          <FolderSelect folders={folders} value={folderId} onChange={setFolderId} />
        </div>

        {useYoutube ? (
          isBulkYt ? (
            <div className="space-y-3 pt-1">
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
                  className="w-full p-2.5 rounded-lg border border-outline-variant text-xs focus:ring-2 focus:ring-primary outline-none"
                />
                <small className="text-on-surface-variant block mt-1">
                  Hỗ trợ link xem thường, link ngắn (youtu.be), Shorts, Live, mã nhúng embed... Tự động lọc trùng lặp.
                </small>
              </div>

              {bulkVideoRows.length > 0 && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-on-surface-variant">
                    Danh sách video nhận diện được ({bulkVideoRows.length}):
                  </div>
                  <div className="space-y-2 max-h-[36vh] overflow-y-auto pr-1">
                    {bulkVideoRows.map((row, idx) => (
                      <div key={row.id} className="flex items-center gap-3 p-2 rounded-lg border border-outline-variant bg-surface hover:bg-surface-variant/20 transition-colors">
                        <span className="text-xs font-semibold text-on-surface-variant w-5 text-center shrink-0">{idx + 1}</span>
                        <img src={row.thumbnailUrl} alt="" className="w-16 h-10 object-cover rounded shadow-sm shrink-0 border border-outline-variant" />
                        <div className="flex-1 min-w-0">
                          <input
                            value={row.title}
                            onChange={e => updateBulkRow(row.id, { title: e.target.value })}
                            placeholder="Tiêu đề video"
                            disabled={row.status === "uploading" || row.status === "done"}
                            className="w-full h-8 px-2 rounded border border-outline-variant text-xs disabled:opacity-50"
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
            <div className="space-y-2">
              <label className="block text-sm font-medium text-on-surface mb-1">Link video YouTube</label>
              <input required type="text" placeholder="Dán link YouTube (youtube.com, youtu.be, Shorts, Live...)" value={videoUrl} onChange={event => setVideoUrl(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none" />
              {invalidVideo && <small className="text-error block mt-1">Link YouTube không hợp lệ. Vui lòng kiểm tra lại đường dẫn.</small>}
              {ytThumb && (
                <div className="flex items-center gap-3 p-2.5 rounded-lg border border-primary/30 bg-primary-container/20">
                  <img src={ytThumb} alt="Xem trước video" className="w-24 h-14 object-cover rounded shadow-sm shrink-0 border border-outline-variant" />
                  <div className="text-xs text-on-surface min-w-0">
                    <span className="font-semibold text-primary block">✓ Nhận diện link YouTube thành công</span>
                    <span className="truncate block text-on-surface-variant text-[11px] mt-0.5">{canonicalYoutubeUrl(videoUrl)}</span>
                  </div>
                </div>
              )}
              <small className="text-on-surface-variant block mt-1">Video sẽ phát trực tiếp ngay trong website, học sinh không bị chuyển sang YouTube.</small>
            </div>
          )
        ) : (
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Chọn file</label>
            <input key={isVideo ? "video" : "file"} required type="file" accept={isVideo ? ".mp4,.webm,.mov,.m4v" : FILE_ACCEPT} onChange={event => setFile(event.target.files?.[0] ?? null)} className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface-variant file:text-on-surface hover:file:bg-outline-variant cursor-pointer" />
            <small className="text-on-surface-variant block mt-1">{isVideo ? "MP4, WebM, MOV — tối đa 100 MB." : `${FILE_ACCEPT_HINT}. Định dạng được nhận tự động.`}</small>
          </div>
        )}
        {error && <div className="p-3 rounded-lg bg-error-container text-on-error-container text-sm">{error}</div>}
      </form>
    </AdminModal>
  );
}

type AdminBulkRow = { id: string; file: File; title: string; typeValue: string; audience: string; status: "pending" | "uploading" | "done" | "error"; error?: string };
const deriveDocTitle = (name: string) => name.replace(/\.[^.]+$/, "").trim() || name;

/** Modal tải nhiều tài liệu cùng lúc cho Admin: chọn nhiều file, gán tên/loại/phạm vi hàng loạt, cả lô vào một thư mục, tải với giới hạn đồng thời. */
function AdminBulkUpload({ session, types, folders, initialFolderId, onClose, onDone }: { session: AuthSession; types: MetadataOption[]; folders: FlatFolder[]; initialFolderId: number | null; onClose: () => void; onDone: () => void }) {
  const [rows, setRows] = useState<AdminBulkRow[]>([]);
  const [defaultType, setDefaultType] = useState(types[0]?.value ?? "");
  const [defaultAudience, setDefaultAudience] = useState("TEACHER_ONLY");
  const [folderId, setFolderId] = useState<number | null>(initialFolderId);
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
    if (!row.typeValue) { updateRow(row.id, { status: "error", error: "Chưa chọn loại tài liệu" }); return; }
    updateRow(row.id, { status: "uploading", error: undefined });
    try {
      const title = row.title.trim() || deriveDocTitle(row.file.name);
      await uploadDocument(session, { title, docType: row.typeValue, audience: row.audience, folderId, file: row.file });
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

  return (
    <AdminModal open={true} onClose={() => { if (!busy) onClose(); }} title="Tải nhiều tài liệu" size="xl" footer={
      <div className="flex items-center justify-between w-full">
        <span className="text-sm text-on-surface-variant">{doneCount} / {rows.length} đã tải lên</span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Đóng</Button>
          <Button onClick={() => void uploadAll()} disabled={busy || !canUpload}>{busy ? "Đang tải…" : `Tải lên (${rows.filter(row => row.status === "pending" || row.status === "error").length})`}</Button>
        </div>
      </div>
    }>
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Chọn file ({FILE_ACCEPT_HINT} — chọn được nhiều file cùng lúc)</label>
            <input type="file" multiple accept={FILE_ACCEPT} onChange={event => { addFiles(event.target.files); event.target.value = ""; }} className="w-full text-sm text-on-surface-variant file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-surface-variant file:text-on-surface hover:file:bg-outline-variant cursor-pointer" />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Thư mục đích cho cả lô</label>
            <FolderSelect folders={folders} value={folderId} onChange={setFolderId} disabled={busy} />
          </div>
        </div>
        {rows.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-end gap-3 p-4 bg-surface rounded-lg border border-outline-variant">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-on-surface mb-1">Loại tài liệu mặc định</label>
                <select value={defaultType} onChange={event => setDefaultType(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
                  {types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-on-surface mb-1">Phạm vi mặc định</label>
                <select value={defaultAudience} onChange={event => setDefaultAudience(event.target.value)} className="w-full h-10 px-3 rounded-lg border border-outline-variant focus:ring-2 focus:ring-primary outline-none bg-white">
                  <option value="TEACHER_ONLY">Chỉ giáo viên</option>
                  <option value="STUDENT_ALLOWED">Cho phép học sinh</option>
                </select>
              </div>
              <Button variant="outline" onClick={applyDefaults}>Áp dụng cho tất cả</Button>
            </div>
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-2">
              {rows.map(row => (
                <div key={row.id} className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-outline-variant hover:bg-surface">
                  <input value={row.title} onChange={event => updateRow(row.id, { title: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} className="flex-[2] min-w-0 h-9 px-2 rounded border border-outline-variant text-sm disabled:opacity-50" />
                  <select value={row.typeValue} onChange={event => updateRow(row.id, { typeValue: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} className="flex-1 min-w-0 h-9 px-2 rounded border border-outline-variant text-sm bg-white disabled:opacity-50">
                    {types.map(item => <option value={item.value} key={item.value}>{item.label}</option>)}
                  </select>
                  <select value={row.audience} onChange={event => updateRow(row.id, { audience: event.target.value })} disabled={row.status === "uploading" || row.status === "done"} className="flex-1 min-w-0 h-9 px-2 rounded border border-outline-variant text-sm bg-white disabled:opacity-50">
                    <option value="TEACHER_ONLY">Chỉ giáo viên</option>
                    <option value="STUDENT_ALLOWED">Cho phép học sinh</option>
                  </select>
                  <div className="w-24 text-sm font-medium truncate">
                    {row.status === "pending" ? <span className="text-on-surface-variant">Chờ</span> : row.status === "uploading" ? <span className="text-primary">Đang tải…</span> : row.status === "done" ? <span className="text-[#3f6212]">✓ Xong</span> : <span className="text-error">✗ Lỗi</span>}
                  </div>
                  {row.status === "uploading" || row.status === "done" ? <div className="w-8" /> : (
                    <button type="button" title="Bỏ khỏi danh sách" aria-label={`Bỏ ${row.title}`} onClick={() => removeRow(row.id)} className="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-error rounded hover:bg-error/10">
                      <X size={16} />
                    </button>
                  )}
                  {row.status === "error" && <div className="w-full text-xs text-error mt-1">{row.error}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminModal>
  );
}
