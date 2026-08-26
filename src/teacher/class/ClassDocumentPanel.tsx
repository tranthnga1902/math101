import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClassDocuments, getClassDocumentLibrary, attachClassDocument, updateClassDocument, detachClassDocument,
  openDocumentFile, type AuthSession, type ClassRequirement,
} from "../../api";
import { PdfViewer, isPdfDocument } from "../../components/PdfViewer";
import { messageOf } from "../../lib/errors";

type OpenDoc = { id: number; title: string; fileUrl: string };

const sourceLabel = { KHO_CHUNG: "Kho chung", RIENG: "Tài liệu riêng" } as const;

/**
 * Tài liệu đi kèm lớp. Bảng class_documents chỉ giữ tham chiếu tới tài liệu gốc:
 * nhãn Bắt buộc/Tự chọn là của lớp, còn tài liệu trong kho chung thì giáo viên không sửa/xóa được.
 */
export function ClassDocumentPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const [browsing, setBrowsing] = useState(false);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("");
  const [attachAs, setAttachAs] = useState<ClassRequirement>("TU_CHON");
  const [pdf, setPdf] = useState<OpenDoc | null>(null);

  const listQuery = useQuery({ queryKey: ["class-documents", session.accessToken, classId], queryFn: () => getClassDocuments(session, classId) });
  const attached = listQuery.data ?? [];
  const libraryQuery = useQuery({
    queryKey: ["class-document-library", session.accessToken, classId, search, source],
    queryFn: () => getClassDocumentLibrary(session, classId, { search: search || undefined, source: source || undefined }),
    enabled: browsing,
  });
  const library = libraryQuery.data ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["class-document"] });
  const attachMutation = useMutation({ mutationFn: (documentId: number) => attachClassDocument(session, classId, { documentId, requirement: attachAs }), onSuccess: invalidate });
  const updateMutation = useMutation({ mutationFn: ({ id, requirement }: { id: number; requirement: ClassRequirement }) => updateClassDocument(session, classId, id, { requirement }), onSuccess: invalidate });
  const detachMutation = useMutation({ mutationFn: (id: number) => detachClassDocument(session, classId, id), onSuccess: invalidate });
  const error = [listQuery, libraryQuery, attachMutation, updateMutation, detachMutation].map(q => (q.isError ? messageOf(q.error) : "")).find(Boolean) ?? "";

  const required = attached.filter(row => row.requirement === "BAT_BUOC");
  const optional = attached.filter(row => row.requirement === "TU_CHON");

  const openPdf = (row: { document_id: number; title: string; file_url: string; doc_type: string }) => {
    if (isPdfDocument({ fileUrl: row.file_url, docType: row.doc_type })) setPdf({ id: row.document_id, title: row.title, fileUrl: row.file_url });
    else void openDocumentFile(session, row.file_url, row.title);
  };

  return <section className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-base font-bold text-on-surface">Tài liệu của lớp</h3>
        <p className="text-xs text-on-surface-variant">{required.length} bắt buộc · {optional.length} tự chọn · chỉ gắn tham chiếu, tài liệu gốc do Admin quản lý</p>
      </div>
      <button onClick={() => setBrowsing(v => !v)} className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity">
        {browsing ? "Đóng kho tài liệu" : "Gắn tài liệu"}
      </button>
    </div>

    {error && <div className="api-error">{error}</div>}

    {browsing && (
      <div className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-2 flex-wrap">
          <input placeholder="Tìm tài liệu theo tên" value={search} onChange={e => setSearch(e.target.value)}
            className="h-8 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface flex-1 min-w-[180px]" />
          <select value={source} onChange={e => setSource(e.target.value)} className="h-8 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
            <option value="">Tất cả nguồn</option>
            <option value="KHO_CHUNG">Kho chung cấp trường</option>
            <option value="RIENG">Tài liệu riêng của tôi</option>
          </select>
          <select value={attachAs} onChange={e => setAttachAs(e.target.value as ClassRequirement)} className="h-8 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
            <option value="TU_CHON">Gắn dạng Tự chọn</option>
            <option value="BAT_BUOC">Gắn dạng Bắt buộc</option>
          </select>
        </div>
        <div className="max-h-[45vh] overflow-auto divide-y divide-outline-variant">
          {libraryQuery.isLoading && <p className="px-4 py-3 text-sm text-on-surface-variant">Đang tải kho tài liệu…</p>}
          {!libraryQuery.isLoading && !library.length && <p className="px-4 py-3 text-sm text-on-surface-variant">Không có tài liệu nào khớp bộ lọc.</p>}
          {library.map(row => (
            <div key={row.id} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-container-low transition-colors">
              <div className="min-w-0">
                <p className="text-sm text-on-surface truncate">{row.title}</p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {sourceLabel[row.source]} · {row.doc_type}
                  {row.taxonomy_title && ` · ${row.taxonomy_title}`}
                  {row.total_pages ? ` · ${row.total_pages} trang` : ""}
                </p>
              </div>
              <button onClick={() => attachMutation.mutate(row.id)} disabled={row.attached || attachMutation.isPending}
                className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded transition-colors ${row.attached ? "text-on-surface-variant cursor-default" : "text-primary hover:bg-primary-container/20"}`}>
                {row.attached ? "Đã gắn" : "Gắn vào lớp"}
              </button>
            </div>
          ))}
        </div>
      </div>
    )}

    {([["BAT_BUOC", "Bắt buộc", required], ["TU_CHON", "Tự chọn", optional]] as const).map(([key, label, rows]) => (
      <div key={key} className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${key === "BAT_BUOC" ? "bg-primary-container/30 text-primary" : "bg-surface-variant text-on-surface-variant"}`}>{label}</span>
          <span className="text-xs text-on-surface-variant">{rows.length} tài liệu</span>
        </div>
        <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
          {rows.map(row => (
            <div key={row.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
              <div className="min-w-0">
                <p className="text-sm text-on-surface truncate">{row.title}</p>
                <p className="text-[11px] text-on-surface-variant truncate">
                  {sourceLabel[row.source]}
                  {row.owner_name && ` · ${row.owner_name}`}
                  {row.taxonomy_title && ` · ${row.taxonomy_title}`}
                  {row.attached_by_name && ` · gắn bởi ${row.attached_by_name}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openPdf(row)} className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors">Mở</button>
                <button onClick={() => updateMutation.mutate({ id: row.id, requirement: key === "BAT_BUOC" ? "TU_CHON" : "BAT_BUOC" })}
                  className="px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded transition-colors">
                  {key === "BAT_BUOC" ? "Đổi sang Tự chọn" : "Đổi sang Bắt buộc"}
                </button>
                <button onClick={() => detachMutation.mutate(row.id)} className="px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors">Bỏ</button>
              </div>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-on-surface-variant text-center py-6">Chưa có tài liệu {label.toLowerCase()}.</p>}
        </div>
      </div>
    ))}

    {pdf && <PdfViewer session={session} documentId={pdf.id} title={pdf.title} fileUrl={pdf.fileUrl} onClose={() => setPdf(null)} />}
  </section>;
}
