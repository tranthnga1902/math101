import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getClassCurriculum, addClassCurriculum, removeClassCurriculum, getTaxonomyTreeReadOnly,
  type AuthSession, type TaxonomyNode,
} from "../../api";
import { messageOf } from "../../lib/errors";

const ROOT = 0;
const depthLabel: Record<number, string> = { 1: "Chuyên đề", 2: "Bài", 3: "Dạng" };

/**
 * Chương trình học của lớp = danh sách các mục trong cây chuyên đề do Admin biên soạn.
 * Ở đây chỉ tham chiếu, không sao chép — nội dung gốc vẫn do Admin quản lý.
 */
export function ClassCurriculumPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  const [note, setNote] = useState("");

  const listQuery = useQuery({ queryKey: ["class-curriculum", session.accessToken, classId], queryFn: () => getClassCurriculum(session, classId) });
  const items = listQuery.data ?? [];
  const treeQuery = useQuery({ queryKey: ["teacher-taxonomy-tree", session.accessToken], queryFn: () => getTaxonomyTreeReadOnly(session), enabled: picking });
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
  const chosen = new Set(items.map(item => item.taxonomy_node_id));

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["class-curriculum"] });
  const addMutation = useMutation({ mutationFn: (nodeId: number) => addClassCurriculum(session, classId, nodeId, note.trim() || null), onSuccess: async () => { await invalidate(); setNote(""); } });
  const removeMutation = useMutation({ mutationFn: (id: number) => removeClassCurriculum(session, classId, id), onSuccess: invalidate });
  const error = [listQuery, treeQuery, addMutation, removeMutation].map(q => (q.isError ? messageOf(q.error) : "")).find(Boolean) ?? "";

  return <section className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-base font-bold text-on-surface">Chương trình học của lớp</h3>
        <p className="text-xs text-on-surface-variant">{items.length} mục · lấy từ cây chuyên đề do Admin biên soạn</p>
      </div>
      <button onClick={() => setPicking(v => !v)} className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity">
        {picking ? "Đóng cây chuyên đề" : "Thêm mục"}
      </button>
    </div>

    {error && <div className="api-error">{error}</div>}

    {picking && (
      <div className="border border-outline-variant rounded-lg bg-surface-container-lowest overflow-hidden">
        <div className="px-4 py-3 border-b border-outline-variant flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-on-surface-variant shrink-0">Ghi chú cho mục sắp thêm</span>
          <input placeholder="Ví dụ: học trong tháng 9 (không bắt buộc)" value={note} onChange={e => setNote(e.target.value)}
            className="h-8 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface flex-1 min-w-[200px]" />
        </div>
        <div className="max-h-[45vh] overflow-auto py-1">
          {treeQuery.isLoading && <p className="px-4 py-3 text-sm text-on-surface-variant">Đang tải cây chuyên đề…</p>}
          {!treeQuery.isLoading && !(childrenByParent.get(ROOT) ?? []).length && <p className="px-4 py-3 text-sm text-on-surface-variant">Admin chưa biên soạn nội dung nào.</p>}
          {(childrenByParent.get(ROOT) ?? []).map(node => (
            <TreeRow key={node.id} node={node} level={0} childrenByParent={childrenByParent} expanded={expanded} chosen={chosen}
              onToggle={id => setExpanded(list => list.includes(id) ? list.filter(v => v !== id) : [...list, id])}
              onPick={id => addMutation.mutate(id)} />
          ))}
        </div>
      </div>
    )}

    <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
      {items.map((item, index) => (
        <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
          <div className="flex items-start gap-3 min-w-0">
            <span className="w-6 h-6 rounded bg-surface-variant text-on-surface-variant flex items-center justify-center text-[11px] font-bold shrink-0 data-tabular">{index + 1}</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-on-surface truncate">{item.title}</p>
              <p className="text-xs text-on-surface-variant truncate">
                {depthLabel[item.depth] ?? `Cấp ${item.depth}`}
                {item.parent_title && ` · thuộc ${item.parent_title}`}
                {` · ${item.document_count} tài liệu trong kho`}
                {item.note && ` · ${item.note}`}
              </p>
            </div>
          </div>
          <button onClick={() => removeMutation.mutate(item.id)} className="shrink-0 px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors">Bỏ</button>
        </div>
      ))}
      {!items.length && <p className="text-sm text-on-surface-variant text-center py-8">Lớp chưa gán chương trình học nào.</p>}
    </div>
  </section>;
}

function TreeRow({ node, level, childrenByParent, expanded, chosen, onToggle, onPick }: {
  node: TaxonomyNode; level: number; childrenByParent: Map<number, TaxonomyNode[]>;
  expanded: number[]; chosen: Set<number>; onToggle: (id: number) => void; onPick: (id: number) => void;
}) {
  const children = childrenByParent.get(node.id) ?? [];
  const open = expanded.includes(node.id);
  const already = chosen.has(node.id);
  return <>
    <div className="flex items-center gap-1 px-2 py-1 hover:bg-surface-container-low transition-colors" style={{ paddingLeft: 8 + level * 16 }}>
      <button onClick={() => onToggle(node.id)} disabled={!children.length}
        className="w-5 h-5 shrink-0 flex items-center justify-center text-on-surface-variant disabled:opacity-0">
        <span className="material-symbols-outlined text-[16px]">{open ? "expand_more" : "chevron_right"}</span>
      </button>
      <span className="text-sm text-on-surface truncate flex-1">{node.title}</span>
      <button onClick={() => onPick(node.id)} disabled={already}
        className={`shrink-0 px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${already ? "text-on-surface-variant cursor-default" : "text-primary hover:bg-primary-container/20"}`}>
        {already ? "Đã thêm" : "Thêm"}
      </button>
    </div>
    {open && children.map(child => (
      <TreeRow key={child.id} node={child} level={level + 1} childrenByParent={childrenByParent}
        expanded={expanded} chosen={chosen} onToggle={onToggle} onPick={onPick} />
    ))}
  </>;
}
