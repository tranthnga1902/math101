import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getTeacherSubmissions, gradeSubmission, returnSubmission, type AuthSession, type TeacherSubmission } from "../../api";
import { messageOf } from "../../lib/errors";

const statusLabel: Record<string, { text: string; tone: string }> = {
  SUBMITTED: { text: "Chờ chấm", tone: "bg-primary-container/30 text-primary" },
  GRADED: { text: "Đã chấm", tone: "bg-surface-variant text-on-surface-variant" },
  RETURNED: { text: "Đã trả", tone: "bg-tertiary-container text-on-tertiary-container" },
};

/**
 * Chấm và trả điểm ngay trong lớp, để giáo viên không phải rời chi tiết lớp sang mục khác.
 * Danh sách chỉ có bài BẮT BUỘC — backend đã lọc sẵn, vì bài tự chọn theo cách chấm đã chốt
 * chỉ ghi nhận đã làm chứ không bao giờ ra điểm.
 */
export function ClassGradingPanel({ session, classId }: { session: AuthSession; classId: number }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<TeacherSubmission | null>(null);
  const [score, setScore] = useState("");
  const [feedback, setFeedback] = useState("");
  const [filter, setFilter] = useState("");

  const query = useQuery({
    queryKey: ["teacher-submissions", session.accessToken, classId],
    queryFn: () => getTeacherSubmissions(session, classId),
  });

  // Chấm hoặc trả điểm đều đẻ ra một dòng nhật ký và đổi sổ điểm, nên làm mới cả ba nơi.
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["teacher-submissions"] }),
      queryClient.invalidateQueries({ queryKey: ["class-submission-log", session.accessToken, classId] }),
      queryClient.invalidateQueries({ queryKey: ["class-gradebook", session.accessToken, classId] }),
    ]);
  };
  const grade = useMutation({
    mutationFn: () => gradeSubmission(session, selected!.id, Number(score), feedback.trim()),
    onSuccess: async () => { await invalidate(); setSelected(null); },
  });
  const release = useMutation({
    mutationFn: (id: number) => returnSubmission(session, id),
    onSuccess: invalidate,
  });

  const all = query.data ?? [];
  const rows = all.filter(row => !filter || row.grading_status === filter);
  const pending = all.filter(row => row.grading_status === "SUBMITTED").length;
  const graded = all.filter(row => row.grading_status === "GRADED").length;
  const error = query.isError ? messageOf(query.error) : grade.isError ? messageOf(grade.error) : release.isError ? messageOf(release.error) : "";

  return <section className="flex flex-col gap-4">
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div>
        <h3 className="text-base font-bold text-on-surface">Chấm và trả điểm</h3>
        <p className="text-xs text-on-surface-variant">{pending} bài chờ chấm · {graded} bài chờ trả điểm</p>
      </div>
      <select value={filter} onChange={e => setFilter(e.target.value)}
        className="h-9 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm text-on-surface">
        <option value="">Tất cả trạng thái</option>
        <option value="SUBMITTED">Chờ chấm</option>
        <option value="GRADED">Đã chấm</option>
        <option value="RETURNED">Đã trả</option>
      </select>
    </div>

    {error && <div className="api-error">{error}</div>}

    {query.isLoading ? <p className="text-sm text-on-surface-variant">Đang tải bài nộp…</p> : (
      <div className="flex flex-col divide-y divide-outline-variant border border-outline-variant rounded-lg overflow-hidden">
        {rows.map(row => {
          const state = statusLabel[row.grading_status] ?? statusLabel.SUBMITTED;
          return (
            <div key={row.id} className="flex items-center justify-between gap-3 p-3 bg-surface-container-lowest hover:bg-surface-container-low transition-colors flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${state.tone}`}>{state.text}</span>
                  <p className="text-sm font-semibold text-on-surface truncate">{row.full_name}</p>
                </div>
                <p className="text-xs text-on-surface-variant truncate">
                  {row.title} · nộp {new Date(row.submitted_at).toLocaleString("vi-VN")}
                  {row.total_questions ? ` · tự động ${row.correct_count ?? 0}/${row.total_questions} câu đúng` : ""}
                </p>
              </div>
              <span className="shrink-0 text-sm font-bold text-on-surface data-tabular">
                {row.score == null ? "—" : `${Number(row.score).toFixed(2)}/${row.max_score ?? 10}`}
              </span>
              <div className="shrink-0 flex items-center gap-2">
                <button type="button"
                  onClick={() => { setSelected(row); setScore(row.score == null ? "" : String(row.score)); setFeedback(row.teacher_feedback ?? ""); }}
                  className="h-9 px-3 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface hover:bg-surface-container transition-colors">
                  Chấm
                </button>
                {row.grading_status === "GRADED" && (
                  <button type="button" disabled={release.isPending} onClick={() => release.mutate(row.id)}
                    className="h-9 px-3 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
                    Trả điểm
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {!rows.length && <p className="text-sm text-on-surface-variant text-center py-8">Chưa có bài nộp phù hợp.</p>}
      </div>
    )}

    {selected && (
      <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
        <form onSubmit={e => { e.preventDefault(); grade.mutate(); }}
          className="w-full max-w-md bg-surface-container-lowest border border-outline-variant rounded-xl p-5 flex flex-col gap-3">
          <div>
            <p className="text-xs font-semibold text-primary tracking-wide">CHẤM BÀI</p>
            <h4 className="text-base font-bold text-on-surface">{selected.full_name}</h4>
            <p className="text-xs text-on-surface-variant">
              {selected.title}
              {selected.total_questions ? ` · tự động đúng ${selected.correct_count ?? 0}/${selected.total_questions}` : ""}
            </p>
          </div>
          <label className="flex flex-col gap-1 text-sm font-medium text-on-surface">
            Điểm thang 10
            <input required type="number" min="0" max="10" step="0.01" value={score} onChange={e => setScore(e.target.value)}
              className="h-10 px-3 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-on-surface">
            Nhận xét
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)} placeholder="Nhận xét gửi học sinh…" rows={3}
              className="px-3 py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface" />
          </label>
          {grade.isError && <p className="text-sm text-error">{messageOf(grade.error)}</p>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setSelected(null)}
              className="h-10 px-4 rounded-lg border border-outline-variant text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">
              Hủy
            </button>
            <button type="submit" disabled={grade.isPending}
              className="h-10 px-4 rounded-lg bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50">
              {grade.isPending ? "Đang lưu…" : "Lưu điểm"}
            </button>
          </div>
        </form>
      </div>
    )}
  </section>;
}
