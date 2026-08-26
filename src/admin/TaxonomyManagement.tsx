import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, ListTree, MoreVertical, Plus, X } from "lucide-react";
import {
  addTaxonomyAlias, archiveTaxonomyBranch, archiveTaxonomyNode, convertDocumentToMarkdown,
  createTaxonomyNode, deleteTaxonomyNode, getDocumentsByNode, getTaxonomyDuplicates,
  getTaxonomyHistory, getTaxonomyTree, getUsers, mergeTaxonomyNodes, moveTaxonomyNode,
  openDocumentFile, removeTaxonomyAlias, reorderTaxonomyNodes, setDocumentTaxonomyNode,
  unarchiveTaxonomyNode, updateTaxonomyNode, uploadDocument,
  type AuthSession, type DocumentItem, type TaxonomyDuplicateSuggestion, type TaxonomyNode,
} from "../api";
import { MarkdownContent } from "../components/MarkdownViewer";
import { PdfViewer, isPdfDocument as isPdfDoc } from "../components/PdfViewer";
import "./taxonomy-management.css";

const ROOT = 0;
const message = (x: unknown) => x instanceof Error ? x.message : "Không thể thực hiện thao tác";
const depthLabel: Record<number, string> = { 1: "Chuyên đề", 2: "Bài", 3: "Dạng" };
const childLabel: Record<number, string> = { 1: "bài", 2: "dạng" };
const statusLabel: Record<string, string> = { ACTIVE: "Hoạt động", PENDING: "Chờ duyệt", ARCHIVED: "Đã lưu trữ", MERGED: "Đã gộp" };
const resourceCount = (n: TaxonomyNode) => n.questionCountShared + n.questionCountPrivate + n.documentCount + n.worksheetCount;

const TREE_KEY = "taxonomy-tree";
const DUPLICATES_KEY = "taxonomy-duplicates";

/** Vị trí menu ⋮ đang mở — dùng toạ độ màn hình (position:fixed) để menu không bị cắt bởi vùng cuộn của cây. */
type RowMenuState = { node: TaxonomyNode; x: number; y: number };

export function TaxonomyManagement({ session }: { session: AuthSession }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [tab, setTab] = useState<"info" | "content" | "history">("info");
  const [queueOpen, setQueueOpen] = useState(true);
  const [treeOpen, setTreeOpen] = useState(false);
  const [rowMenu, setRowMenu] = useState<RowMenuState | null>(null);
  const [formModal, setFormModal] = useState<{ mode: "create" | "edit"; parentId: number | null; node?: TaxonomyNode } | null>(null);
  const [mergeSource, setMergeSource] = useState<TaxonomyNode | null>(null);
  const [moveSource, setMoveSource] = useState<TaxonomyNode | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const treeQuery = useQuery({ queryKey: [TREE_KEY, session.accessToken], queryFn: () => getTaxonomyTree(session) });
  const duplicatesQuery = useQuery({ queryKey: [DUPLICATES_KEY, session.accessToken], queryFn: () => getTaxonomyDuplicates(session) });
  const usersQuery = useQuery({ queryKey: ["taxonomy-users", session.accessToken], queryFn: () => getUsers(session) });
  const historyQuery = useQuery({
    queryKey: ["taxonomy-history", selectedId, session.accessToken],
    queryFn: () => getTaxonomyHistory(session, selectedId as number),
    enabled: tab === "history" && selectedId != null,
  });

  const nodes = treeQuery.data ?? [];
  const duplicates = duplicatesQuery.data ?? [];
  const users = usersQuery.data ?? [];
  const userMap = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);
  const nodesById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const childrenByParent = useMemo(() => {
    const map = new Map<number, TaxonomyNode[]>();
    for (const n of nodes) {
      const key = n.parentId ?? ROOT;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    for (const list of map.values()) list.sort((a, b) => a.orderNo - b.orderNo);
    return map;
  }, [nodes]);
  const selected = selectedId != null ? nodesById.get(selectedId) ?? null : null;

  const invalidateTree = () => queryClient.invalidateQueries({ queryKey: [TREE_KEY] });
  const invalidateDuplicates = () => queryClient.invalidateQueries({ queryKey: [DUPLICATES_KEY] });
  const run = async (fn: () => Promise<void>) => { setError(""); setNotice(""); try { await fn(); } catch (reason) { setError(message(reason)); } };

  const toggleExpand = (id: number) => setExpanded((x) => x.includes(id) ? x.filter((v) => v !== id) : [...x, id]);

  // Menu ⋮ đóng khi bấm ra ngoài, khi cuộn (vì menu neo theo toạ độ màn hình) hoặc khi bấm Esc.
  useEffect(() => {
    if (!rowMenu) return;
    const close = (event: Event) => {
      // Bỏ qua chính nút ⋮ để cú bấm thứ hai đóng menu (toggle) thay vì đóng rồi mở lại ngay.
      if (event.target instanceof Element && event.target.closest(".taxonomy-row-menu,.taxonomy-row-menu-trigger")) return;
      setRowMenu(null);
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setRowMenu(null); };
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", close, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [rowMenu]);

  const reorderMutation = useMutation({ mutationFn: (input: { parentId: number | null; ids: number[] }) => reorderTaxonomyNodes(session, input.ids, input.parentId ?? undefined), onSuccess: invalidateTree });
  const moveNode = (node: TaxonomyNode, delta: number) => run(async () => {
    const siblings = childrenByParent.get(node.parentId ?? ROOT) ?? [];
    const index = siblings.findIndex((s) => s.id === node.id);
    const target = index + delta;
    if (target < 0 || target >= siblings.length) return;
    const copy = [...siblings];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    await reorderMutation.mutateAsync({ parentId: node.parentId, ids: copy.map((n) => n.id) });
  });

  const archiveMutation = useMutation({ mutationFn: (id: number) => archiveTaxonomyNode(session, id), onSuccess: () => invalidateTree() });
  const archiveBranchMutation = useMutation({ mutationFn: (id: number) => archiveTaxonomyBranch(session, id), onSuccess: () => invalidateTree() });
  const unarchiveMutation = useMutation({ mutationFn: (id: number) => unarchiveTaxonomyNode(session, id), onSuccess: invalidateTree });

  const doArchive = (node: TaxonomyNode) => run(async () => {
    if (!window.confirm(`Ẩn "${node.title}" khỏi học sinh? Mục có thể được khôi phục sau.`)) return;
    const result = await archiveMutation.mutateAsync(node.id);
    setNotice(`Đã lưu trữ "${node.title}". ${result.openAssignmentsAffected} nhiệm vụ đang mở vẫn tiếp tục chạy, ${result.questionsKept} câu hỏi vẫn được giữ.`);
  });
  const doArchiveBranch = (node: TaxonomyNode) => run(async () => {
    if (!window.confirm(`Lưu trữ cả nhánh "${node.title}" và toàn bộ mục con? Hành động này có thể khôi phục sau.`)) return;
    const result = await archiveBranchMutation.mutateAsync(node.id);
    setNotice(`Đã lưu trữ ${result.nodesArchivedCount} mục trong nhánh "${node.title}". ${result.openAssignmentsAffected} nhiệm vụ đang mở vẫn tiếp tục chạy, ${result.questionsKept} câu hỏi vẫn được giữ.`);
  });
  const doUnarchive = (node: TaxonomyNode) => run(async () => { await unarchiveMutation.mutateAsync(node.id); setNotice(`Đã khôi phục "${node.title}".`); });

  const aliasAddMutation = useMutation({ mutationFn: (input: { nodeId: number; alias: string }) => addTaxonomyAlias(session, input.nodeId, input.alias), onSuccess: invalidateTree });
  const aliasRemoveMutation = useMutation({ mutationFn: (input: { nodeId: number; aliasId: number }) => removeTaxonomyAlias(session, input.nodeId, input.aliasId), onSuccess: invalidateTree });

  const mergeMutation = useMutation({ mutationFn: (input: { sourceId: number; targetId: number }) => mergeTaxonomyNodes(session, input.sourceId, input.targetId), onSuccess: () => { invalidateTree(); invalidateDuplicates(); } });
  const moveMutation = useMutation({ mutationFn: (input: { id: number; newParentId: number | null }) => moveTaxonomyNode(session, input.id, input.newParentId), onSuccess: invalidateTree });
  const deleteMutation = useMutation({ mutationFn: (id: number) => deleteTaxonomyNode(session, id), onSuccess: () => { invalidateTree(); invalidateDuplicates(); } });

  const doMerge = (sourceId: number, targetId: number, sourceTitle: string, targetTitle: string) => run(async () => {
    if (!window.confirm(`Gộp "${sourceTitle}" vào "${targetTitle}"? "${sourceTitle}" sẽ trở thành tên gọi khác của "${targetTitle}".`)) return;
    await mergeMutation.mutateAsync({ sourceId, targetId });
    setNotice(`Đã gộp "${sourceTitle}" vào "${targetTitle}".`);
    setMergeSource(null);
  });
  const doMove = (node: TaxonomyNode, newParentId: number | null, targetTitle: string) => run(async () => {
    await moveMutation.mutateAsync({ id: node.id, newParentId });
    setNotice(`Đã chuyển "${node.title}" vào ${targetTitle}.`);
    setMoveSource(null);
  });
  const doDelete = (node: TaxonomyNode) => run(async () => {
    if (!window.confirm(`Xóa hẳn "${node.title}"? Khác với "Ẩn / Lưu trữ", mục này sẽ biến mất khỏi cây. Chỉ nên xóa mục tạo nhầm.`)) return;
    await deleteMutation.mutateAsync(node.id);
    if (selectedId === node.id) setSelectedId(null);
    setNotice(`Đã xóa "${node.title}".`);
  });

  const openCreate = (parentId: number | null) => setFormModal({ mode: "create", parentId });
  const openEdit = (node: TaxonomyNode) => setFormModal({ mode: "edit", parentId: node.parentId, node });

  const roots = childrenByParent.get(ROOT) ?? [];
  const duplicateCount = duplicates.length;
  /** Số cấp của nhánh tính từ chính mục này (mục không có con = 1) — dùng để biết mục nào nhận được nhánh này. */
  const subtreeHeight = (id: number): number => Math.max(0, ...(childrenByParent.get(id) ?? []).map((c) => subtreeHeight(c.id))) + 1;
  const pathOf = (node: TaxonomyNode) => nodePath(node, nodesById);

  return <section className="taxonomy-page">
    {treeOpen && <div className="taxonomy-drawer-backdrop" onClick={() => setTreeOpen(false)} />}
    <aside className={treeOpen ? "open" : ""}>
      <header>
        <h2>Cây phân loại — Toán 10</h2>
        <div className="taxonomy-tree-head-actions">
          <button className="taxonomy-add-root" onClick={() => openCreate(null)} title="Thêm chuyên đề" aria-label="Thêm chuyên đề"><Plus size={18} /></button>
          <button className="taxonomy-drawer-close" onClick={() => setTreeOpen(false)} aria-label="Đóng cây phân loại"><X size={18} /></button>
        </div>
      </header>
      <div className="taxonomy-tree">
        {treeQuery.isLoading && <div className="taxonomy-empty">Đang tải…</div>}
        {!treeQuery.isLoading && roots.length === 0 && <div className="taxonomy-empty">Chưa có chuyên đề nào. Bấm dấu + ở trên để thêm.</div>}
        {roots.map((node) => <TaxonomyTreeRow key={node.id} node={node} depth={0} childrenByParent={childrenByParent}
          expanded={expanded} onToggle={toggleExpand} selectedId={selectedId}
          onSelect={(id) => { setSelectedId(id); setTab("info"); setTreeOpen(false); }}
          onMenu={(n, x, y) => setRowMenu((current) => current?.node.id === n.id ? null : { node: n, x, y })} />)}
      </div>
    </aside>
    <main>
      <button className="taxonomy-drawer-open" onClick={() => setTreeOpen(true)}><ListTree size={16} /> Cây phân loại</button>
      {(error || notice) && <div className={error ? "api-error" : "taxonomy-notice"}>{error || notice}</div>}
      {!selected && <div className="taxonomy-placeholder">Chọn một mục trong cây bên trái để xem chi tiết.</div>}
      {selected && <>
        <header className="taxonomy-detail-header">
          <div><span className="taxonomy-depth-tag">{depthLabel[selected.depth]}</span><h1>{selected.title}</h1><span className={`taxonomy-status status-${selected.status.toLowerCase()}`}>{statusLabel[selected.status]}</span></div>
          <div className="taxonomy-tabs">
            <button className={tab === "info" ? "active" : ""} onClick={() => setTab("info")}>Thông tin</button>
            <button className={tab === "content" ? "active" : ""} onClick={() => setTab("content")}>Nội dung học</button>
            <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}>Lịch sử</button>
          </div>
        </header>
        {tab === "info" && <InfoTab node={selected} onEdit={() => openEdit(selected)}
          onArchive={() => doArchive(selected)} onArchiveBranch={() => doArchiveBranch(selected)} onUnarchive={() => doUnarchive(selected)}
          onMove={() => setMoveSource(selected)} onMerge={() => setMergeSource(selected)} onDelete={() => doDelete(selected)}
          hasChildren={(childrenByParent.get(selected.id) ?? []).length > 0}
          onAddAlias={(alias) => run(async () => { await aliasAddMutation.mutateAsync({ nodeId: selected.id, alias }); })}
          onRemoveAlias={(aliasId) => run(async () => { await aliasRemoveMutation.mutateAsync({ nodeId: selected.id, aliasId }); })} />}
        {tab === "content" && <ContentTab session={session} node={selected} onSaved={invalidateTree} />}
        {tab === "history" && <HistoryTab logs={historyQuery.data ?? []} loading={historyQuery.isLoading} userMap={userMap} />}
      </>}
    </main>
    <div className={`taxonomy-queue ${queueOpen ? "open" : ""}`}>
      <button className="taxonomy-queue-toggle" onClick={() => setQueueOpen((x) => !x)}>
        Nghi trùng lặp ({duplicateCount}) {queueOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {queueOpen && <div className="taxonomy-queue-body">
        <section>
          <h3>Nghi trùng lặp ({duplicateCount})</h3>
          {duplicateCount === 0 && <p className="taxonomy-empty">Không phát hiện mục nào nghi trùng lặp.</p>}
          <div className="taxonomy-queue-cards">{duplicates.map((d: TaxonomyDuplicateSuggestion, i) =>
            <article key={i} className="taxonomy-queue-card">
              <b>{d.nodeATitle}</b> ↔ <b>{d.nodeBTitle}</b><small>Độ giống nhau: {(d.similarity * 100).toFixed(0)}%</small>
              <div className="taxonomy-queue-actions">
                <button onClick={() => doMerge(d.nodeBId, d.nodeAId, d.nodeBTitle, d.nodeATitle)}>Gộp "{d.nodeBTitle}" vào "{d.nodeATitle}"</button>
                <button onClick={() => doMerge(d.nodeAId, d.nodeBId, d.nodeATitle, d.nodeBTitle)}>Gộp "{d.nodeATitle}" vào "{d.nodeBTitle}"</button>
              </div>
            </article>)}</div>
        </section>
      </div>}
    </div>
    {rowMenu && (() => {
      const node = rowMenu.node;
      const siblings = childrenByParent.get(node.parentId ?? ROOT) ?? [];
      const index = siblings.findIndex((s) => s.id === node.id);
      const hasChildren = (childrenByParent.get(node.id) ?? []).length > 0;
      const pick = (fn: () => void) => { setRowMenu(null); fn(); };
      const docCount = node.documentCount;
      const deleteBlocked = hasChildren ? "Còn mục con — hãy xóa hoặc chuyển mục con đi trước"
        : docCount > 0 ? `Còn ${docCount} tài liệu — hãy gỡ ở tab "Nội dung học" trước` : "";
      return <div className="taxonomy-row-menu" role="menu" style={{ top: rowMenu.y, left: rowMenu.x }}>
        {node.depth < 3 && <button role="menuitem" onClick={() => pick(() => openCreate(node.id))}>+ Thêm {childLabel[node.depth]}</button>}
        <button role="menuitem" onClick={() => pick(() => openEdit(node))}>Sửa thông tin</button>
        <button role="menuitem" disabled={index <= 0} onClick={() => pick(() => moveNode(node, -1))}>Di chuyển lên</button>
        <button role="menuitem" disabled={index === siblings.length - 1} onClick={() => pick(() => moveNode(node, 1))}>Di chuyển xuống</button>
        <hr />
        <button role="menuitem" onClick={() => pick(() => setMoveSource(node))}>Chuyển sang mục khác…</button>
        <button role="menuitem" onClick={() => pick(() => setMergeSource(node))}>Gộp vào mục khác…</button>
        <hr />
        {hasChildren && node.status !== "ARCHIVED" && <button role="menuitem" className="danger" onClick={() => pick(() => doArchiveBranch(node))}>Lưu trữ cả nhánh</button>}
        {node.status === "ARCHIVED"
          ? <button role="menuitem" onClick={() => pick(() => doUnarchive(node))}>Khôi phục</button>
          : <button role="menuitem" className="danger" onClick={() => pick(() => doArchive(node))}>Ẩn / Lưu trữ</button>}
        <button role="menuitem" className="danger" disabled={deleteBlocked !== ""} title={deleteBlocked || "Xóa hẳn mục này khỏi cây"}
          onClick={() => pick(() => doDelete(node))}>Xóa</button>
      </div>;
    })()}
    {formModal && <TaxonomyFormModal session={session} state={formModal} onClose={() => setFormModal(null)}
      onDone={async () => { setFormModal(null); await invalidateTree(); }} />}
    {mergeSource && <MergeNodeModal source={mergeSource}
      candidates={nodes.filter((n) => n.id !== mergeSource.id && n.depth === mergeSource.depth && n.status === "ACTIVE")}
      pathOf={pathOf} onClose={() => setMergeSource(null)}
      onMerge={(targetId, targetTitle) => doMerge(mergeSource.id, targetId, mergeSource.title, targetTitle)} />}
    {moveSource && <MoveNodeModal source={moveSource} height={subtreeHeight(moveSource.id)}
      candidates={nodes.filter((n) => n.status === "ACTIVE" && !isSelfOrDescendant(n, moveSource.id, nodesById))}
      pathOf={pathOf} onClose={() => setMoveSource(null)}
      onMove={(newParentId, targetTitle) => doMove(moveSource, newParentId, targetTitle)} />}
  </section>;
}

/** Đường dẫn đầy đủ của một mục ("Chuyên đề › Bài › Dạng") để chọn đúng mục trong danh sách phẳng. */
function nodePath(node: TaxonomyNode, nodesById: Map<number, TaxonomyNode>) {
  const parts = [node.title];
  let cursor = node.parentId != null ? nodesById.get(node.parentId) : undefined;
  for (let guard = 0; cursor && guard < 5; guard++) {
    parts.unshift(cursor.title);
    cursor = cursor.parentId != null ? nodesById.get(cursor.parentId) : undefined;
  }
  return parts.join(" › ");
}

function isSelfOrDescendant(candidate: TaxonomyNode, ancestorId: number, nodesById: Map<number, TaxonomyNode>) {
  let cursor: TaxonomyNode | undefined = candidate;
  for (let guard = 0; cursor && guard < 5; guard++) {
    if (cursor.id === ancestorId) return true;
    cursor = cursor.parentId != null ? nodesById.get(cursor.parentId) : undefined;
  }
  return false;
}

const MENU_WIDTH = 208;
const MENU_HEIGHT = 340;

function TaxonomyTreeRow({ node, depth, childrenByParent, expanded, onToggle, selectedId, onSelect, onMenu }: {
  node: TaxonomyNode; depth: number; childrenByParent: Map<number, TaxonomyNode[]>;
  expanded: number[]; onToggle: (id: number) => void; selectedId: number | null; onSelect: (id: number) => void;
  onMenu: (node: TaxonomyNode, x: number, y: number) => void;
}) {
  const children = childrenByParent.get(node.id) ?? [];
  const isOpen = expanded.includes(node.id);
  const empty = resourceCount(node) === 0;
  const isArchived = node.status === "ARCHIVED";
  return <div className="taxonomy-row-group">
    <div className={`taxonomy-row ${selectedId === node.id ? "selected" : ""} ${isArchived ? "archived" : ""}`} style={{ paddingLeft: 8 + depth * 16 }}>
      <button className="taxonomy-toggle" onClick={() => onToggle(node.id)} disabled={children.length === 0}>
        {children.length > 0 ? (isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="taxonomy-toggle-spacer" />}
      </button>
      <button className="taxonomy-row-main" onClick={() => onSelect(node.id)}>
        {empty && <span className="taxonomy-dot" title="Chưa có nội dung" />}
        <span className="taxonomy-row-title">{node.title}</span>
        <span className="taxonomy-row-count">{resourceCount(node)}</span>
      </button>
      <div className="taxonomy-row-actions">
        <button className="taxonomy-row-menu-trigger" aria-haspopup="menu" title={`Thao tác với "${node.title}"`}
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            // Neo theo toạ độ màn hình rồi kẹp lại trong khung nhìn — menu không bị cắt ở mép phải/dưới.
            onMenu(node, Math.max(8, Math.min(rect.left, window.innerWidth - MENU_WIDTH - 8)), Math.max(8, Math.min(rect.bottom + 4, window.innerHeight - MENU_HEIGHT)));
          }}>
          <MoreVertical size={17} />
        </button>
      </div>
    </div>
    {isOpen && children.map((child) => <TaxonomyTreeRow key={child.id} node={child} depth={depth + 1} childrenByParent={childrenByParent}
      expanded={expanded} onToggle={onToggle} selectedId={selectedId} onSelect={onSelect} onMenu={onMenu} />)}
  </div>;
}

function InfoTab({ node, onEdit, onArchive, onArchiveBranch, onUnarchive, onMove, onMerge, onDelete, hasChildren, onAddAlias, onRemoveAlias }: {
  node: TaxonomyNode; onEdit: () => void; onArchive: () => void; onArchiveBranch: () => void; onUnarchive: () => void;
  onMove: () => void; onMerge: () => void; onDelete: () => void;
  hasChildren: boolean; onAddAlias: (alias: string) => void; onRemoveAlias: (aliasId: number) => void;
}) {
  const [aliasInput, setAliasInput] = useState("");
  const deleteBlocked = hasChildren ? "Còn mục con — hãy xóa hoặc chuyển mục con đi trước"
    : node.documentCount > 0 ? `Còn ${node.documentCount} tài liệu — hãy gỡ ở tab "Nội dung học" trước` : "";
  return <div className="taxonomy-info-tab">
    <dl>
      <div><dt>Tên</dt><dd>{node.title}</dd></div>
      <div><dt>Mã</dt><dd className="mono">{node.slug}</dd></div>
      <div><dt>Mô tả</dt><dd>{node.description || "—"}</dd></div>
      <div><dt>Thứ tự</dt><dd>{node.orderNo}</dd></div>
    </dl>
    <div className="taxonomy-actions-row">
      <button onClick={onEdit}>Sửa thông tin</button>
      <button onClick={onMove}>Chuyển sang mục khác…</button>
      <button onClick={onMerge}>Gộp vào mục khác…</button>
      {node.status === "ARCHIVED"
        ? <button onClick={onUnarchive}>Khôi phục</button>
        : <button className="danger" onClick={onArchive}>Ẩn / Lưu trữ</button>}
      {hasChildren && node.status !== "ARCHIVED" && <button className="danger" onClick={onArchiveBranch}>Lưu trữ cả nhánh</button>}
      <button className="danger" disabled={deleteBlocked !== ""} title={deleteBlocked || "Xóa hẳn mục này khỏi cây"} onClick={onDelete}>Xóa</button>
    </div>
    <p className="taxonomy-hint">"Ẩn / Lưu trữ" chỉ giấu mục khỏi giáo viên và học sinh, dữ liệu vẫn còn và khôi phục được. "Xóa" bỏ hẳn mục khỏi cây — chỉ dùng cho mục tạo nhầm.</p>
    <section className="taxonomy-alias-block">
      <h3>Tên gọi khác</h3>
      <p className="taxonomy-hint">Giúp tìm đúng mục này dù giáo viên gõ tên hơi khác — không tạo mục trùng lặp mới.</p>
      <ul className="taxonomy-alias-list">
        {node.aliases.length === 0 && <li className="taxonomy-empty">Chưa có tên gọi khác.</li>}
        {node.aliases.map((a) => <li key={a.id}>{a.alias}<button onClick={() => onRemoveAlias(a.id)} aria-label="Xóa tên gọi khác"><X size={14} /></button></li>)}
      </ul>
      <div className="taxonomy-alias-add">
        <input placeholder="Thêm tên gọi khác…" value={aliasInput} onChange={(e) => setAliasInput(e.target.value)} />
        <button onClick={() => { if (aliasInput.trim()) { onAddAlias(aliasInput.trim()); setAliasInput(""); } }}>+ Thêm</button>
      </div>
    </section>
  </div>;
}

const DOCS_KEY = "taxonomy-node-documents";

/**
 * Nội dung học của một mục: Admin đẩy PDF lên, hệ thống trích thành Markdown (PdfMarkdownService)
 * rồi hiển thị thẳng trong khung bên phải — không cần tải file về hay mở phần mềm đọc PDF.
 */
function ContentTab({ session, node, onSaved }: { session: AuthSession; node: TaxonomyNode; onSaved: () => void }) {
  const queryClient = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [pdfDoc, setPdfDoc] = useState<DocumentItem | null>(null);

  const docsQuery = useQuery({ queryKey: [DOCS_KEY, node.id, session.accessToken], queryFn: () => getDocumentsByNode(session, node.id) });
  const docs = docsQuery.data ?? [];
  const active = docs.find((d) => d.id === activeId) ?? docs[0] ?? null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: [DOCS_KEY, node.id] });
    onSaved();
  };

  const convert = (doc: DocumentItem) => void (async () => {
    setError(""); setBusyId(doc.id);
    try { await convertDocumentToMarkdown(session, doc.id); setActiveId(doc.id); await refresh(); }
    catch (reason) { setError(message(reason)); }
    finally { setBusyId(null); }
  })();

  const detach = (doc: DocumentItem) => void (async () => {
    if (!window.confirm(`Gỡ "${doc.title}" khỏi mục này? Tài liệu vẫn còn trong Kho Tài Liệu.`)) return;
    setError(""); setBusyId(doc.id);
    try { await setDocumentTaxonomyNode(session, doc.id, null); if (activeId === doc.id) setActiveId(null); await refresh(); }
    catch (reason) { setError(message(reason)); }
    finally { setBusyId(null); }
  })();

  return <div className="taxonomy-content-tab">
    {error && <div className="api-error taxonomy-content-error">{error}</div>}
    <div className="taxonomy-content-grid">
      <section className="taxonomy-doc-list">
        <h3>Tài liệu của mục ({docs.length})</h3>
        {docsQuery.isLoading && <p className="taxonomy-empty">Đang tải…</p>}
        {!docsQuery.isLoading && docs.length === 0 && <p className="taxonomy-empty">Chưa có tài liệu nào. Tải một file PDF lên bên dưới.</p>}
        <ul>{docs.map((doc) => <li key={doc.id} className={active?.id === doc.id ? "active" : ""}>
          <button className="taxonomy-doc-main" onClick={() => setActiveId(doc.id)}>
            <span className="taxonomy-doc-title">{doc.title}</span>
            {doc.contentMarkdown
              ? <span className="taxonomy-doc-badge ok">Markdown ✓</span>
              : <span className="taxonomy-doc-badge">Chưa có Markdown</span>}
          </button>
          <div className="taxonomy-doc-actions">
            {!doc.contentMarkdown && <button disabled={busyId === doc.id} onClick={() => convert(doc)}>{busyId === doc.id ? "Đang chuyển…" : "Chuyển sang Markdown"}</button>}
            <button className="danger" disabled={busyId === doc.id} onClick={() => detach(doc)}>Gỡ khỏi mục</button>
          </div>
        </li>)}</ul>
        <NodeUploadForm session={session} node={node} onDone={async (doc) => { setActiveId(doc.id); await refresh(); }} />
      </section>
      <section className="taxonomy-doc-reader">
        {!active && <p className="taxonomy-empty">Chọn một tài liệu để đọc nội dung ngay tại đây.</p>}
        {active && <>
          <header>
            <h3>{active.title}</h3>
            <button onClick={() => isPdfDoc(active) ? setPdfDoc(active) : void openDocumentFile(session, active.fileUrl, active.title)}>Xem file PDF gốc</button>
          </header>
          {active.contentMarkdown
            ? <MarkdownContent markdown={active.contentMarkdown} />
            : <p className="taxonomy-empty">Tài liệu này chưa được chuyển sang Markdown. Bấm "Chuyển sang Markdown" ở danh sách bên cạnh.</p>}
        </>}
      </section>
      {pdfDoc && <PdfViewer session={session} documentId={pdfDoc.id} title={pdfDoc.title} fileUrl={pdfDoc.fileUrl} onClose={() => setPdfDoc(null)} />}
    </div>
    <div className="taxonomy-resource-row">
      <div><b>Câu hỏi</b><small>{node.questionCountShared + node.questionCountPrivate} (kho chung {node.questionCountShared} · kho riêng {node.questionCountPrivate})</small></div>
      <div><b>Phiếu đã dùng</b><small>{node.worksheetCount}</small></div>
    </div>
    <p className="taxonomy-hint">Câu hỏi do giáo viên soạn. Admin không soạn câu hỏi ở đây.</p>
  </div>;
}

const CONTENT_DOC_TYPES: [string, string][] = [["KHBD", "Kế hoạch bài dạy"], ["SGK", "Sách giáo khoa"], ["SBT", "Sách bài tập"], ["DE_THI", "Đề thi"]];

function NodeUploadForm({ session, node, onDone }: { session: AuthSession; node: TaxonomyNode; onDone: (doc: DocumentItem) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("KHBD");
  const [audience, setAudience] = useState("STUDENT_ALLOWED");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true); setError("");
    try {
      const doc = await uploadDocument(session, { title: title.trim() || file.name.replace(/\.[^.]+$/, ""), docType, audience, taxonomyNodeId: node.id, file });
      // Chuyển Markdown ngay sau khi tải lên để Admin không phải bấm hai lần.
      // Nếu PDF là bản scan, backend trả lỗi tiếng Việt — tài liệu vẫn đã gắn vào mục.
      try { await convertDocumentToMarkdown(session, doc.id); } catch (reason) { setError(message(reason)); }
      setTitle(""); setFile(null);
      (event.target as HTMLFormElement).reset();
      await onDone(doc);
    } catch (reason) { setError(message(reason)); }
    finally { setBusy(false); }
  };

  return <form className="taxonomy-upload-form" onSubmit={submit}>
    <h4>Tải tài liệu lên "{node.title}"</h4>
    <label>Tên tài liệu<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Để trống sẽ lấy theo tên file" /></label>
    <label>Loại<select value={docType} onChange={(e) => setDocType(e.target.value)}>{CONTENT_DOC_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
    <label>Phạm vi<select value={audience} onChange={(e) => setAudience(e.target.value)}><option value="STUDENT_ALLOWED">Cho phép học sinh</option><option value="TEACHER_RESTRICTED">Chỉ giáo viên</option></select></label>
    <label>File PDF<input required type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
    {error && <div className="api-error">{error}</div>}
    <button className="taxonomy-primary" disabled={busy}>{busy ? "Đang tải & chuyển…" : "Tải lên và chuyển sang Markdown"}</button>
  </form>;
}

function HistoryTab({ logs, loading, userMap }: { logs: { id: number; actorUserId: number | null; action: string; oldData: string | null; newData: string | null; createdAt: string }[]; loading: boolean; userMap: Map<number, { fullName: string }> }) {
  const fmt = (v: string) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(v));
  return <div className="taxonomy-history-tab">
    {loading && <div className="taxonomy-empty">Đang tải…</div>}
    {!loading && logs.length === 0 && <div className="taxonomy-empty">Chưa có lịch sử thay đổi.</div>}
    {logs.length > 0 && <table><thead><tr><th>Thời gian</th><th>Người thực hiện</th><th>Thao tác</th><th>Trước</th><th>Sau</th></tr></thead>
      <tbody>{logs.map((log) => <tr key={log.id}>
        <td>{fmt(log.createdAt)}</td>
        <td>{log.actorUserId ? userMap.get(log.actorUserId)?.fullName ?? `#${log.actorUserId}` : "Hệ thống"}</td>
        <td>{log.action}</td><td>{log.oldData ?? "—"}</td><td>{log.newData ?? "—"}</td>
      </tr>)}</tbody>
    </table>}
  </div>;
}

function TaxonomyFormModal({ session, state, onClose, onDone }: { session: AuthSession; state: { mode: "create" | "edit"; parentId: number | null; node?: TaxonomyNode }; onClose: () => void; onDone: () => Promise<void> }) {
  const [title, setTitle] = useState(state.node?.title ?? "");
  const [description, setDescription] = useState(state.node?.description ?? "");
  const [error, setError] = useState("");
  const depth = state.mode === "edit" ? state.node!.depth : (state.parentId == null ? 1 : undefined);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (state.mode === "edit") await updateTaxonomyNode(session, state.node!.id, { title, description });
      else await createTaxonomyNode(session, { title, description }, state.parentId ?? undefined);
      await onDone();
    } catch (reason) { setError(message(reason)); }
  };
  return <div className="taxonomy-overlay"><form className="taxonomy-modal" onSubmit={submit}>
    <header><h2>{state.mode === "edit" ? `Sửa ${depthLabel[state.node!.depth]}` : depth ? `Tạo ${depthLabel[depth]}` : "Tạo mục mới"}</h2><button type="button" onClick={onClose}><X size={18} /></button></header>
    <label>Tên<input required autoFocus value={title} onChange={(e) => setTitle(e.target.value)} /></label>
    <label>Mô tả<textarea rows={4} value={description ?? ""} onChange={(e) => setDescription(e.target.value)} /></label>
    {error && <div className="api-error">{error}</div>}
    <footer><button type="button" onClick={onClose}>Hủy</button><button className="taxonomy-primary">Lưu</button></footer>
  </form></div>;
}

function MergeNodeModal({ source, candidates, pathOf, onClose, onMerge }: {
  source: TaxonomyNode; candidates: TaxonomyNode[]; pathOf: (node: TaxonomyNode) => string;
  onClose: () => void; onMerge: (targetId: number, targetTitle: string) => void;
}) {
  return <div className="taxonomy-overlay"><div className="taxonomy-modal">
    <header><h2>Gộp "{source.title}" vào…</h2><button type="button" onClick={onClose}><X size={18} /></button></header>
    <p className="taxonomy-hint">"{source.title}" sẽ biến mất khỏi cây và trở thành tên gọi khác của mục đích, nên các tìm kiếm cũ vẫn ra đúng chỗ. Chỉ gộp được hai mục cùng cấp.</p>
    {candidates.length === 0 && <p className="taxonomy-empty">Không có mục nào cùng cấp để gộp vào.</p>}
    <ul className="taxonomy-merge-candidates">{candidates.map((c) => <li key={c.id}>
      <span>{pathOf(c)}</span><button onClick={() => onMerge(c.id, c.title)}>Gộp vào đây</button>
    </li>)}</ul>
    <footer><button type="button" onClick={onClose}>Đóng</button></footer>
  </div></div>;
}

/**
 * Chuyển một mục (kèm cả nhánh con) sang mục cha khác. Chỉ liệt kê những mục nhận được
 * nhánh này mà vẫn không vượt quá 3 cấp — mục cha quá sâu sẽ không hiện ra để chọn.
 */
function MoveNodeModal({ source, height, candidates, pathOf, onClose, onMove }: {
  source: TaxonomyNode; height: number; candidates: TaxonomyNode[]; pathOf: (node: TaxonomyNode) => string;
  onClose: () => void; onMove: (newParentId: number | null, targetTitle: string) => void;
}) {
  const fits = candidates.filter((c) => c.depth + 1 + height - 1 <= 3 && c.id !== source.parentId);
  return <div className="taxonomy-overlay"><div className="taxonomy-modal">
    <header><h2>Chuyển "{source.title}" sang…</h2><button type="button" onClick={onClose}><X size={18} /></button></header>
    <p className="taxonomy-hint">Nhánh này cao {height} cấp. Tài liệu và mục con đi theo mục, không mất gì.</p>
    <ul className="taxonomy-merge-candidates">
      {source.parentId != null && <li><span>Đưa lên thành Chuyên đề (cấp 1)</span><button onClick={() => onMove(null, "cấp Chuyên đề")}>Chuyển vào đây</button></li>}
      {fits.map((c) => <li key={c.id}>
        <span>{pathOf(c)}</span><button onClick={() => onMove(c.id, `"${c.title}"`)}>Chuyển vào đây</button>
      </li>)}
    </ul>
    {fits.length === 0 && source.parentId == null && <p className="taxonomy-empty">Không có mục nào nhận được nhánh này mà vẫn giữ đủ 3 cấp.</p>}
    <footer><button type="button" onClick={onClose}>Đóng</button></footer>
  </div></div>;
}
