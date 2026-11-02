import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
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
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<number>>(new Set());
  const [selectedAttachedIds, setSelectedAttachedIds] = useState<Set<number>>(new Set());
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [openDocMenu, setOpenDocMenu] = useState<number | null>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".doc-menu") && !target.closest(".doc-menu-trigger")) setOpenDocMenu(null);
      if (!target.closest(".bulk-menu") && !target.closest(".bulk-menu-trigger")) setBulkMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const listQuery = useQuery({ queryKey: ["class-documents", session.accessToken, classId], queryFn: () => getClassDocuments(session, classId) });
  const attached = listQuery.data ?? [];
  const libraryQuery = useQuery({
    queryKey: ["class-document-library", session.accessToken, classId, search, source],
    queryFn: () => getClassDocumentLibrary(session, classId, { search: search || undefined, source: source || undefined }),
    enabled: browsing,
  });
  const library = libraryQuery.data ?? [];

  const unattachedDocs = useMemo(() => library.filter(row => !row.attached), [library]);
  const allUnattachedSelected = unattachedDocs.length > 0 && unattachedDocs.every(row => selectedLibraryIds.has(row.id));
  const toggleSelectAllLibrary = () => {
    setSelectedLibraryIds(allUnattachedSelected ? new Set() : new Set(unattachedDocs.map(row => row.id)));
  };
  const toggleSelectLibrary = (id: number) => {
    setSelectedLibraryIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAttached = (id: number) => {
    setSelectedAttachedIds(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["class-document"] });
  const attachMutation = useMutation({ mutationFn: (documentId: number) => attachClassDocument(session, classId, { documentId, requirement: attachAs }), onSuccess: invalidate });
  const updateMutation = useMutation({ mutationFn: ({ id, requirement }: { id: number; requirement: ClassRequirement }) => updateClassDocument(session, classId, id, { requirement }), onSuccess: invalidate });
  const detachMutation = useMutation({ mutationFn: (id: number) => detachClassDocument(session, classId, id), onSuccess: invalidate });

  const bulkAttachMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => attachClassDocument(session, classId, { documentId: id, requirement: attachAs })));
    },
    onSuccess: () => {
      setSelectedLibraryIds(new Set());
      invalidate();
    },
  });

  const bulkDetachMutation = useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map(id => detachClassDocument(session, classId, id)));
    },
    onSuccess: () => {
      setSelectedAttachedIds(new Set());
      invalidate();
    },
  });

  const bulkUpdateRequirementMutation = useMutation({
    mutationFn: async ({ ids, requirement }: { ids: number[]; requirement: ClassRequirement }) => {
      await Promise.all(ids.map(id => updateClassDocument(session, classId, id, { requirement })));
    },
    onSuccess: () => {
      setSelectedAttachedIds(new Set());
      invalidate();
    },
  });

  const error = [listQuery, libraryQuery, attachMutation, updateMutation, detachMutation, bulkAttachMutation, bulkDetachMutation, bulkUpdateRequirementMutation].map(q => (q.isError ? messageOf(q.error) : "")).find(Boolean) ?? "";

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

        {unattachedDocs.length > 0 && (
          <div className="px-4 py-2 bg-surface-container-low/60 border-b border-outline-variant flex items-center justify-between gap-2 text-xs flex-wrap">
            <label className="flex items-center gap-1.5 font-medium text-on-surface cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-outline-variant text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                checked={allUnattachedSelected}
                onChange={toggleSelectAllLibrary}
              />
              <span>Chọn tất cả chưa gắn ({unattachedDocs.length})</span>
            </label>
            {selectedLibraryIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="font-semibold text-primary">Đã chọn {selectedLibraryIds.size}</span>
                <button
                  disabled={bulkAttachMutation.isPending}
                  onClick={() => bulkAttachMutation.mutate([...selectedLibraryIds])}
                  className="px-2.5 py-1 rounded bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
                >
                  {bulkAttachMutation.isPending ? "Đang gắn…" : `Gắn ${selectedLibraryIds.size} tài liệu (${attachAs === "BAT_BUOC" ? "Bắt buộc" : "Tự chọn"})`}
                </button>
                <button
                  onClick={() => setSelectedLibraryIds(new Set())}
                  className="text-on-surface-variant hover:underline"
                >
                  Bỏ chọn
                </button>
              </div>
            )}
          </div>
        )}

        <div className="max-h-[45vh] overflow-auto divide-y divide-outline-variant">
          {libraryQuery.isLoading && <p className="px-4 py-3 text-sm text-on-surface-variant">Đang tải kho tài liệu…</p>}
          {!libraryQuery.isLoading && !library.length && <p className="px-4 py-3 text-sm text-on-surface-variant">Không có tài liệu nào khớp bộ lọc.</p>}
          {library.map(row => (
            <div key={row.id} className={`flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-container-low transition-colors ${selectedLibraryIds.has(row.id) ? "bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                {!row.attached ? (
                  <input
                    type="checkbox"
                    className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer shrink-0"
                    checked={selectedLibraryIds.has(row.id)}
                    onChange={() => toggleSelectLibrary(row.id)}
                  />
                ) : (
                  <span className="w-4 h-4 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-on-surface truncate font-medium">{row.title}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {sourceLabel[row.source]} · {row.doc_type}
                    {row.taxonomy_title && ` · ${row.taxonomy_title}`}
                    {row.total_pages ? ` · ${row.total_pages} trang` : ""}
                  </p>
                </div>
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

    {selectedAttachedIds.size > 0 && (
      <div className="p-3 rounded-lg bg-primary-container text-on-primary-container flex flex-wrap items-center gap-2.5 shadow-sm border border-primary/20">
        <strong className="text-sm font-semibold">Đã chọn {selectedAttachedIds.size} tài liệu trong lớp</strong>
        <div className="h-4 w-px bg-on-primary-container/20 mx-1 hidden sm:block" />

        {/* Nút dấu ... menu chung */}
        <div className="relative">
          <button
            onClick={() => setBulkMenuOpen(v => !v)}
            className="bulk-menu-trigger h-7 px-2.5 rounded bg-white text-on-surface text-xs font-semibold hover:bg-white/90 shadow-sm flex items-center gap-1.5"
            title="Thao tác hàng loạt"
            aria-label="Thao tác hàng loạt"
          >
            <MoreVertical size={13} className="text-primary" />
            <span>Thao tác ({selectedAttachedIds.size}) ▾</span>
          </button>
          {bulkMenuOpen && (
            <div className="bulk-menu absolute left-0 top-full mt-1.5 w-56 bg-white rounded-xl shadow-2xl border border-outline-variant py-1.5 z-30 text-left" role="menu">
              <div className="px-3 py-1.5 border-b border-outline-variant/60 text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center justify-between">
                <span>Thao tác {selectedAttachedIds.size} tài liệu</span>
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold">CHUNG</span>
              </div>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant text-on-surface flex items-center gap-2"
                role="menuitem"
                disabled={bulkUpdateRequirementMutation.isPending}
                onClick={() => {
                  setBulkMenuOpen(false);
                  bulkUpdateRequirementMutation.mutate({ ids: [...selectedAttachedIds], requirement: "BAT_BUOC" });
                }}
              >
                <span>📌 Đổi sang Bắt buộc</span>
              </button>
              <button
                className="w-full text-left px-3 py-2 text-sm hover:bg-surface-variant text-on-surface flex items-center gap-2"
                role="menuitem"
                disabled={bulkUpdateRequirementMutation.isPending}
                onClick={() => {
                  setBulkMenuOpen(false);
                  bulkUpdateRequirementMutation.mutate({ ids: [...selectedAttachedIds], requirement: "TU_CHON" });
                }}
              >
                <span>💡 Đổi sang Tự chọn</span>
              </button>
              <hr className="my-1 border-outline-variant" />
              <button
                className="w-full text-left px-3 py-2 text-sm text-error hover:bg-error/10 flex items-center gap-2"
                role="menuitem"
                disabled={bulkDetachMutation.isPending}
                onClick={() => {
                  setBulkMenuOpen(false);
                  if (confirm(`Gỡ ${selectedAttachedIds.size} tài liệu đã chọn khỏi lớp?`)) {
                    bulkDetachMutation.mutate([...selectedAttachedIds]);
                  }
                }}
              >
                <span>🗑️ Gỡ khỏi lớp ({selectedAttachedIds.size})</span>
              </button>
              <hr className="my-1 border-outline-variant" />
              <button
                className="w-full text-left px-3 py-1.5 text-xs text-on-surface-variant hover:bg-surface-variant"
                role="menuitem"
                onClick={() => { setBulkMenuOpen(false); setSelectedAttachedIds(new Set()); }}
              >
                Bỏ chọn tất cả
              </button>
            </div>
          )}
        </div>

        <button
          disabled={bulkUpdateRequirementMutation.isPending}
          onClick={() => bulkUpdateRequirementMutation.mutate({ ids: [...selectedAttachedIds], requirement: "BAT_BUOC" })}
          className="h-7 px-2.5 rounded bg-white text-on-surface text-xs font-semibold hover:bg-white/90 shadow-sm"
        >
          Đổi sang Bắt buộc
        </button>
        <button
          disabled={bulkUpdateRequirementMutation.isPending}
          onClick={() => bulkUpdateRequirementMutation.mutate({ ids: [...selectedAttachedIds], requirement: "TU_CHON" })}
          className="h-7 px-2.5 rounded bg-white text-on-surface text-xs font-semibold hover:bg-white/90 shadow-sm"
        >
          Đổi sang Tự chọn
        </button>
        <button
          disabled={bulkDetachMutation.isPending}
          onClick={() => {
            if (confirm(`Gỡ ${selectedAttachedIds.size} tài liệu đã chọn khỏi lớp?`)) {
              bulkDetachMutation.mutate([...selectedAttachedIds]);
            }
          }}
          className="h-7 px-2.5 rounded bg-white text-error border border-error/30 text-xs font-semibold hover:bg-error-container shadow-sm"
        >
          {bulkDetachMutation.isPending ? "Đang gỡ…" : "Gỡ khỏi lớp"}
        </button>
        <button
          onClick={() => setSelectedAttachedIds(new Set())}
          className="h-7 px-2 text-xs hover:underline ml-auto"
        >
          Bỏ chọn
        </button>
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
            <div key={row.id} className={`flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors ${selectedAttachedIds.has(row.id) ? "bg-primary/5" : ""}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <input
                  type="checkbox"
                  className="rounded border-outline-variant text-primary focus:ring-primary w-4 h-4 cursor-pointer shrink-0"
                  checked={selectedAttachedIds.has(row.id)}
                  onChange={() => toggleSelectAttached(row.id)}
                />
                <div className="min-w-0">
                  <p className="text-sm text-on-surface truncate font-medium">{row.title}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">
                    {sourceLabel[row.source]}
                    {row.owner_name && ` · ${row.owner_name}`}
                    {row.taxonomy_title && ` · ${row.taxonomy_title}`}
                    {row.attached_by_name && ` · gắn bởi ${row.attached_by_name}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => openPdf(row)} className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors">Mở</button>
                <button onClick={() => updateMutation.mutate({ id: row.id, requirement: key === "BAT_BUOC" ? "TU_CHON" : "BAT_BUOC" })}
                  className="px-2.5 py-1 text-xs font-semibold text-on-surface-variant hover:bg-surface-variant rounded transition-colors">
                  {key === "BAT_BUOC" ? "Đổi sang Tự chọn" : "Đổi sang Bắt buộc"}
                </button>
                <button onClick={() => detachMutation.mutate(row.id)} className="px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors">Bỏ</button>

                <div className="relative">
                  <button
                    className="doc-menu-trigger w-7 h-7 inline-flex items-center justify-center rounded hover:bg-surface-variant text-on-surface-variant"
                    title={`Thao tác với ${row.title}`}
                    aria-label={`Thao tác với ${row.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDocMenu(current => current === row.id ? null : row.id);
                    }}
                  >
                    <MoreVertical size={14} />
                  </button>
                  {openDocMenu === row.id && (
                    <div className="doc-menu absolute right-0 top-full mt-1 w-52 bg-white rounded-lg shadow-xl border border-outline-variant py-1 z-30 text-left" role="menu">
                      {selectedAttachedIds.size > 0 && selectedAttachedIds.has(row.id) ? (
                        <>
                          <div className="px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-xs font-bold text-primary flex items-center justify-between">
                            <span>Thao tác {selectedAttachedIds.size} tài liệu</span>
                            <span className="text-[10px] bg-primary text-white px-1.5 py-0.2 rounded font-semibold">ĐÃ CHỌN</span>
                          </div>
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-variant text-on-surface"
                            role="menuitem"
                            disabled={bulkUpdateRequirementMutation.isPending}
                            onClick={() => {
                              setOpenDocMenu(null);
                              bulkUpdateRequirementMutation.mutate({ ids: [...selectedAttachedIds], requirement: "BAT_BUOC" });
                            }}
                          >
                            📌 Đổi sang Bắt buộc ({selectedAttachedIds.size})
                          </button>
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-variant text-on-surface"
                            role="menuitem"
                            disabled={bulkUpdateRequirementMutation.isPending}
                            onClick={() => {
                              setOpenDocMenu(null);
                              bulkUpdateRequirementMutation.mutate({ ids: [...selectedAttachedIds], requirement: "TU_CHON" });
                            }}
                          >
                            💡 Đổi sang Tự chọn ({selectedAttachedIds.size})
                          </button>
                          <hr className="my-1 border-outline-variant" />
                          <button
                            className="w-full text-left px-3 py-1.5 text-xs text-error hover:bg-error/10"
                            role="menuitem"
                            disabled={bulkDetachMutation.isPending}
                            onClick={() => {
                              setOpenDocMenu(null);
                              if (confirm(`Gỡ ${selectedAttachedIds.size} tài liệu đã chọn khỏi lớp?`)) {
                                bulkDetachMutation.mutate([...selectedAttachedIds]);
                              }
                            }}
                          >
                            🗑️ Gỡ khỏi lớp ({selectedAttachedIds.size})
                          </button>
                          <hr className="my-1 border-outline-variant" />
                          <button
                            className="w-full text-left px-3 py-1 text-xs text-on-surface-variant hover:bg-surface-variant"
                            role="menuitem"
                            onClick={() => { setOpenDocMenu(null); toggleSelectAttached(row.id); }}
                          >
                            Bỏ chọn tài liệu này
                          </button>
                        </>
                      ) : (
                        <>
                          {selectedAttachedIds.size > 0 && (
                            <div className="p-1 border-b border-outline-variant/60 bg-primary/5">
                              <button
                                className="w-full text-left px-2 py-1 text-xs font-semibold text-primary hover:bg-primary/10 rounded flex items-center justify-between"
                                onClick={() => toggleSelectAttached(row.id)}
                              >
                                <span>+ Thêm vào nhóm đã chọn</span>
                                <span className="text-[10px] bg-primary/10 px-1 py-0.5 rounded font-bold">{selectedAttachedIds.size} đã chọn</span>
                              </button>
                            </div>
                          )}
                          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-variant text-primary font-medium" role="menuitem" onClick={() => { setOpenDocMenu(null); openPdf(row); }}>
                            Mở tài liệu
                          </button>
                          <button className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-variant" role="menuitem" onClick={() => { setOpenDocMenu(null); updateMutation.mutate({ id: row.id, requirement: key === "BAT_BUOC" ? "TU_CHON" : "BAT_BUOC" }); }}>
                            {key === "BAT_BUOC" ? "Đổi sang Tự chọn" : "Đổi sang Bắt buộc"}
                          </button>
                          <button className="w-full text-left px-3 py-1.5 text-xs text-error hover:bg-error/10" role="menuitem" onClick={() => { setOpenDocMenu(null); detachMutation.mutate(row.id); }}>
                            Gỡ khỏi lớp
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
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
