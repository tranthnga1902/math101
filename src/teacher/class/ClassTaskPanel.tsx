import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAssignments, saveAssignment, deleteAssignment, getWorksheets, getClassDocuments,
  type AuthSession, type Assignment, type AssignmentState, type ClassRequirement, type LatePolicy,
} from "../../api";
import { messageOf } from "../../lib/errors";

type Draft = {
  title: string; source: "worksheet" | "document"; worksheetId: number; documentId: number;
  requirement: ClassRequirement; openAt: string; dueAt: string; status: string;
  maxAttempts: number; latePolicy: LatePolicy; latePenaltyPercent: number; publishScoreAt: string;
};

const emptyDraft: Draft = {
  title: "", source: "worksheet", worksheetId: 0, documentId: 0, requirement: "BAT_BUOC",
  openAt: "", dueAt: "", status: "PUBLISHED",
  maxAttempts: 1, latePolicy: "REJECT", latePenaltyPercent: 0, publishScoreAt: "",
};

/** Nhãn trạng thái vòng đời do server tính, không phải cột `status` giáo viên đặt. */
const stateLabel: Record<AssignmentState, string> = {
  DRAFT: "Chưa giao", SCHEDULED: "Chờ tới giờ mở", OPEN: "Đang mở",
  LATE_OPEN: "Quá hạn — còn nhận muộn", CLOSED: "Đã đóng",
};
const stateTone: Record<AssignmentState, string> = {
  DRAFT: "bg-surface-variant text-on-surface-variant",
  SCHEDULED: "border border-outline-variant text-on-surface-variant",
  OPEN: "bg-primary-container/30 text-primary",
  LATE_OPEN: "bg-error-container/30 text-error",
  CLOSED: "bg-surface-variant text-on-surface-variant",
};

/** Chuyển "2026-08-18T14:30" của <input datetime-local> thành ISO có múi giờ để backend đọc đúng. */
const toIso = (local: string) => (local ? new Date(local).toISOString() : null);
const toLocal = (iso: string | null) => {
  if (!iso) return "";
  const at = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`;
};
const moment = (iso: string | null) => (iso ? new Date(iso).toLocaleString("vi-VN") : "");

const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="flex flex-col gap-1">
    <span className="text-[11px] font-semibold text-on-surface-variant">{label}</span>
    {children}
    {hint && <span className="text-[11px] text-on-surface-variant">{hint}</span>}
  </label>
);

const control = "h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface";

/**
 * Giao đề thi / bài kiểm tra cho lớp. Nguồn có thể là phiếu bài tập hoặc tài liệu đã gắn vào lớp.
 * Nhãn Bắt buộc/Tự chọn quyết định bài này có vào sổ điểm hay chỉ tính mức độ tự giác.
 *
 * Giờ mở, số lượt và chính sách nộp muộn là ràng buộc server thực thi ở mọi đường ghi bài làm —
 * ở đây chỉ báo sớm cho giáo viên, không phải chỗ duy nhất kiểm.
 */
export function ClassTaskPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [composing, setComposing] = useState(false);

  const listQuery = useQuery({ queryKey: ["class-assignments", session.accessToken, classId], queryFn: () => getAssignments(session, classId) });
  const rows = listQuery.data ?? [];
  const sourceQuery = useQuery({
    queryKey: ["class-task-sources", session.accessToken, classId],
    queryFn: async () => {
      const [worksheets, documents] = await Promise.all([getWorksheets(session), getClassDocuments(session, classId)]);
      return { worksheets, documents };
    },
    enabled: composing,
  });
  const worksheets = sourceQuery.data?.worksheets ?? [];
  const documents = sourceQuery.data?.documents ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["class-assignments"] });
  const saveMutation = useMutation({
    mutationFn: () => saveAssignment(session, {
      classId,
      lessonId: null,
      worksheetId: draft.source === "worksheet" ? draft.worksheetId : null,
      documentId: draft.source === "document" ? draft.documentId : null,
      title: draft.title.trim(),
      openAt: toIso(draft.openAt),
      dueAt: toIso(draft.dueAt),
      status: draft.status,
      requirement: draft.requirement,
      maxAttempts: draft.maxAttempts,
      latePolicy: draft.latePolicy,
      latePenaltyPercent: draft.latePolicy === "PENALTY" ? draft.latePenaltyPercent : 0,
      publishScoreAt: toIso(draft.publishScoreAt),
    }, editing?.id),
    onSuccess: async () => { await invalidate(); reset(); },
  });
  const deleteMutation = useMutation({ mutationFn: (id: number) => deleteAssignment(session, id), onSuccess: invalidate });
  const error = [listQuery, sourceQuery, saveMutation, deleteMutation].map(q => (q.isError ? messageOf(q.error) : "")).find(Boolean) ?? "";

  const reset = () => { setDraft(emptyDraft); setEditing(null); setComposing(false); };
  const edit = (row: Assignment) => {
    setEditing(row);
    setComposing(true);
    setDraft({
      title: row.title,
      source: row.documentId ? "document" : "worksheet",
      worksheetId: row.worksheetId ?? 0,
      documentId: row.documentId ?? 0,
      requirement: row.requirement,
      openAt: toLocal(row.openAt),
      dueAt: toLocal(row.dueAt),
      status: row.status,
      maxAttempts: row.maxAttempts ?? 1,
      latePolicy: row.latePolicy ?? "REJECT",
      latePenaltyPercent: row.latePenaltyPercent ?? 0,
      publishScoreAt: toLocal(row.publishScoreAt),
    });
  };

  const sourceChosen = draft.source === "worksheet" ? draft.worksheetId > 0 : draft.documentId > 0;
  // Cùng bộ điều kiện server sẽ từ chối — báo tại chỗ để giáo viên không phải bấm lưu mới biết.
  const conflict =
    draft.openAt && draft.dueAt && new Date(draft.openAt) > new Date(draft.dueAt) ? "Giờ mở phải trước hạn nộp."
    : draft.latePolicy !== "REJECT" && !draft.dueAt ? "Chính sách nộp muộn chỉ có nghĩa khi bài có hạn nộp."
    : draft.latePolicy === "PENALTY" && draft.latePenaltyPercent <= 0 ? "Chọn trừ điểm thì phần trăm trừ phải lớn hơn 0."
    : "";

  return <section className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-base font-bold text-on-surface">Nhiệm vụ & đề thi</h3>
        <p className="text-xs text-on-surface-variant">
          {rows.filter(row => row.requirement === "BAT_BUOC").length} bắt buộc · {rows.filter(row => row.requirement === "TU_CHON").length} tự chọn
        </p>
      </div>
      <button onClick={() => (composing ? reset() : setComposing(true))} className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity">
        {composing ? "Đóng" : "Giao bài mới"}
      </button>
    </div>

    {error && <div className="api-error">{error}</div>}

    {composing && (
      <form onSubmit={event => { event.preventDefault(); saveMutation.mutate(); }}
        className="border border-outline-variant rounded-lg bg-surface-container-lowest p-4 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Field label="Tên bài giao">
            <input required placeholder="VD: Kiểm tra 15 phút — Hàm số bậc hai" value={draft.title}
              onChange={e => setDraft({ ...draft, title: e.target.value })} className={`${control} w-full`} />
          </Field>
          <Field label="Cách tính">
            <select value={draft.requirement} onChange={e => setDraft({ ...draft, requirement: e.target.value as ClassRequirement })} className={`${control} w-full`}>
              <option value="BAT_BUOC">Bắt buộc — vào sổ điểm</option>
              <option value="TU_CHON">Tự chọn — chỉ tính tự giác</option>
            </select>
          </Field>
          <Field label="Trạng thái">
            <select value={draft.status} onChange={e => setDraft({ ...draft, status: e.target.value })} className={`${control} w-full`}>
              <option value="PUBLISHED">Đã giao</option>
              <option value="DRAFT">Chưa giao — học sinh không thấy</option>
              <option value="COMPLETED">Đã đóng</option>
            </select>
          </Field>
          <Field label="Nguồn đề">
            <select value={draft.source} onChange={e => setDraft({ ...draft, source: e.target.value as Draft["source"], worksheetId: 0, documentId: 0 })} className={`${control} w-full`}>
              <option value="worksheet">Phiếu bài tập</option>
              <option value="document">Tài liệu của lớp</option>
            </select>
          </Field>
          <Field label={draft.source === "worksheet" ? "Chọn phiếu" : "Chọn tài liệu"}>
            {draft.source === "worksheet" ? (
              <select required value={draft.worksheetId} onChange={e => setDraft({ ...draft, worksheetId: Number(e.target.value) })} className={`${control} w-full`}>
                <option value={0}>Chọn phiếu…</option>
                {worksheets.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            ) : (
              <select required value={draft.documentId} onChange={e => setDraft({ ...draft, documentId: Number(e.target.value) })} className={`${control} w-full`}>
                <option value={0}>Chọn tài liệu…</option>
                {documents.map(row => <option key={row.id} value={row.document_id}>{row.title}</option>)}
              </select>
            )}
          </Field>
        </div>

        {draft.source === "document" && !documents.length && (
          <p className="text-xs text-on-surface-variant">Lớp chưa có tài liệu nào — gắn tài liệu ở tab Tài liệu trước khi giao theo tài liệu.</p>
        )}

        <div className="border-t border-outline-variant pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Giờ mở" hint="Bỏ trống là mở ngay">
            <input type="datetime-local" value={draft.openAt} onChange={e => setDraft({ ...draft, openAt: e.target.value })} className={`${control} w-full`} />
          </Field>
          <Field label="Hạn nộp" hint="Bỏ trống là không giới hạn">
            <input type="datetime-local" value={draft.dueAt} onChange={e => setDraft({ ...draft, dueAt: e.target.value })} className={`${control} w-full`} />
          </Field>
          <Field label="Số lượt nộp" hint={draft.maxAttempts === 0 ? "0 = không giới hạn" : undefined}>
            <input type="number" min={0} max={50} value={draft.maxAttempts}
              onChange={e => setDraft({ ...draft, maxAttempts: Number(e.target.value) })} className={`${control} w-full`} />
          </Field>
          <Field label="Giờ công bố điểm" hint="Bỏ trống thì phải bấm trả từng bài">
            <input type="datetime-local" value={draft.publishScoreAt} onChange={e => setDraft({ ...draft, publishScoreAt: e.target.value })} className={`${control} w-full`} />
          </Field>
          <Field label="Quá hạn thì sao">
            <select value={draft.latePolicy} onChange={e => setDraft({ ...draft, latePolicy: e.target.value as LatePolicy })} className={`${control} w-full`}>
              <option value="REJECT">Không nhận nữa</option>
              <option value="ACCEPT">Vẫn nhận, không trừ điểm</option>
              <option value="PENALTY">Vẫn nhận, trừ điểm</option>
            </select>
          </Field>
          {draft.latePolicy === "PENALTY" && (
            <Field label="Trừ bao nhiêu phần trăm" hint={`10 điểm nộp muộn còn ${(10 * (100 - draft.latePenaltyPercent) / 100).toFixed(1)}`}>
              <input type="number" min={1} max={100} value={draft.latePenaltyPercent}
                onChange={e => setDraft({ ...draft, latePenaltyPercent: Number(e.target.value) })} className={`${control} w-full`} />
            </Field>
          )}
        </div>

        {conflict && <p className="text-xs text-error">{conflict}</p>}

        <div className="flex items-center gap-2">
          <button type="submit" disabled={!sourceChosen || Boolean(conflict) || saveMutation.isPending}
            className="h-9 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
            {saveMutation.isPending ? "Đang lưu…" : editing ? "Cập nhật" : "Giao bài"}
          </button>
          {editing && <button type="button" onClick={reset} className="h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low transition-colors">Hủy sửa</button>}
        </div>
      </form>
    )}

    <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
      {rows.map(row => {
        const state = row.state ?? "OPEN";
        const timing = [
          row.openAt ? `mở ${moment(row.openAt)}` : "",
          row.dueAt ? `hạn ${moment(row.dueAt)}` : "không giới hạn hạn nộp",
          row.maxAttempts === 0 ? "nộp lại thoải mái" : `${row.maxAttempts} lượt nộp`,
          row.latePolicy === "PENALTY" ? `muộn trừ ${row.latePenaltyPercent}%` : row.latePolicy === "ACCEPT" ? "nhận muộn" : "",
          row.publishScoreAt ? `công bố điểm ${moment(row.publishScoreAt)}` : "",
        ].filter(Boolean).join(" · ");
        return (
          <div key={row.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-on-surface truncate">{row.title}</p>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${stateTone[state]}`}>{stateLabel[state] ?? state}</span>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${row.requirement === "BAT_BUOC" ? "bg-primary-container/30 text-primary" : "bg-surface-variant text-on-surface-variant"}`}>
                  {row.requirement === "BAT_BUOC" ? "Bắt buộc" : "Tự chọn"}
                </span>
              </div>
              <p className="text-xs text-on-surface-variant truncate">
                {timing}{row.documentId ? " · theo tài liệu" : row.worksheetId ? " · theo phiếu bài tập" : ""}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => edit(row)} className="px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary-container/20 rounded transition-colors">Sửa</button>
              <button onClick={() => { if (confirm(`Xóa nhiệm vụ "${row.title}"?`)) deleteMutation.mutate(row.id); }}
                className="px-2.5 py-1 text-xs font-semibold text-error hover:bg-error-container/30 rounded transition-colors">Xóa</button>
            </div>
          </div>
        );
      })}
      {!rows.length && <p className="text-sm text-on-surface-variant text-center py-8">Lớp chưa có nhiệm vụ nào.</p>}
    </div>
  </section>;
}
