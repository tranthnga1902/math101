import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDocumentsByNode, getTaxonomyTreeReadOnly, openDocumentFile, type AuthSession, type TaxonomyNode } from "../api";
import { MarkdownContent } from "../components/MarkdownViewer";
import { PdfViewer, isPdfDocument } from "../components/PdfViewer";
import "../components/markdown-viewer.css";

const ROOT = 0;
const depthLabel: Record<number, string> = { 1: "Chuyên đề", 2: "Bài", 3: "Dạng" };

/**
 * Nội dung học do Admin biên soạn, hiển thị chỉ để đọc cho giáo viên.
 * Không có thao tác thêm/sửa/xóa nào ở đây — mọi thay đổi cây phân loại đều nằm ở khu vực Admin.
 */
export function TaxonomyBrowser({ session }: { session: AuthSession }) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [activeDocId, setActiveDocId] = useState<number | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);

  const treeQuery = useQuery({ queryKey: ["teacher-taxonomy-tree", session.accessToken], queryFn: () => getTaxonomyTreeReadOnly(session) });
  const nodes = treeQuery.data ?? [];
  const childrenByParent = useMemo(() => {
    const map = new Map<number, TaxonomyNode[]>();
    for (const node of nodes) {
      const key = node.parentId ?? ROOT;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(node);
    }
    for (const list of map.values()) list.sort((a, b) => a.orderNo - b.orderNo);
    return map;
  }, [nodes]);
  const selected = selectedId != null ? nodes.find((n) => n.id === selectedId) ?? null : null;

  const docsQuery = useQuery({
    queryKey: ["teacher-taxonomy-docs", selectedId, session.accessToken],
    queryFn: () => getDocumentsByNode(session, selectedId as number),
    enabled: selectedId != null,
  });
  const docs = docsQuery.data ?? [];
  const activeDoc = docs.find((d) => d.id === activeDocId) ?? docs[0] ?? null;

  const roots = childrenByParent.get(ROOT) ?? [];

  return <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-4 items-start">
    <aside className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant">
        <h2 className="text-sm font-bold text-on-surface">Cây phân loại — Toán 10</h2>
        <p className="text-[11px] text-on-surface-variant">Do Admin biên soạn · chỉ xem</p>
      </div>
      <div className="max-h-[60vh] overflow-auto py-1">
        {treeQuery.isLoading && <p className="px-4 py-3 text-sm text-on-surface-variant">Đang tải…</p>}
        {!treeQuery.isLoading && roots.length === 0 && <p className="px-4 py-3 text-sm text-on-surface-variant">Admin chưa biên soạn nội dung nào.</p>}
        {roots.map((node) => <TreeRow key={node.id} node={node} level={0} childrenByParent={childrenByParent}
          expanded={expanded} selectedId={selectedId}
          onToggle={(id) => setExpanded((x) => x.includes(id) ? x.filter((v) => v !== id) : [...x, id])}
          onSelect={(id) => { setSelectedId(id); setActiveDocId(null); }} />)}
      </div>
    </aside>

    <section className="border border-outline-variant rounded-lg bg-surface-container-lowest min-w-0">
      {!selected && <p className="p-8 text-center text-sm text-on-surface-variant">Chọn một mục bên trái để đọc nội dung.</p>}
      {selected && <div className="flex flex-col">
        <header className="px-4 py-3 border-b border-outline-variant flex items-center gap-2 flex-wrap">
          <span className="px-2 py-0.5 rounded bg-primary-container/30 text-primary text-[11px] font-semibold">{depthLabel[selected.depth]}</span>
          <h2 className="text-base font-bold text-on-surface">{selected.title}</h2>
        </header>
        {selected.description && <p className="px-4 pt-3 text-sm text-on-surface-variant">{selected.description}</p>}

        <div className="px-4 py-3 flex items-center gap-2 flex-wrap border-b border-outline-variant">
          {docsQuery.isLoading && <span className="text-sm text-on-surface-variant">Đang tải tài liệu…</span>}
          {!docsQuery.isLoading && docs.length === 0 && <span className="text-sm text-on-surface-variant">Mục này chưa có tài liệu.</span>}
          {docs.map((doc) => <button key={doc.id} onClick={() => setActiveDocId(doc.id)}
            className={`h-8 px-3 rounded-lg border text-xs font-semibold transition-colors ${activeDoc?.id === doc.id ? "border-primary text-primary bg-primary-container/20" : "border-outline-variant text-on-surface-variant hover:text-on-surface"}`}>
            {doc.title}
          </button>)}
        </div>

        {activeDoc && <div className="p-4 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h3 className="text-sm font-bold text-on-surface">{activeDoc.title}</h3>
            <button onClick={() => isPdfDocument(activeDoc) ? setPdfOpen(true) : void openDocumentFile(session, activeDoc.fileUrl, activeDoc.title)}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface">Xem file PDF gốc</button>
          </div>
          {activeDoc.contentMarkdown
            ? <MarkdownContent markdown={activeDoc.contentMarkdown} />
            : <p className="text-sm text-on-surface-variant">Tài liệu này chưa được chuyển sang Markdown. Bấm "Xem file PDF gốc" để đọc bản gốc.</p>}
        </div>}
      </div>}
    </section>
    {pdfOpen && activeDoc && <PdfViewer session={session} documentId={activeDoc.id} title={activeDoc.title} fileUrl={activeDoc.fileUrl} onClose={() => setPdfOpen(false)} />}
  </div>;
}

function TreeRow({ node, level, childrenByParent, expanded, selectedId, onToggle, onSelect }: {
  node: TaxonomyNode; level: number; childrenByParent: Map<number, TaxonomyNode[]>;
  expanded: number[]; selectedId: number | null; onToggle: (id: number) => void; onSelect: (id: number) => void;
}) {
  const children = childrenByParent.get(node.id) ?? [];
  const isOpen = expanded.includes(node.id);
  return <div>
    <div className={`flex items-center gap-1 pr-2 ${selectedId === node.id ? "bg-primary-container/20" : "hover:bg-surface-container-low"}`} style={{ paddingLeft: 8 + level * 14 }}>
      <button onClick={() => onToggle(node.id)} disabled={children.length === 0} aria-label={isOpen ? "Thu gọn" : "Mở rộng"}
        className="w-6 h-8 shrink-0 grid place-items-center text-on-surface-variant disabled:opacity-0">
        <span className="material-symbols-outlined text-[18px]">{isOpen ? "expand_more" : "chevron_right"}</span>
      </button>
      <button onClick={() => onSelect(node.id)} className="flex-1 min-w-0 flex items-center gap-2 py-1.5 text-left">
        <span className="text-sm text-on-surface truncate">{node.title}</span>
        {node.documentCount > 0 && <span className="shrink-0 text-[11px] text-on-surface-variant">{node.documentCount}</span>}
      </button>
    </div>
    {isOpen && children.map((child) => <TreeRow key={child.id} node={child} level={level + 1} childrenByParent={childrenByParent}
      expanded={expanded} selectedId={selectedId} onToggle={onToggle} onSelect={onSelect} />)}
  </div>;
}
