import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  completeClassSession, postponeClassSession, updateClassScheduleSession, deleteClassScheduleSession,
  type AuthSession, type ClassScheduleRow,
} from "../../api";
import { ClassMaterialsTab } from "./ClassDetailTabs";
import { dateVi, periodLabel, timeVi } from "./ClassDetailOverview";
import { messageOf } from "../../lib/errors";

const STATUS_OPTIONS: { value: ClassScheduleRow["status"]; label: string }[] = [
  { value: "PLANNED", label: "Sắp học" },
  { value: "COMPLETED", label: "Đã học" },
  { value: "POSTPONED", label: "Hoãn" },
  { value: "CANCELLED", label: "Hủy" },
];

export function ClassSessionDetail({
  session, classId, row, onClose,
}: {
  session: AuthSession;
  classId: number;
  row: ClassScheduleRow;
  onClose: () => void;
}) {
  const client = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    scheduledDate: row.scheduledDate || "",
    startTime: row.startTime ? row.startTime.slice(0, 5) : "",
    status: row.status,
    note: row.note || "",
    isMakeup: row.isMakeup || false,
  });

  const invalidate = () => Promise.all([
    "class-detail-schedule", "class-detail-progress",
    "class-schedule", "class-schedule-progress", "cp-schedule", "cp-progress",
  ].map(key => client.invalidateQueries({ queryKey: [key] })));

  const actionMutation = useMutation({
    mutationFn: (action: "complete" | "postpone") =>
      action === "complete" ? completeClassSession(session, classId, row.id) : postponeClassSession(session, classId, row.id),
    onSuccess: async () => { await invalidate(); },
  });

  const updateMutation = useMutation({
    mutationFn: () => updateClassScheduleSession(session, classId, row.id, {
      scheduledDate: form.scheduledDate || undefined,
      startTime: form.startTime ? `${form.startTime}:00` : null,
      status: form.status,
      note: form.note.trim() || null,
      isMakeup: form.isMakeup,
    }),
    onSuccess: async () => {
      await invalidate();
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteClassScheduleSession(session, classId, row.id),
    onSuccess: async () => {
      await invalidate();
      onClose();
    },
  });

  const error = actionMutation.isError ? messageOf(actionMutation.error)
    : updateMutation.isError ? messageOf(updateMutation.error)
    : deleteMutation.isError ? messageOf(deleteMutation.error) : "";

  const handleDelete = () => {
    if (confirm(`Bạn có chắc chắn muốn xóa buổi ${row.seq} (${row.sessionTitle || row.scheduledDate}) khỏi lịch học của lớp?`)) {
      deleteMutation.mutate();
    }
  };

  return (
    <div className="dialog-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label={`Buổi ${row.seq}`} className="dialog-card !max-w-3xl !max-h-[90vh] overflow-auto">
        {/* Header */}
        <header className="flex justify-between items-start gap-3 mb-4 border-b border-outline-variant pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-primary tracking-wider uppercase">BUỔI {row.seq}</span>
              {row.isMakeup && (
                <span className="px-2 py-0.5 rounded bg-tertiary-container text-tertiary text-xs font-bold">Học bù</span>
              )}
              {row.editedManually && (
                <span className="px-2 py-0.5 rounded bg-surface-container-high text-on-surface-variant text-xs font-semibold">Chỉnh tay</span>
              )}
            </div>
            <h3 className="text-lg font-bold text-on-surface mt-1">{row.sessionTitle || "Chưa có tiêu đề"}</h3>
            <p className="text-sm text-on-surface-variant">
              {dateVi(row.scheduledDate)} · {timeVi(row.startTime)} {periodLabel(row) ? `· ${periodLabel(row)}` : ""}
            </p>
            {row.note && !isEditing && (
              <p className="text-xs text-on-surface-variant italic mt-1 bg-surface-container-low p-2 rounded">
                Ghi chú: {row.note}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(v => !v)}
              className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface hover:bg-surface-container-low"
            >
              {isEditing ? "Đóng sửa" : "Chỉnh sửa buổi"}
            </button>
            <button onClick={onClose} aria-label="Đóng buổi học" className="h-8 px-2.5 text-on-surface-variant hover:text-on-surface text-lg">×</button>
          </div>
        </header>

        {error && <div className="api-error mb-4">{error}</div>}

        {/* Chỉnh sửa buổi học form */}
        {isEditing ? (
          <form
            onSubmit={e => { e.preventDefault(); updateMutation.mutate(); }}
            className="border border-outline-variant rounded-xl p-4 bg-surface-container-lowest mb-4 flex flex-col gap-3"
          >
            <h4 className="text-sm font-bold text-on-surface flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px] text-primary">edit_calendar</span>
              Cân chỉnh thông tin buổi học
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Ngày học
                <input
                  type="date"
                  required
                  value={form.scheduledDate}
                  onChange={e => setForm({ ...form, scheduledDate: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Giờ bắt đầu
                <input
                  type="time"
                  value={form.startTime}
                  onChange={e => setForm({ ...form, startTime: e.target.value })}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
                Trạng thái
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as ClassScheduleRow["status"] })}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 pt-6 text-sm font-medium text-on-surface cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isMakeup}
                  onChange={e => setForm({ ...form, isMakeup: e.target.checked })}
                  className="rounded border-outline-variant text-primary"
                />
                Đây là buổi học bù / bổ sung
              </label>
            </div>
            <label className="flex flex-col gap-1 text-xs font-semibold text-on-surface-variant">
              Ghi chú buổi học
              <input
                placeholder="Ví dụ: Học bù do nghỉ lễ, chuyển phòng máy..."
                value={form.note}
                maxLength={500}
                onChange={e => setForm({ ...form, note: e.target.value })}
                className="h-9 px-3 rounded-lg border border-outline-variant text-sm text-on-surface"
              />
            </label>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-outline-variant mt-2 flex-wrap">
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="text-xs font-semibold text-error hover:underline"
              >
                {deleteMutation.isPending ? "Đang xóa…" : "Xóa buổi học này khỏi lịch"}
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-8 px-3 rounded-lg border border-outline-variant text-xs font-semibold text-on-surface-variant"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="h-8 px-4 rounded-lg bg-primary text-on-primary text-xs font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {updateMutation.isPending ? "Đang lưu…" : "Lưu thay đổi"}
                </button>
              </div>
            </div>
          </form>
        ) : null}

        {/* Học liệu cho buổi */}
        <h4 className="text-sm font-bold text-on-surface mb-2">Học liệu cho buổi này</h4>
        <ClassMaterialsTab session={session} classId={classId} scheduleId={row.id} />

        {/* Footer quick actions */}
        <footer className="flex items-center justify-between gap-2 mt-4 pt-3 border-t border-outline-variant flex-wrap">
          <div className="flex gap-2 flex-wrap">
            {(row.status === "PLANNED" || row.status === "POSTPONED") && (
              <button
                disabled={actionMutation.isPending}
                className="h-9 px-4 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                onClick={() => actionMutation.mutate("complete")}
              >
                {actionMutation.isPending ? "Đang lưu…" : "Hoàn thành buổi"}
              </button>
            )}
            {row.status === "PLANNED" && (
              <button
                disabled={actionMutation.isPending}
                className="h-9 px-4 border border-outline-variant rounded-lg text-sm font-semibold text-on-surface hover:bg-surface-container-low transition-colors"
                onClick={() => actionMutation.mutate("postpone")}
              >
                Hoãn buổi
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container-low"
          >
            Đóng
          </button>
        </footer>
      </section>
    </div>
  );
}
